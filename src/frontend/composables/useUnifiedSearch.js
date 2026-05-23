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
 * @param {import('vue').Ref<Set<string>> | Set<string> | null} options.publishedSlugs
 *   Reactive set of published municipality slugs — used to determine ctaType.
 * @param {import('vue').Ref<string|null> | string | null} options.catalogVersionName
 *   Optional catalog version name to prefer when resolving stadtlandklimaDataAll.
 */
import { ref, computed, isRef } from 'vue'
import lodash from 'lodash'
const { debounce } = lodash
import { getScorePercentageColor, getStateFromArs } from '~/shared/utils.js'

export function useUnifiedSearch({ publishedSlugs = null, catalogVersionName = null } = {}) {
  const { $directus, $readItems } = useNuxtApp()

  const catalogRef = isRef(catalogVersionName) ? catalogVersionName : ref(catalogVersionName)

  // Raw results from each source
  const rawAreaResults = ref([])      // StadtLandZahl (already camelCase-normalised by /api/area-search)
  const rawDirectusMunis = ref([])    // Directus municipalities (published, matched by name)
  const rawContentResults = ref([])   // Meilisearch hits
  const isLoading = ref(false)

  // --- Area enrichment (mirrors the logic in useAreaSearch) ---

  function getSlugSet() {
    const s = isRef(publishedSlugs) ? publishedSlugs.value : publishedSlugs
    if (s instanceof Set) return s
    if (Array.isArray(s)) return new Set(s)
    return new Set()
  }

  function enrichArea(area) {
    const slugs = getSlugSet()
    const level = area.level ?? 4
    const isMunicipality = level >= 4 || area.isReasonableForMunicipalRating === true

    const stateLabel = isMunicipality ? (getStateFromArs(area.ars) ?? area.prefix) : null
    const typeLabel  = area.prefix

    let ctaType           = 'area'
    let scoreDisplay      = null
    let scoreTotalColorClass = null
    let _slug             = null

    if (isMunicipality) {
      const allData = area.stadtlandklimaDataAll ?? []
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
      } else if (ratingData?.slug || area.hasLocalteam) {
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

  // --- Merged municipalities group ---
  // Directus results that are NOT in the StadtLandZahl response are prepended so
  // rated/in-progress municipalities are always surfaced even when population
  // ordering would push them out of the StadtLandZahl top results.
  const municipalitiesResults = computed(() => {
    const enrichedAreas = rawAreaResults.value.map(enrichArea)
    const areaArsCodes  = new Set(enrichedAreas.map(a => a.ars).filter(Boolean))

    const directusOnly = rawDirectusMunis.value
      .filter(m => m.ars && !areaArsCodes.has(m.ars))
      .map(m => ({
        ars:     m.ars,
        name:    m.name,
        prefix:  '',
        level:   5,
        population: null,
        isReasonableForMunicipalRating: true,
        stadtlandklimaDataAll: [],
        hasLocalteam: !!(m.localteam_id),
        isMunicipality: true,
        stateLabel:           getStateFromArs(m.ars) ?? null,
        typeLabel:            '',
        ctaType:              'complete',
        scoreDisplay:         null,
        scoreTotalColorClass: null,
        _slug:                m.slug,
      }))

    return [...directusOnly, ...enrichedAreas]
  })

  // Expose groups with a pre-computed _flatIndex on every result so the palette
  // can do simple equality checks for keyboard-navigation highlighting.
  const groupsWithIndex = computed(() => {
    let idx = 0
    const raw = [
      {
        id:      'municipalities',
        label:   'Gemeinden & Regionen',
        results: municipalitiesResults.value,
      },
      {
        id:      'content',
        label:   'Inhalte',
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
          fields: ['slug', 'name', 'ars', 'localteam_id'],
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
      const localteamByArs = {}
      directusMunis.forEach(m => { if (m.ars && m.localteam_id) localteamByArs[m.ars] = m.localteam_id })

      // For municipality ARS codes from StadtLandZahl not covered by the name search,
      // do a secondary lookup so hasLocalteam stays accurate.
      const nodes = areasResult.status === 'fulfilled'
        ? (Array.isArray(areasResult.value) ? areasResult.value : [])
        : []
      const uncoveredArs = nodes
        .filter(n => (n.level ?? 4) >= 4 && n.ars && !localteamByArs[n.ars])
        .map(n => n.ars)
      if (uncoveredArs.length > 0) {
        try {
          const rows = await $directus.request($readItems('municipalities', {
            filter: { ars: { _in: uncoveredArs } },
            fields: ['ars', 'localteam_id'],
            limit:  uncoveredArs.length,
          }))
          rows.forEach(r => { if (r.ars) localteamByArs[r.ars] = r.localteam_id })
        } catch { /* silently ignore — falls back to slug-only detection */ }
      }

      rawAreaResults.value = nodes.map(n => ({
        ...n,
        hasLocalteam: !!(n.ars && localteamByArs[n.ars]),
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
