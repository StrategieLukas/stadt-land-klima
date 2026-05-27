/**
 * useMunicipalityPageState.js
 *
 * Single source of truth for which view to render on the municipality detail page.
 * All "which case is this?" logic lives here — import PAGE_VIEWS and use pageView
 * in the page component to replace ad-hoc v-if chains and scattered computed refs.
 *
 * Usage in [slug].vue:
 *   const { pageView, isRatedView, hasLocalteam, PAGE_VIEWS: PV } =
 *     useMunicipalityPageState({ directusData, selectedCatalogVersion,
 *       directusMuniBySlug, slzArea, slzPending, directusMuniByArs, route })
 *
 *   // Debug in browser devtools:
 *   //   console.log(pageView.value)
 */

/** All 9 possible page-view states. */
export const PAGE_VIEWS = Object.freeze({
  /** Municipality exists in Directus but is locked — unverified creator, no matching preview token. */
  PREVIEW_LOCKED:    'preview-locked',

  /** Score exists, status=draft, but unlocked (creator_verified or matching preview_token). */
  RATED_DRAFT:       'rated-draft',

  /** Score exists, municipality is published, but the URL uses a non-current catalog version. */
  RATED_OUTDATED:    'rated-outdated',

  /** Score exists, published, current catalog, percentage_rated >= 98. */
  RATED_COMPLETE:    'rated-complete',

  /** Score exists, published, current catalog, incomplete — gated without ?preview=true. */
  IN_PROGRESS_LOCKED: 'in-progress-locked',

  /** Score exists, published, current catalog, percentage_rated < 98, has localteam — requires ?preview=true. */
  RATED_IN_PROGRESS: 'rated-in-progress',

  /** Score exists, published, current catalog, percentage_rated < 98, no localteam — requires ?preview=true. */
  RATED_PARTIAL:     'rated-partial',

  /** No score — waiting for the Stadt-Land-Zahl look-up to resolve. */
  LOADING:           'loading',

  /** No score — municipality not in Directus but found in Stadt-Land-Zahl (ARS-based page). */
  SLZ_FOUND:         'slz-found',

  /** Not found in Directus or Stadt-Land-Zahl. Triggers a 404. */
  NOT_FOUND:         'not-found',
})

/**
 * @param {object} directusData          Plain object from fetchMunicipalityData (not reactive).
 * @param {object} selectedCatalogVersion Plain object — current catalog version (not reactive).
 * @param {Ref}    directusMuniBySlug     Directus municipality record by slug (reactive Ref).
 * @param {Ref}    slzArea                Area data from Stadt-Land-Zahl (reactive Ref).
 * @param {Ref}    slzPending             Loading flag for the SLZ fetch (reactive Ref).
 * @param {Ref}    directusMuniByArs      Directus municipality by ARS that has a localteam (Ref).
 * @param {object} route                  Nuxt route (read route.query.preview for token check).
 */
export function useMunicipalityPageState({
  directusData,
  selectedCatalogVersion,
  directusMuniBySlug,
  slzArea,
  slzPending,
  directusMuniByArs,
  route,
}) {
  const score = directusData?.municipalityScore

  const pageView = computed(() => {
    // ── A: Directus score record exists ──────────────────────────────────────
    if (score) {
      const muni = score.municipality

      // A1: Preview-locked (unverified creator, no matching preview token)
      // Requires both ?preview=true AND ?preview_token=<token> to bypass — only the
      // Directus preview button should ever generate a URL with these parameters.
      if (
        muni.status !== 'published' &&
        !muni.creator_verified &&
        !(route.query.preview === 'true' && route.query.preview_token === muni.preview_token)
      ) return PAGE_VIEWS.PREVIEW_LOCKED

      // A2: Draft but unlocked (creator_verified or matching preview_token)
      if (muni.status === 'draft') return PAGE_VIEWS.RATED_DRAFT

      // A3: Published but viewing an older catalog version
      if (!selectedCatalogVersion.isCurrentFrontend) return PAGE_VIEWS.RATED_OUTDATED

      // A4–A6: Published, current catalog
      if (score.percentage_rated >= 98) return PAGE_VIEWS.RATED_COMPLETE

      // A5/A6: Incomplete — only accessible with ?preview=true (keeps drafts/in-progress off public search)
      if (route.query.preview !== 'true') return PAGE_VIEWS.IN_PROGRESS_LOCKED
      if (muni.localteam_id)             return PAGE_VIEWS.RATED_IN_PROGRESS
      return PAGE_VIEWS.RATED_PARTIAL
    }

    // ── B: No score — check if the slug resolves to a locked draft municipality ──
    const muniBySlug = directusMuniBySlug.value
    if (
      muniBySlug &&
      muniBySlug.status !== 'published' &&
      !muniBySlug.creator_verified &&
      !(route.query.preview === 'true' && route.query.preview_token === muniBySlug.preview_token)
    ) return PAGE_VIEWS.PREVIEW_LOCKED

    // ── C / D / E: SLZ look-up ────────────────────────────────────────────────
    if (slzPending.value) return PAGE_VIEWS.LOADING
    if (slzArea.value)    return PAGE_VIEWS.SLZ_FOUND
    return PAGE_VIEWS.NOT_FOUND
  })

  /** True for all states that render the full <detail-municipality> component. */
  const isRatedView = computed(() => pageView.value.startsWith('rated-'))

  /** True when the SLZ-found area already has an active localteam in Directus. */
  const hasLocalteam = computed(() => !!directusMuniByArs.value)

  return { pageView, isRatedView, hasLocalteam, PAGE_VIEWS }
}
