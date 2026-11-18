import type { MaybeRef } from "vue";
import {
  AreaListSchema,
  MunicipalitiesResponseSchema,
  ContentResponseSchema,
  type PublicMunicipality,
  type UnifiedArea,
  type ContentHit,
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
import { ref, computed, isRef, getCurrentScope, onScopeDispose } from "vue";
import lodash from "lodash";
import { getStateFromArs } from "~/shared/utils";
import { areaSearchPresentation } from "~/shared/areaSearchPresentation";
const debounce = lodash.debounce.bind(lodash);

export function useUnifiedSearch({ catalogVersionName = null }: { catalogVersionName?: MaybeRef<string | null> } = {}) {
  const fetchContent = useContentFetch();
  const { $t } = useNuxtApp();

  const catalogRef = isRef(catalogVersionName) ? catalogVersionName : ref(catalogVersionName);

  // Raw results from each source
  const rawAreaResults = ref<UnifiedArea[]>([]); // StadtLandZahl (already camelCase-normalised by /api/area-search)
  const rawDirectusMunis = ref<PublicMunicipality[]>([]); // Directus municipalities (published, matched by name)
  const rawContentResults = ref<ContentHit[]>([]); // Meilisearch hits
  const isLoading = ref(false);
  let searchGeneration = 0;
  let searchController: AbortController | undefined;

  function enrichArea(area: UnifiedArea) {
    const presentation = areaSearchPresentation(area, catalogRef.value);
    return {
      ...area,
      ...presentation,
      stateLabel: presentation.isMunicipality ? (getStateFromArs(area.ars) ?? area.prefix) : null,
      typeLabel: area.prefix,
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
      .map((municipality) =>
        enrichArea({
          ars: municipality.ars!,
          name: municipality.name,
          prefix: "",
          level: 5,
          population: null,
          isReasonableForMunicipalRating: true,
          stadtlandklimaDataAll: [],
          hasLocalteam: !!municipality.localteam_id,
          directusCatalogStatus: municipality,
        }),
      );

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
    const controller = new AbortController();
    searchController = controller;
    const options = { signal: controller.signal };
    const current = () => generation === searchGeneration;

    // Publish each provider immediately; an external area lookup must not hold up content.
    const contentRequest = fetchContent(`/api/content-search?q=${encodeURIComponent(term.trim())}`, options)
      .then((result) => {
        if (current()) rawContentResults.value = ContentResponseSchema.parse(result).hits;
      })
      .catch(() => {
        if (current()) rawContentResults.value = [];
      });
    const directusRequest = fetchContent("/api/public/municipalities", {
      ...options,
      query: { search: term.trim(), limit: 8, sort: "name" },
    })
      .then((result) => {
        const municipalities = MunicipalitiesResponseSchema.parse(result).municipalities;
        if (current()) rawDirectusMunis.value = municipalities;
        return municipalities;
      })
      .catch(() => {
        if (current()) rawDirectusMunis.value = [];
        return [];
      });
    const areaRequest = $fetch("/api/area-search", {
      ...options,
      query: { term: term.trim(), mode: "all" },
    }).then((value) => AreaListSchema.parse(value));

    const enrichedAreaRequest = (async () => {
      try {
        const nodes = await areaRequest;
        if (!current()) return;
        rawAreaResults.value = nodes;
        const directusMunis = await directusRequest;
        if (!current()) return;
        const municipalityByArs = new Map(directusMunis.filter((m) => m.ars).map((m) => [m.ars, m]));
        const updateAreas = () => {
          if (!current()) return;
          rawAreaResults.value = nodes.map((n) => ({
            ...n,
            hasLocalteam: !!municipalityByArs.get(n.ars)?.localteam_id,
            directusCatalogStatus: municipalityByArs.get(n.ars) ?? null,
          }));
        };
        updateAreas();
        const uncoveredArs = nodes
          .filter((n) => n.isReasonableForMunicipalRating && n.ars && !municipalityByArs.has(n.ars))
          .map((n) => n.ars);
        if (uncoveredArs.length) {
          try {
            const result = await fetchContent("/api/public/area-municipalities", {
              ...options,
              query: { ars: uncoveredArs.join(",") },
            });
            MunicipalitiesResponseSchema.parse(result).municipalities.forEach((municipality) => {
              if (municipality.ars) municipalityByArs.set(municipality.ars, municipality);
            });
            updateAreas();
          } catch {
            // Keep the initial results if optional local-team enrichment is unavailable.
          }
        }
      } catch {
        if (current()) rawAreaResults.value = [];
      }
    })();
    await Promise.allSettled([contentRequest, directusRequest, enrichedAreaRequest]);
    if (current()) isLoading.value = false;
  }, 300);

  function search(term: string) {
    const generation = ++searchGeneration;
    searchController?.abort();
    rawAreaResults.value = [];
    rawDirectusMunis.value = [];
    rawContentResults.value = [];
    isLoading.value = !!term.trim();
    void _doSearch(term, generation);
  }

  function clear() {
    searchGeneration++;
    searchController?.abort();
    rawAreaResults.value = [];
    rawDirectusMunis.value = [];
    rawContentResults.value = [];
    isLoading.value = false;
    _doSearch.cancel();
  }

  if (getCurrentScope()) onScopeDispose(clear);

  return { groupsWithIndex, flatResults, isLoading, search, clear };
}
