/**
 * Unified administrative area search composable.
 *
 * Replaces useAdministrativeAreaSearch and the direct API calls in
 * AdministrativeAreaSearchBar. Returns enriched, reactive results with full
 * label + CTA chip metadata so all search surfaces render consistently.
 *
 * @param {object} options
 * @param {string | import('vue').Ref<string>} options.mode
 *   'normal'     – level 1-3 regions + reasonable municipalities (used by command palette)
 *   'reasonable' – isReasonableForMunicipalRating only (hero block)
 *   'all'        – no filter (stats page)
 * @param {import('vue').Ref<string|null> | string | null} options.catalogVersionName
 *   Optional catalog version name to prefer when resolving stadtlandklimaDataAll.
 * @param {import('vue').Ref<string|null> | string | null} options.statusCatalogVersionId
 *   Optional Directus catalog ID. When set, team and publication status are
 *   resolved from Directus for exactly this catalog.
 */
import { ref, computed, isRef } from 'vue'
import lodash from 'lodash'
const { debounce } = lodash
import { getScorePercentageColor, getStateFromArs } from '~/shared/utils.js'
import { isMunicipalityScoreComplete } from '~/shared/municipality-score-publishing.js'

export function useAreaSearch({
  mode = 'reasonable',
  catalogVersionName = null,
  statusCatalogVersionId = null,
} = {}) {
  const { $stadtlandzahlAPI, $directus, $readItems } = useNuxtApp()

  // Allow mode and catalogVersionName to be passed as plain strings or reactive refs
  const modeRef = isRef(mode) ? mode : ref(mode)
  const catalogRef = isRef(catalogVersionName) ? catalogVersionName : ref(catalogVersionName)
  const statusCatalogRef = isRef(statusCatalogVersionId) ? statusCatalogVersionId : ref(statusCatalogVersionId)

  const rawResults = ref([])
  const isLoading = ref(false)

  function enrichOne(area) {
    // level is returned by the new AREA_SEARCH_QUERY; fall back to 4 (municipality) for old data
    const level = area.level ?? 4
    // City-states (Hamburg, Berlin, Bremen) are level 2 but still rateable municipalities
    const isMunicipality = level >= 4 || area.isReasonableForMunicipalRating === true

    // Label shown in the subtitle line of each result row
    const stateLabel = isMunicipality ? (getStateFromArs(area.ars) ?? area.prefix) : null
    const typeLabel  = area.prefix   // administrative type prefix (Gemeinde, Kreisfreie Stadt, …)

    let ctaType           = 'area'    // level 1-3 → no CTA
    let scoreDisplay      = null
    let scoreTotalColorClass = null
    let _slug             = null
    let _oldCatalogName   = null

    if (isMunicipality) {
      const allData    = area.stadtlandklimaDataAll ?? []

      if (catalogRef.value) {
        // With catalog context: check current catalog first, then fall back to older published rating
        const currentRating = allData.find(d => d.measureCatalogName === catalogRef.value && d.slug)
        const exactStatus = area.directusCatalogStatus
        const oldRating = allData.find(
          d => d.slug && d.measureCatalogName !== catalogRef.value &&
            exactStatus?.completeCatalogNames?.includes(d.measureCatalogName)
        )

        if (exactStatus?.published === true && Number(exactStatus.percentageRated) >= 100) {
          ctaType              = 'complete'
          _slug                = exactStatus?.slug ?? currentRating?.slug ?? null
          const scoreTotal = exactStatus?.scoreTotal ?? currentRating?.scoreTotal
          scoreDisplay         = scoreTotal != null
            ? `${Math.round(Number(scoreTotal))}%`
            : null
          scoreTotalColorClass = scoreTotal != null
            ? getScorePercentageColor(parseFloat(scoreTotal))
            : null
        } else if (oldRating) {
          ctaType              = 'outdated'
          _slug                = oldRating.slug
          _oldCatalogName      = oldRating.measureCatalogName
          scoreDisplay         = oldRating.scoreTotal != null
            ? `${Math.round(Number(oldRating.scoreTotal))}%`
            : null
          scoreTotalColorClass = oldRating.scoreTotal != null
            ? getScorePercentageColor(parseFloat(oldRating.scoreTotal))
            : null
        } else if (exactStatus) {
          _slug = exactStatus.slug ?? currentRating?.slug ?? null
          if (!exactStatus.hasLocalteam) ctaType = 'none'
          else if (Number(exactStatus.percentageRated ?? 0) > 0) ctaType = 'in-progress'
          else ctaType = 'not-started'
        } else if (currentRating?.slug || area.hasLocalteam) {
          ctaType = 'in-progress'
          _slug   = currentRating?.slug ?? null
        } else if (area.isReasonableForMunicipalRating) {
          ctaType = 'none'
        }
      } else {
        // Wait for the catalog before claiming a rating is complete.
        const ratingData = allData.find(d => d.slug)
        _slug = ratingData?.slug ?? null
        if (ratingData?.slug || area.hasLocalteam) {
          ctaType = 'in-progress'
        } else if (area.isReasonableForMunicipalRating) {
          ctaType = 'none'
        }
      }
    }

    return {
      ...area,
      isMunicipality,
      stateLabel,
      typeLabel,
      ctaType,
      scoreDisplay,
      scoreTotalColorClass,
      _slug,
      _oldCatalogName,
    }
  }

  /** Computed so enrichment updates when the selected catalog changes. */
  const results = computed(() => rawResults.value.map(enrichOne))

  const _doSearch = debounce(async (term) => {
    if (!term.trim()) {
      rawResults.value = []
      isLoading.value  = false
      return
    }
    isLoading.value = true
    try {
      const nodes = await $stadtlandzahlAPI.searchAdministrativeAreas(term.trim(), modeRef.value)

      const requestedCatalogId = statusCatalogRef.value
      if (requestedCatalogId) {
        const arsCodes = nodes.map((n) => n.ars).filter(Boolean)
        const candidateSlugs = [
          ...new Set(nodes.flatMap((n) => (n.stadtlandklimaDataAll ?? []).map((item) => item.slug).filter(Boolean))),
        ]
        const identityFilters = []
        if (arsCodes.length > 0) identityFilters.push({ ars: { _in: arsCodes } })
        if (candidateSlugs.length > 0) identityFilters.push({ slug: { _in: candidateSlugs } })

        let municipalities = []
        if (identityFilters.length > 0) {
          try {
            municipalities = await $directus.request(
              $readItems('municipalities', {
                filter: { _or: identityFilters },
                fields: [
                  'ars',
                  'slug',
                  'localteam_id',
                  { scores: ['published', 'percentage_rated', 'score_total', { catalog_version: ['id', 'name'] }] },
                ],
                limit: -1,
              }),
            )
          } catch {
            municipalities = []
          }
        }

        rawResults.value = nodes.map((node) => {
          const nodeSlugs = new Set((node.stadtlandklimaDataAll ?? []).map((item) => item.slug).filter(Boolean))
          const municipality =
            municipalities.find((item) => item.slug && nodeSlugs.has(item.slug)) ??
            municipalities.find((item) => item.ars && item.ars === node.ars)
          const score = municipality?.scores?.find((item) => {
            const catalogId = typeof item.catalog_version === 'object' ? item.catalog_version?.id : item.catalog_version
            return catalogId === requestedCatalogId
          })

          return {
            ...node,
            directusCatalogStatus: {
              hasLocalteam: !!municipality?.localteam_id,
              slug: municipality?.slug ?? null,
              published: score?.published === true,
              percentageRated: score?.percentage_rated ?? null,
              scoreTotal: score?.score_total ?? null,
              completeCatalogNames: (municipality?.scores ?? [])
                .filter(isMunicipalityScoreComplete)
                .map((item) => item.catalog_version?.name)
                .filter(Boolean),
            },
          }
        })
        return
      }

      // Enrich municipality nodes with localteam_id from Directus so that
      // municipalities with a registered localteam but no rating slug yet
      // are shown as 'in-progress' rather than 'none'.
      const muniArsCodes = nodes
        .filter(n => (n.level ?? 4) >= 4)
        .map(n => n.ars)
        .filter(Boolean)

      let localteamByArs = {}
      if (muniArsCodes.length > 0) {
        try {
          const rows = await $directus.request(
            $readItems('municipalities', {
              filter: { ars: { _in: muniArsCodes } },
              fields: ['ars', 'localteam_id'],
              limit: muniArsCodes.length,
            })
          )
          rows.forEach(r => { if (r.ars) localteamByArs[r.ars] = r.localteam_id })
        } catch {
          // Silently ignore — falls back to slug-only detection
        }
      }

      rawResults.value = nodes.map(n => ({
        ...n,
        hasLocalteam: !!(n.ars && localteamByArs[n.ars]),
      }))
    } catch {
      rawResults.value = []
    } finally {
      isLoading.value = false
    }
  }, 300)

  function search(term) {
    if (term.trim()) isLoading.value = true
    _doSearch(term)
  }

  function clear() {
    rawResults.value = []
    isLoading.value  = false
    _doSearch.cancel()
  }

  return { results, isLoading, search, clear }
}
