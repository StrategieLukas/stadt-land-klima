import { DEFAULT_DATA_PAGE_CONFIG, normalizeDataPageConfig, type DataPageConfig } from '~/utils/dataPageVisibility';

export function useDataPageConfig() {
  const { $directus, $readSingleton } = useNuxtApp();
  return useAsyncData<DataPageConfig>('data-page-config', () =>
    $directus.request($readSingleton('data_page_config', {
      fields: ['include_only', 'collection_ids', 'under_construction', 'under_construction_explanation'],
    }))
      .then(normalizeDataPageConfig)
      .catch(() => ({ ...DEFAULT_DATA_PAGE_CONFIG })),
    { default: () => ({ ...DEFAULT_DATA_PAGE_CONFIG }) },
  );
}
