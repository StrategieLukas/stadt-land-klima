import { areaToSlug } from "~/composables/useAreaBySlug.js";

export function useDataRouteFeedback() {
  const isLoading = useState("data-route-feedback-loading", () => false);
  const label = useState("data-route-feedback-label", () => "Klimadaten werden geladen...");
  const seedArea = useState("data-route-feedback-seed-area", () => null);
  const installed = useState("data-route-feedback-installed", () => false);
  const router = useRouter();

  if (process.client && !installed.value) {
    installed.value = true;
    router.beforeEach((to, from) => {
      if (to.fullPath !== from.fullPath && to.path.startsWith("/data")) {
        isLoading.value = true;
        label.value = "Klimadaten werden geladen...";
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

  function normalizeSeedArea(area) {
    if (!area?.prefix || !area?.name) return null;
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

  function start(nextLabel = "Klimadaten werden geladen...", area = null) {
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
