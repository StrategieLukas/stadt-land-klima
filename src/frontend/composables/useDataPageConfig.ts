import { DEFAULT_DATA_PAGE_CONFIG, normalizeDataPageConfig, type DataPageConfig } from '~/utils/dataPageVisibility';

export function useDataPageConfig() {
  return useAsyncData<DataPageConfig>('data-page-config', async () => {
    const result = await $fetch('/api/public/data-page-config');
    return result.config ? normalizeDataPageConfig(result.config) : { ...DEFAULT_DATA_PAGE_CONFIG };
  }, { default: () => ({ ...DEFAULT_DATA_PAGE_CONFIG }) });
}
