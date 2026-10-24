import type { MaybeRef } from "vue";
import {
  MunicipalitiesResponseSchema,
  scoreCatalogName,
  type PublicMunicipality,
  type SearchArea,
  type SearchMode,
  type AreaCta,
} from "~/shared/contracts/search";
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
import { ref, computed, isRef } from "vue";
import lodash from "lodash";
import { getScorePercentageColor, getStateFromArs } from "~/shared/utils";
import { isMunicipalityScoreComplete } from "~/shared/municipality-score-publishing";
interface AreaSearchOptions {
  mode?: MaybeRef<SearchMode>;
  catalogVersionName?: MaybeRef<string | null>;
  statusCatalogVersionId?: MaybeRef<string | null>;
}
const debounce = lodash.debounce.bind(lodash);

export function useAreaSearch({
  mode = "reasonable",
  catalogVersionName = null,
  statusCatalogVersionId = null,
}: AreaSearchOptions = {}) {
  const { $stadtlandzahlAPI } = useNuxtApp();

  // Allow mode and catalogVersionName to be passed as plain strings or reactive refs
  const modeRef = isRef(mode) ? mode : ref(mode);
  const catalogRef = isRef(catalogVersionName) ? catalogVersionName : ref(catalogVersionName);
  const statusCatalogRef = isRef(statusCatalogVersionId) ? statusCatalogVersionId : ref(statusCatalogVersionId);

  const rawResults = ref<SearchArea[]>([]);
  const isLoading = ref(false);
  let searchGeneration = 0;

  function enrichOne(area: SearchArea) {
    // level is returned by the new AREA_SEARCH_QUERY; fall back to 4 (municipality) for old data
    const level = area.level ?? 4;
    // City-states (Hamburg, Berlin, Bremen) are level 2 but still rateable municipalities
    const isMunicipality = level >= 4 || area.isReasonableForMunicipalRating === true;

    // Label shown in the subtitle line of each result row
    const stateLabel = isMunicipality ? (getStateFromArs(area.ars) ?? area.prefix) : null;
    const typeLabel = area.prefix; // administrative type prefix (Gemeinde, Kreisfreie Stadt, …)

    let ctaType: AreaCta = "area"; // level 1-3 → no CTA
    let scoreDisplay: string | null = null;
    let scoreTotalColorClass: string | null = null;
    let _slug: string | null = null;
    let _oldCatalogName: string | null = null;

    if (isMunicipality) {
      const allData = area.stadtlandklimaDataAll;

      if (catalogRef.value) {
        // With catalog context: check current catalog first, then fall back to older published rating
        const currentRating = allData.find((d) => d.measureCatalogName === catalogRef.value && d.slug);
        const storedStatus = area.directusCatalogStatus;
        const currentScore = storedStatus?.scores?.find(
          (score) =>
            (typeof score.catalog_version === "object" ? score.catalog_version?.id : score.catalog_version) ===
            statusCatalogRef.value,
        );
        const exactStatus = storedStatus?.scores
          ? {
              ...storedStatus,
              published: currentScore?.published === true,
              percentageRated: currentScore?.percentage_rated ?? null,
              scoreTotal: currentScore?.score_total ?? null,
            }
          : storedStatus;
        const oldRating = allData.find(
          (d) =>
            d.slug &&
            d.measureCatalogName !== catalogRef.value &&
            exactStatus?.completeCatalogNames.includes(d.measureCatalogName),
        );

        if (exactStatus?.published === true && Number(exactStatus.percentageRated) >= 100) {
          ctaType = "complete";
          _slug = exactStatus.slug ?? currentRating?.slug ?? null;
          const scoreTotal = exactStatus.scoreTotal ?? currentRating?.scoreTotal;
          scoreDisplay = scoreTotal != null ? `${Math.round(Number(scoreTotal))}%` : null;
          scoreTotalColorClass = scoreTotal != null ? getScorePercentageColor(Number(scoreTotal)) : null;
        } else if (oldRating) {
          ctaType = "outdated";
          _slug = oldRating.slug;
          _oldCatalogName = oldRating.measureCatalogName;
          scoreDisplay = oldRating.scoreTotal != null ? `${Math.round(Number(oldRating.scoreTotal))}%` : null;
          scoreTotalColorClass =
            oldRating.scoreTotal != null ? getScorePercentageColor(Number(oldRating.scoreTotal)) : null;
        } else if (exactStatus) {
          _slug = exactStatus.slug ?? currentRating?.slug ?? null;
          if (!exactStatus.hasLocalteam) ctaType = "none";
          else if (Number(exactStatus.percentageRated ?? 0) > 0) ctaType = "in-progress";
          else ctaType = "not-started";
        } else if (currentRating?.slug || area.hasLocalteam) {
          ctaType = "in-progress";
          _slug = currentRating?.slug ?? null;
        } else if (area.isReasonableForMunicipalRating) {
          ctaType = "none";
        }
      } else {
        // Wait for the catalog before claiming a rating is complete.
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

  /** Computed so enrichment updates when the selected catalog changes. */
  const results = computed(() => rawResults.value.map(enrichOne));

  const _doSearch = debounce(async (term: string, generation: number) => {
    if (generation !== searchGeneration) return;
    if (!term.trim()) {
      rawResults.value = [];
      isLoading.value = false;
      return;
    }
    isLoading.value = true;
    try {
      const nodes = await $stadtlandzahlAPI.searchAdministrativeAreas(term.trim(), modeRef.value);

      const requestedCatalogId = statusCatalogRef.value;
      if (requestedCatalogId) {
        const arsCodes = nodes.map((n) => n.ars).filter(Boolean);
        const candidateSlugs = [
          ...new Set(
            nodes.flatMap((n) =>
              n.stadtlandklimaDataAll.map((item) => item.slug).filter((slug): slug is string => Boolean(slug)),
            ),
          ),
        ];
        const identityFilters: { ars?: { _in: string[] }; slug?: { _in: string[] } }[] = [];
        if (arsCodes.length > 0) identityFilters.push({ ars: { _in: arsCodes } });
        if (candidateSlugs.length > 0) identityFilters.push({ slug: { _in: candidateSlugs } });

        let municipalities: PublicMunicipality[] = [];
        if (identityFilters.length > 0) {
          try {
            const arsCodes = identityFilters.find((f) => f.ars)?.ars?._in || [];
            const candidateSlugs = identityFilters.find((f) => f.slug)?.slug?._in || [];
            const query: Record<string, string> = {};
            if (arsCodes.length) query.ars = arsCodes.join(",");
            if (candidateSlugs.length) query.slugs = candidateSlugs.join(",");
            const catalogs = await getAllCatalogVersions();
            const selectedCatalog = catalogs.find((catalog) => catalog.id === requestedCatalogId);
            if (selectedCatalog) query.v = selectedCatalog.name;
            const result = await $fetch("/api/public/area-municipalities", { query });
            municipalities = MunicipalitiesResponseSchema.parse(result).municipalities;
          } catch {
            municipalities = [];
          }
        }

        if (generation !== searchGeneration) return;
        rawResults.value = nodes.map((node) => {
          const nodeSlugs = new Set(
            node.stadtlandklimaDataAll.map((item) => item.slug).filter((slug): slug is string => Boolean(slug)),
          );
          const municipality =
            municipalities.find((item) => item.slug && nodeSlugs.has(item.slug)) ??
            municipalities.find((item) => item.ars && item.ars === node.ars);
          const score = municipality?.scores.find((item) => {
            const catalogId =
              typeof item.catalog_version === "object" ? item.catalog_version?.id : item.catalog_version;
            return catalogId === requestedCatalogId;
          });

          return {
            ...node,
            directusCatalogStatus: {
              hasLocalteam: !!municipality?.localteam_id,
              slug: municipality?.slug ?? null,
              published: score?.published === true,
              percentageRated: score?.percentage_rated ?? null,
              scoreTotal: score?.score_total ?? null,
              scores: municipality?.scores ?? [],
              completeCatalogNames: (municipality?.scores ?? [])
                .filter(isMunicipalityScoreComplete)
                .map(scoreCatalogName)
                .filter((name): name is string => Boolean(name)),
            },
          };
        });
        return;
      }

      // Enrich municipality nodes with localteam_id from Directus so that
      // municipalities with a registered localteam but no rating slug yet
      // are shown as 'in-progress' rather than 'none'.
      const muniArsCodes = nodes
        .filter((n) => (n.level ?? 4) >= 4)
        .map((n) => n.ars)
        .filter(Boolean);

      const localteamByArs: Record<string, string | null | undefined> = {};
      if (muniArsCodes.length > 0) {
        try {
          const result = await $fetch("/api/public/area-municipalities", {
            query: { ars: muniArsCodes.join(",") },
          });
          MunicipalitiesResponseSchema.parse(result).municipalities.forEach((r) => {
            if (r.ars) localteamByArs[r.ars] = r.localteam_id;
          });
        } catch {
          // Silently ignore — falls back to slug-only detection
        }
      }

      if (generation !== searchGeneration) return;
      rawResults.value = nodes.map((n) => ({
        ...n,
        hasLocalteam: !!(n.ars && localteamByArs[n.ars]),
      }));
    } catch {
      if (generation !== searchGeneration) return;
      rawResults.value = [];
    } finally {
      if (generation === searchGeneration) isLoading.value = false;
    }
  }, 300);

  function search(term: string) {
    const generation = ++searchGeneration;
    if (term.trim()) isLoading.value = true;
    void _doSearch(term, generation);
  }

  function clear() {
    searchGeneration++;
    rawResults.value = [];
    isLoading.value = false;
    _doSearch.cancel();
  }

  return { results, isLoading, search, clear };
}
