/**
 * Unified search composable for the command palette.
 *
 * Combines three data sources and returns grouped, reactive results:
 *
 *   municipalities — Directus published municipalities (searched by name) merged
 *                    with StadtLandZahl area search results. Directus entries that
 *                    are not already in the StadtLandZahl response for this query
 *                    are prepended so rated municipalities are always surfaced.
 *
 *   content        — Meilisearch full-text results (pages, blocks, measures, …)
 *
 * Returns { groupsWithIndex, flatResults, isLoading, search, clear }.
 *
 * groupsWithIndex — array of group objects, each result has a _flatIndex used for
 *                   keyboard navigation.
 * flatResults     — flat computed array across all groups (used for moveFocus /
 *                   navigateToFocused in the palette).
 *
 * @param {object} options
 * @param {import('vue').Ref<string|null> | string | null} options.catalogVersionName
 *   Optional catalog version name to prefer when resolving stadtlandklimaDataAll.
 */
import { ref, computed, isRef } from 'vue'
import lodash from 'lodash'
const { debounce } = lodash
import { getScorePercentageColor, getStateFromArs } from '~/shared/utils.js'
import { isMunicipalityScoreComplete } from '~/shared/municipality-score-publishing.js'

export function useUnifiedSearch({ catalogVersionName = null } = {}) {
  const { $directus, $readItems, $t } = useNuxtApp()

  const catalogRef = isRef(catalogVersionName) ? catalogVersionName : ref(catalogVersionName)

  // Raw results from each source
  const rawAreaResults = ref([])      // StadtLandZahl (already camelCase-normalised by /api/area-search)
  const rawDirectusMunis = ref([])    // Directus municipalities (published, matched by name)
  const rawContentResults = ref([])   // Meilisearch hits
  const isLoading = ref(false)

  // --- Area enrichment (mirrors the logic in useAreaSearch) ---

  function enrichArea(area) {
    const level = area.level ?? 4
    const isMunicipality = level >= 4 || area.isReasonableForMunicipalRating === true

    const stateLabel = isMunicipality ? (getStateFromArs(area.ars) ?? area.prefix) : null
    const typeLabel  = area.prefix

    let ctaType           = 'area'
    let scoreDisplay      = null
    let scoreTotalColorClass = null
    let _slug             = null
    let _oldCatalogName   = null

    if (isMunicipality) {
      const allData = area.stadtlandklimaDataAll ?? []

      if (catalogRef.value) {
        // With catalog context: check current catalog first, then fall back to older published rating
        const currentRating = allData.find(d => d.measureCatalogName === catalogRef.value && d.slug)
        const directusStatus = area.directusCatalogStatus
        const scores = directusStatus?.scores ?? []
        const completeScores = scores.filter(isMunicipalityScoreComplete)
        const currentScore = completeScores.find(score => score.catalog_version?.name === catalogRef.value)
        const oldScore = completeScores.find(score => score.catalog_version?.name !== catalogRef.value)

        if (currentScore) {
          ctaType              = 'complete'
          _slug                = directusStatus?.slug ?? currentRating?.slug ?? null
          const scoreTotal = currentScore?.score_total ?? currentRating?.scoreTotal
          scoreDisplay         = scoreTotal != null
            ? `${Math.round(Number(scoreTotal))}%`
            : null
          scoreTotalColorClass = scoreTotal != null
            ? getScorePercentageColor(parseFloat(scoreTotal))
            : null
        } else {
          // Check for a published rating from any older catalog
          const oldRating = allData.find(d => d.measureCatalogName === oldScore?.catalog_version?.name)
          if (oldScore) {
            ctaType              = 'outdated'
            _slug                = directusStatus?.slug ?? oldRating?.slug ?? null
            _oldCatalogName      = oldScore.catalog_version?.name ?? null
            const scoreTotal = oldScore.score_total ?? oldRating?.scoreTotal
            scoreDisplay         = scoreTotal != null
              ? `${Math.round(Number(scoreTotal))}%`
              : null
            scoreTotalColorClass = scoreTotal != null
              ? getScorePercentageColor(parseFloat(scoreTotal))
              : null
          } else if (currentRating?.slug || area.hasLocalteam) {
            ctaType = 'in-progress'
            _slug   = directusStatus?.slug ?? currentRating?.slug ?? null
          } else if (area.isReasonableForMunicipalRating) {
            ctaType = 'none'
          }
        }
      } else {
        // Wait for the current catalog before claiming a rating is complete.
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

  // --- Merged municipalities group ---
  // Directus results that are NOT in the StadtLandZahl response are prepended so
  // rated/in-progress municipalities are always surfaced even when population
  // ordering would push them out of the StadtLandZahl top results.
  const municipalitiesResults = computed(() => {
    const enrichedAreas = rawAreaResults.value.map(enrichArea)
    const areaArsCodes  = new Set(enrichedAreas.map(a => a.ars).filter(Boolean))

    const directusOnly = rawDirectusMunis.value
      .filter(m => m.ars && !areaArsCodes.has(m.ars))
      .map(m => {
        const scores = (m.scores ?? []).filter(isMunicipalityScoreComplete)
        const currentScore = catalogRef.value
          ? scores.find(score => score.catalog_version?.name === catalogRef.value)
          : null
        const oldScore = catalogRef.value
          ? scores.find(score => score.catalog_version?.name !== catalogRef.value)
          : null
        return {
          ars: m.ars,
          name: m.name,
          prefix: '',
          level: 5,
          population: null,
          isReasonableForMunicipalRating: true,
          stadtlandklimaDataAll: [],
          hasLocalteam: !!m.localteam_id,
          isMunicipality: true,
          stateLabel: getStateFromArs(m.ars) ?? null,
          typeLabel: '',
          ctaType: currentScore ? 'complete' : oldScore ? 'outdated' : m.localteam_id ? 'in-progress' : 'none',
          scoreDisplay: null,
          scoreTotalColorClass: null,
          _slug: m.slug,
          _oldCatalogName: oldScore?.catalog_version?.name ?? null,
        }
      })

    return [...directusOnly, ...enrichedAreas]
  })

  // Expose groups with a pre-computed _flatIndex on every result so the palette
  // can do simple equality checks for keyboard-navigation highlighting.
  const groupsWithIndex = computed(() => {
    let idx = 0
    const raw = [
      {
        id:      'municipalities',
        label:   $t('search.group.areas'),
        results: municipalitiesResults.value,
      },
      {
        id:      'content',
        label:   $t('search.group.content'),
        results: rawContentResults.value,
      },
    ]
    return raw.map(g => ({
      ...g,
      results: g.results.map(r => ({
        _type:      g.id === 'municipalities' ? 'area' : 'content',
        _key:       g.id === 'municipalities' ? r.ars : r.id,
        ...r,
        _flatIndex: idx++,
      })),
    }))
  })

  const flatResults = computed(() => groupsWithIndex.value.flatMap(g => g.results))

  // --- Search logic ---

  const _doSearch = debounce(async (term) => {
    if (!term || !term.trim()) {
      rawAreaResults.value   = []
      rawDirectusMunis.value = []
      rawContentResults.value = []
      isLoading.value = false
      return
    }

    isLoading.value = true
    try {
      const [areasResult, directusResult, contentResult] = await Promise.allSettled([
        // 1. StadtLandZahl (via the server-side proxy route that now uses REST)
        $fetch('/api/area-search', { query: { term: term.trim(), mode: 'normal' } }),

        // 2. Directus published municipalities matched by name
        $directus.request($readItems('municipalities', {
          filter: {
            status: { _eq: 'published' },
            name:   { _icontains: term.trim() },
          },
          fields: ['slug', 'name', 'ars', 'localteam_id', { scores: ['published', 'percentage_rated', 'score_total', { catalog_version: ['name'] }] }],
          sort:   'name',
          limit:  8,
        })),

        // 3. Meilisearch content
        $fetch(`/api/content-search?q=${encodeURIComponent(term.trim())}`),
      ])

      // Build a localteam map from the Directus name-search result
      const directusMunis = directusResult.status === 'fulfilled'
        ? (directusResult.value ?? [])
        : []
      const municipalityByArs = new Map(directusMunis.filter(m => m.ars).map(m => [m.ars, m]))

      // For municipality ARS codes from StadtLandZahl not covered by the name search,
      // do a secondary lookup so hasLocalteam stays accurate.
      const nodes = areasResult.status === 'fulfilled'
        ? (Array.isArray(areasResult.value) ? areasResult.value : [])
        : []
      const uncoveredArs = nodes
        .filter(n => (n.level ?? 4) >= 4 && n.ars && !municipalityByArs.has(n.ars))
        .map(n => n.ars)
      if (uncoveredArs.length > 0) {
        try {
          const rows = await $directus.request($readItems('municipalities', {
            filter: { ars: { _in: uncoveredArs } },
            fields: ['ars', 'slug', 'localteam_id', { scores: ['published', 'percentage_rated', 'score_total', { catalog_version: ['name'] }] }],
            limit:  uncoveredArs.length,
          }))
          rows.forEach(r => { if (r.ars) municipalityByArs.set(r.ars, r) })
        } catch { /* silently ignore — falls back to slug-only detection */ }
      }

      rawAreaResults.value = nodes.map(n => ({
        ...n,
        hasLocalteam: !!municipalityByArs.get(n.ars)?.localteam_id,
        directusCatalogStatus: municipalityByArs.get(n.ars) ?? null,
      }))
      rawDirectusMunis.value  = directusMunis
      rawContentResults.value = contentResult.status === 'fulfilled'
        ? (contentResult.value?.hits ?? [])
        : []
    } catch {
      rawAreaResults.value   = []
      rawDirectusMunis.value = []
      rawContentResults.value = []
    } finally {
      isLoading.value = false
    }
  }, 300)

  function search(term) {
    if (term && term.trim()) isLoading.value = true
    _doSearch(term)
  }

  function clear() {
    rawAreaResults.value   = []
    rawDirectusMunis.value = []
    rawContentResults.value = []
    isLoading.value = false
    _doSearch.cancel()
  }

  return { groupsWithIndex, flatResults, isLoading, search, clear }
}
