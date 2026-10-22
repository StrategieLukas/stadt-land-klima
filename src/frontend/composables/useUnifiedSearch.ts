import type { MaybeRef } from "vue";
import {
  AreaListSchema,
  MunicipalitiesResponseSchema,
  ContentResponseSchema,
  scoreCatalogName,
  type PublicMunicipality,
  type UnifiedArea,
  type ContentHit,
  type AreaCta,
} from "~/shared/contracts/search";
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
import { ref, computed, isRef } from "vue";
import lodash from "lodash";
import { getScorePercentageColor, getStateFromArs } from "~/shared/utils";
import { isMunicipalityScoreComplete } from "~/shared/municipality-score-publishing";
const debounce = lodash.debounce.bind(lodash);

export function useUnifiedSearch({ catalogVersionName = null }: { catalogVersionName?: MaybeRef<string | null> } = {}) {
  const { $t } = useNuxtApp();

  const catalogRef = isRef(catalogVersionName) ? catalogVersionName : ref(catalogVersionName);

  // Raw results from each source
  const rawAreaResults = ref<UnifiedArea[]>([]); // StadtLandZahl (already camelCase-normalised by /api/area-search)
  const rawDirectusMunis = ref<PublicMunicipality[]>([]); // Directus municipalities (published, matched by name)
  const rawContentResults = ref<ContentHit[]>([]); // Meilisearch hits
  const isLoading = ref(false);
  let searchGeneration = 0;

  // --- Area enrichment (mirrors the logic in useAreaSearch) ---

  function enrichArea(area: UnifiedArea) {
    const level = area.level ?? 4;
    const isMunicipality = level >= 4 || area.isReasonableForMunicipalRating === true;

    const stateLabel = isMunicipality ? (getStateFromArs(area.ars) ?? area.prefix) : null;
    const typeLabel = area.prefix;

    let ctaType: AreaCta = "area";
    let scoreDisplay: string | null = null;
    let scoreTotalColorClass: string | null = null;
    let _slug: string | null = null;
    let _oldCatalogName: string | null = null;

    if (isMunicipality) {
      const allData = area.stadtlandklimaDataAll;

      if (catalogRef.value) {
        // With catalog context: check current catalog first, then fall back to older published rating
        const currentRating = allData.find((d) => d.measureCatalogName === catalogRef.value && d.slug);
        const directusStatus = area.directusCatalogStatus;
        const scores = directusStatus?.scores ?? [];
        const completeScores = scores.filter(isMunicipalityScoreComplete);
        const currentScore = completeScores.find((score) => scoreCatalogName(score) === catalogRef.value);
        const oldScore = completeScores.find((score) => scoreCatalogName(score) !== catalogRef.value);

        if (currentScore) {
          ctaType = "complete";
          _slug = directusStatus?.slug ?? currentRating?.slug ?? null;
          const scoreTotal = currentScore.score_total ?? currentRating?.scoreTotal;
          scoreDisplay = scoreTotal != null ? `${Math.round(Number(scoreTotal))}%` : null;
          scoreTotalColorClass = scoreTotal != null ? getScorePercentageColor(Number(scoreTotal)) : null;
        } else {
          // Check for a published rating from any older catalog
          const oldRating = allData.find(
            (d) => d.measureCatalogName === (oldScore ? scoreCatalogName(oldScore) : undefined),
          );
          if (oldScore) {
            ctaType = "outdated";
            _slug = directusStatus?.slug ?? oldRating?.slug ?? null;
            _oldCatalogName = scoreCatalogName(oldScore) ?? null;
            const scoreTotal = oldScore.score_total ?? oldRating?.scoreTotal;
            scoreDisplay = scoreTotal != null ? `${Math.round(Number(scoreTotal))}%` : null;
            scoreTotalColorClass = scoreTotal != null ? getScorePercentageColor(Number(scoreTotal)) : null;
          } else if (currentRating?.slug || area.hasLocalteam) {
            ctaType = "in-progress";
            _slug = directusStatus?.slug ?? currentRating?.slug ?? null;
          } else if (area.isReasonableForMunicipalRating) {
            ctaType = "none";
          }
        }
      } else {
        // Wait for the current catalog before claiming a rating is complete.
        const ratingData = allData.find((d) => d.slug);
        _slug = ratingData?.slug ?? null;
        if (ratingData?.slug || area.hasLocalteam) {
          ctaType = "in-progress";
        } else if (area.isReasonableForMunicipalRating) {
          ctaType = "none";
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
    };
  }

  // --- Merged municipalities group ---
  // Directus results that are NOT in the StadtLandZahl response are prepended so
  // rated/in-progress municipalities are always surfaced even when population
  // ordering would push them out of the StadtLandZahl top results.
  const municipalitiesResults = computed(() => {
    const enrichedAreas = rawAreaResults.value.map(enrichArea);
    const areaArsCodes = new Set(enrichedAreas.map((a) => a.ars).filter(Boolean));

    const directusOnly = rawDirectusMunis.value
      .filter((m) => m.ars && !areaArsCodes.has(m.ars))
      .map((m) => {
        const scores = m.scores.filter(isMunicipalityScoreComplete);
        const currentScore = catalogRef.value
          ? scores.find((score) => scoreCatalogName(score) === catalogRef.value)
          : null;
        const oldScore = catalogRef.value ? scores.find((score) => scoreCatalogName(score) !== catalogRef.value) : null;
        return {
          ars: m.ars!,
          name: m.name,
          prefix: "",
          level: 5,
          population: null,
          isReasonableForMunicipalRating: true,
          stadtlandklimaDataAll: [],
          hasLocalteam: !!m.localteam_id,
          isMunicipality: true,
          stateLabel: getStateFromArs(m.ars) ?? null,
          typeLabel: "",
          ctaType: currentScore
            ? ("complete" as const)
            : oldScore
              ? ("outdated" as const)
              : m.localteam_id
                ? ("in-progress" as const)
                : ("none" as const),
          scoreDisplay: null,
          scoreTotalColorClass: null,
          _slug: m.slug,
          _oldCatalogName: (oldScore ? scoreCatalogName(oldScore) : undefined) ?? null,
        };
      });

    return [...directusOnly, ...enrichedAreas];
  });

  // Expose groups with a pre-computed _flatIndex on every result so the palette
  // can do simple equality checks for keyboard-navigation highlighting.
  const groupsWithIndex = computed(() => {
    let idx = 0;
    return [
      {
        id: "municipalities" as const,
        label: $t("search.group.areas"),
        results: municipalitiesResults.value.map((r) => ({
          ...r,
          _type: "area" as const,
          _key: r.ars,
          _flatIndex: idx++,
        })),
      },
      {
        id: "content" as const,
        label: $t("search.group.content"),
        results: rawContentResults.value.map((r) => ({
          ...r,
          _type: "content" as const,
          _key: r.id,
          _flatIndex: idx++,
        })),
      },
    ];
  });

  const flatResults = computed(() =>
    groupsWithIndex.value.reduce<(typeof groupsWithIndex.value)[number]["results"][number][]>(
      (all, group) => [...all, ...group.results],
      [],
    ),
  );

  // --- Search logic ---

  const _doSearch = debounce(async (term: string, generation: number) => {
    if (generation !== searchGeneration) return;
    if (!term || !term.trim()) {
      rawAreaResults.value = [];
      rawDirectusMunis.value = [];
      rawContentResults.value = [];
      isLoading.value = false;
      return;
    }

    isLoading.value = true;
    try {
      const [areasResult, directusResult, contentResult] = await Promise.allSettled([
        // 1. StadtLandZahl (via the server-side proxy route that now uses REST)
        $fetch("/api/area-search", { query: { term: term.trim(), mode: "normal" } }).then((value) =>
          AreaListSchema.parse(value),
        ),

        // 2. Published municipalities matched by name via server route
        $fetch("/api/public/municipalities", {
          query: { search: term.trim(), limit: 8, sort: "name" },
        }).then((res) => MunicipalitiesResponseSchema.parse(res).municipalities),

        // 3. Meilisearch content
        $fetch(`/api/content-search?q=${encodeURIComponent(term.trim())}`),
      ]);

      // Build a localteam map from the Directus name-search result
      const directusMunis = directusResult.status === "fulfilled" ? directusResult.value : [];
      const municipalityByArs = new Map(directusMunis.filter((m) => m.ars).map((m) => [m.ars, m]));

      // For municipality ARS codes from StadtLandZahl not covered by the name search,
      // do a secondary lookup so hasLocalteam stays accurate.
      const nodes =
        areasResult.status === "fulfilled" ? (Array.isArray(areasResult.value) ? areasResult.value : []) : [];
      const uncoveredArs = nodes
        .filter((n) => (n.level ?? 4) >= 4 && n.ars && !municipalityByArs.has(n.ars))
        .map((n) => n.ars);
      if (uncoveredArs.length > 0) {
        try {
          const result = await $fetch("/api/public/area-municipalities", {
            query: { ars: uncoveredArs.join(",") },
          });
          MunicipalitiesResponseSchema.parse(result).municipalities.forEach((r) => {
            if (r.ars) municipalityByArs.set(r.ars, r);
          });
        } catch {
          /* silently ignore — falls back to slug-only detection */
        }
      }

      if (generation !== searchGeneration) return;
      rawAreaResults.value = nodes.map((n) => ({
        ...n,
        hasLocalteam: !!municipalityByArs.get(n.ars)?.localteam_id,
        directusCatalogStatus: municipalityByArs.get(n.ars) ?? null,
      }));
      rawDirectusMunis.value = directusMunis;
      rawContentResults.value =
        contentResult.status === "fulfilled" ? ContentResponseSchema.parse(contentResult.value).hits : [];
    } catch {
      if (generation !== searchGeneration) return;
      rawAreaResults.value = [];
      rawDirectusMunis.value = [];
      rawContentResults.value = [];
    } finally {
      if (generation === searchGeneration) isLoading.value = false;
    }
  }, 300);

  function search(term: string) {
    const generation = ++searchGeneration;
    if (term && term.trim()) isLoading.value = true;
    void _doSearch(term, generation);
  }

  function clear() {
    searchGeneration++;
    rawAreaResults.value = [];
    rawDirectusMunis.value = [];
    rawContentResults.value = [];
    isLoading.value = false;
    _doSearch.cancel();
  }

  return { groupsWithIndex, flatResults, isLoading, search, clear };
}
