export interface DataPageConfig {
  include_only: boolean;
  collection_ids: string[];
}

export const DEFAULT_DATA_PAGE_CONFIG: DataPageConfig = {
  include_only: false,
  collection_ids: [],
};

export function normalizeDataPageConfig(value: unknown): DataPageConfig {
  if (!value || typeof value !== "object") return DEFAULT_DATA_PAGE_CONFIG;
  const config = value as Partial<DataPageConfig>;
  return {
    include_only: config.include_only === true,
    collection_ids: Array.isArray(config.collection_ids)
      ? config.collection_ids.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function isCollectionVisible(id: string, config: DataPageConfig): boolean {
  if (id === "administrative-areas") return false;
  const selected = config.collection_ids.includes(id);
  return config.include_only ? selected : !selected;
}
