import type { MaybeRef, Ref } from "vue";
import type { Catalog } from "~/shared/contracts/search";
import type { ScorePublication } from "~/shared/domain";
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
 *       directusMuniBySlug, slzArea, slzPending, directusMuniByArs, previewAuthorized })
 *
 *   // Debug in browser devtools:
 *   //   console.log(pageView.value)
 */

import { isMunicipalityScoreComplete, isMunicipalityScorePublished } from "~/shared/municipality-score-publishing";
interface PageStateOptions {
  directusData: MaybeRef<{ municipalityScore?: ScorePublication | null } | null>;
  selectedCatalogVersion: MaybeRef<Catalog>;
  directusMuniBySlug: Ref<unknown>;
  slzArea: Ref<unknown>;
  slzPending: Ref<boolean>;
  directusMuniByArs: Ref<unknown>;
  previewAuthorized: MaybeRef<boolean>;
}

/** All possible page-view states. */
export const PAGE_VIEWS = Object.freeze({
  /** Municipality exists but has no complete public score or authorized preview. */
  PREVIEW_LOCKED: "preview-locked",

  /** Unpublished/incomplete score returned by the authorized server preview. */
  RATED_DRAFT: "rated-draft",

  /** Score is complete, but the URL uses a non-current catalog version. */
  RATED_OUTDATED: "rated-outdated",

  /** Score is published and every measure in the current catalog has a rating. */
  RATED_COMPLETE: "rated-complete",

  /** Legacy presentation state retained for existing templates. */
  IN_PROGRESS_LOCKED: "in-progress-locked",

  /** Legacy presentation state retained for existing templates. */
  RATED_IN_PROGRESS: "rated-in-progress",

  /** Legacy presentation state retained for existing templates. */
  RATED_PARTIAL: "rated-partial",

  /** No score — waiting for the Stadt-Land-Zahl look-up to resolve. */
  LOADING: "loading",

  /** No score — municipality not in Directus but found in Stadt-Land-Zahl (ARS-based page). */
  SLZ_FOUND: "slz-found",

  /** Not found in Directus or Stadt-Land-Zahl. Triggers a 404. */
  NOT_FOUND: "not-found",
});

/**
 * @param {object} directusData          Approved response from the municipality server route.
 * @param {object} selectedCatalogVersion Plain object — current catalog version (not reactive).
 * @param {Ref}    directusMuniBySlug     Directus municipality record by slug (reactive Ref).
 * @param {Ref}    slzArea                Area data from Stadt-Land-Zahl (reactive Ref).
 * @param {Ref}    slzPending             Loading flag for the SLZ fetch (reactive Ref).
 * @param {Ref}    directusMuniByArs      Directus municipality by ARS that has a localteam (Ref).
 * @param {boolean} previewAuthorized     Authorization result from the server route.
 */
export function useMunicipalityPageState({
  directusData,
  selectedCatalogVersion,
  directusMuniBySlug,
  slzArea,
  slzPending,
  directusMuniByArs,
  previewAuthorized,
}: PageStateOptions) {
  const pageView = computed(() => {
    const score = unref(directusData)?.municipalityScore;
    // ── A: Directus score record exists ──────────────────────────────────────
    if (score) {
      // The selected catalog score decides whether the public detail matches the ranking.
      if (isMunicipalityScoreComplete(score)) {
        return unref(selectedCatalogVersion).isCurrentFrontend ? PAGE_VIEWS.RATED_COMPLETE : PAGE_VIEWS.RATED_OUTDATED;
      }

      // Published but incomplete (percentage_rated < 100) — show the in-progress
      // locked view so visitors know the rating is still being worked on.
      if (isMunicipalityScorePublished(score)) {
        return PAGE_VIEWS.IN_PROGRESS_LOCKED;
      }

      // Only the server may authorize and return an unpublished score. Never
      // compare stored credentials in browser state or trust creator_verified.
      return unref(previewAuthorized) ? PAGE_VIEWS.RATED_DRAFT : PAGE_VIEWS.PREVIEW_LOCKED;
    }

    // ── B: No score — check if the slug resolves to a locked draft municipality ──
    const muniBySlug = directusMuniBySlug.value;
    if (muniBySlug) return PAGE_VIEWS.PREVIEW_LOCKED;

    // ── C / D / E: SLZ look-up ────────────────────────────────────────────────
    if (slzPending.value) return PAGE_VIEWS.LOADING;
    if (slzArea.value) return PAGE_VIEWS.SLZ_FOUND;
    return PAGE_VIEWS.NOT_FOUND;
  });

  /** True for all states that render the full <detail-municipality> component. */
  const isRatedView = computed(() => pageView.value.startsWith("rated-"));

  /** True when the SLZ-found area already has an active localteam in Directus. */
  const hasLocalteam = computed(() => !!directusMuniByArs.value);

  return { pageView, isRatedView, hasLocalteam, PAGE_VIEWS };
}
