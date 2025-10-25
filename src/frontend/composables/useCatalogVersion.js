import { ref} from "vue";

export function useCatalogVersion($directus, $readItems) {
  const route = useRoute();
  const router = useRouter();

  const measureCatalogVersionParam = computed(() => route.query.v);

  const { data: allCatalogVersions } = useAsyncData(
    "municipalities_ranking_catalog_version",
    () => {
      return $directus.request(
        $readItems("measure_catalog", {
          fields: ["id", "name", "isCurrentFrontend"],
          filter: { hidden: { _eq: false } },
          limit: -1,
        })
      );
    }
  );

  const selectedCatalogVersion = ref(null);

  watchEffect(() => {
    const list = allCatalogVersions.value;
    const param = measureCatalogVersionParam.value;

    if (!list) return;
    if (!Array.isArray(list) || list.length === 0) return;

    const matched = list.find((cv) => cv.name === param);
    if (matched) {
      selectedCatalogVersion.value = matched;
      return;
    }

    const defaults = list.filter((cv) => cv.isCurrentFrontend === true);

    if (defaults.length !== 1) {
      selectedCatalogVersion.value = null;
      throw createError({
        statusCode: 500,
        statusMessage:
          "Invalid catalog configuration: exactly one catalog version must have isCurrentFrontend = true",
      });
    }

    const fallback = defaults[0];
    selectedCatalogVersion.value = fallback;

    if (route.query.v !== fallback.name) {
      router.replace({
        query: { ...route.query, v: fallback.name },
      });
    }
  });

  return selectedCatalogVersion.value;
}
