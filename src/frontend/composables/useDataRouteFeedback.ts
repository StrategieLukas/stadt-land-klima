import { areaToSlug } from "~/composables/useAreaBySlug";
type AreaSeed = {
  prefix?: string | undefined;
  name?: string | undefined;
  ars?: string | undefined;
  level?: number | null | undefined;
  population?: number | string | null | undefined;
  geo_center?: { lat: number; lon: number } | null | undefined;
  geoCenter?: { lat: number; lon: number } | null | undefined;
  is_reasonable_for_municipal_rating?: boolean | undefined;
  isReasonableForMunicipalRating?: boolean | undefined;
};
type SeedArea = NonNullable<ReturnType<typeof normalizeSeedArea>>;
export function useDataRouteFeedback() {
  const { $t } = useNuxtApp();
  const isLoading = useState("data-route-feedback-loading", () => false);
  const label = useState("data-route-feedback-label", () => $t("data.route_loading"));
  const seedArea = useState<SeedArea | null>("data-route-feedback-seed-area", () => null);
  const installed = useState("data-route-feedback-installed", () => false);
  const router = useRouter();

  if (import.meta.client && !installed.value) {
    installed.value = true;
    router.beforeEach((to, from) => {
      if (to.fullPath !== from.fullPath && to.path.startsWith("/data")) {
        isLoading.value = true;
        label.value = $t("data.route_loading");
      }
    });
    router.afterEach(() => {
      window.setTimeout(() => {
        isLoading.value = false;
      }, 120);
    });
    router.onError(() => {
      isLoading.value = false;
    });
  }

  function start(nextLabel = $t("data.route_loading"), area: AreaSeed | null = null) {
    isLoading.value = true;
    label.value = nextLabel;
    const normalized = normalizeSeedArea(area);
    if (normalized) seedArea.value = normalized;
  }

  function stop() {
    isLoading.value = false;
  }

  function clearSeedArea() {
    seedArea.value = null;
  }

  return { isLoading, label, seedArea, start, stop, clearSeedArea };
}

function normalizeSeedArea(area: AreaSeed | null) {
  if (!area?.prefix || !area.name) return null;
  return {
    slug: areaToSlug(area.prefix, area.name),
    prefix: area.prefix,
    name: area.name,
    ars: area.ars ?? "",
    level: area.level ?? null,
    population: area.population ?? null,
    geo_center: area.geo_center ?? area.geoCenter ?? null,
    geoCenter: area.geoCenter ?? area.geo_center ?? null,
    is_reasonable_for_municipal_rating:
      area.is_reasonable_for_municipal_rating ?? area.isReasonableForMunicipalRating ?? true,
  };
}
