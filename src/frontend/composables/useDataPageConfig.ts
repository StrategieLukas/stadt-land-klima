import { DEFAULT_DATA_PAGE_CONFIG, normalizeDataPageConfig, type DataPageConfig } from "~/utils/dataPageVisibility";

export function useDataPageConfig() {
  const fetchContent = useContentFetch();
  return useAsyncData<DataPageConfig>(
    "data-page-config",
    async () => {
      const result = await fetchContent("/api/public/data-page-config");
      return normalizeDataPageConfig(result.config);
    },
    { default: () => ({ ...DEFAULT_DATA_PAGE_CONFIG }) },
  );
}
