/**
 * Unified administrative area search composable.
 *
 * Replaces useAdministrativeAreaSearch and the direct API calls in
 * AdministrativeAreaSearchBar. Returns enriched, reactive results with full
 * label + CTA chip metadata so all search surfaces render consistently.
 *
 * @param {object} options
 * @param {string | import('vue').Ref<string>} options.mode
 *   'normal'     – level 1-3 regions + reasonable municipalities (used by command palette, register)
 *   'reasonable' – isReasonableForMunicipalRating only (hero block)
 *   'all'        – no filter (stats page)
 * @param {import('vue').Ref<Set<string>> | Set<string> | null} options.publishedSlugs
 *   Reactive set of published municipality slugs. Used to determine ctaType.
 * @param {import('vue').Ref<string|null> | string | null} options.catalogVersionName
 *   Optional catalog version name to prefer when resolving stadtlandklimaDataAll.
 */
import { ref, computed, isRef } from 'vue'
import lodash from 'lodash'
const { debounce } = lodash
import { getScorePercentageColor, getStateFromArs } from '~/shared/utils.js'

export function useAreaSearch({ mode = 'reasonable', publishedSlugs = null, catalogVersionName = null } = {}) {
  const { $stadtlandzahlAPI } = useNuxtApp()

  // Allow mode and catalogVersionName to be passed as plain strings or reactive refs
  const modeRef = isRef(mode) ? mode : ref(mode)
  const catalogRef = isRef(catalogVersionName) ? catalogVersionName : ref(catalogVersionName)

  const rawResults = ref([])
  const isLoading = ref(false)

  function getSlugSet() {
    const s = isRef(publishedSlugs) ? publishedSlugs.value : publishedSlugs
    if (s instanceof Set) return s
    if (Array.isArray(s)) return new Set(s)
    return new Set()
  }

  function enrichOne(area) {
    const slugs = getSlugSet()
    // level is returned by the new AREA_SEARCH_QUERY; fall back to 4 (municipality) for old data
    const level = area.level ?? 4
    const isMunicipality = level >= 4

    // Label shown in the subtitle line of each result row
    const stateLabel = isMunicipality ? (getStateFromArs(area.ars) ?? area.prefix) : null
    const typeLabel  = area.prefix   // administrative type prefix (Gemeinde, Kreisfreie Stadt, …)

    let ctaType           = 'area'    // level 1-3 → no CTA
    let scoreDisplay      = null
    let scoreTotalColorClass = null
    let _slug             = null

    if (isMunicipality) {
      const allData    = area.stadtlandklimaDataAll ?? []
      // Prefer the entry that matches the requested catalog version; fall back to first with slug
      const ratingData = catalogRef.value
        ? (allData.find(d => d.measureCatalogName === catalogRef.value && d.slug) ?? allData.find(d => d.slug))
        : allData.find(d => d.slug)

      _slug = ratingData?.slug ?? null

      const isPublished = !!(ratingData?.slug && slugs.has(ratingData.slug))

      if (isPublished) {
        ctaType              = 'complete'
        scoreDisplay         = ratingData.scoreTotal != null
          ? `${Math.round(Number(ratingData.scoreTotal))}%`
          : null
        scoreTotalColorClass = ratingData.scoreTotal != null
          ? getScorePercentageColor(parseFloat(ratingData.scoreTotal))
          : null
      } else if (ratingData?.slug) {
        ctaType = 'in-progress'
      } else if (area.isReasonableForMunicipalRating) {
        ctaType = 'none'
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
    }
  }

  /** Computed so enrichment re-runs automatically when publishedSlugs changes asynchronously */
  const results = computed(() => rawResults.value.map(enrichOne))

  const _doSearch = debounce(async (term) => {
    if (!term.trim()) {
      rawResults.value = []
      isLoading.value  = false
      return
    }
    isLoading.value = true
    try {
      rawResults.value = await $stadtlandzahlAPI.searchAdministrativeAreas(term.trim(), modeRef.value)
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
