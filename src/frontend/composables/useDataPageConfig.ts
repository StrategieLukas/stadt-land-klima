import { DEFAULT_DATA_PAGE_CONFIG, normalizeDataPageConfig, type DataPageConfig } from "~/utils/dataPageVisibility";

export function useDataPageConfig() {
  return useAsyncData<DataPageConfig>(
    "data-page-config",
    async () => {
      const result = await $fetch("/api/public/data-page-config");
      return normalizeDataPageConfig(result.config);
    },
    { default: () => ({ ...DEFAULT_DATA_PAGE_CONFIG }) },
  );
}
