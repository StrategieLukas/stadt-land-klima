import { MeiliSearch } from 'meilisearch'

let client: MeiliSearch | null = null

export function getMeilisearch(): MeiliSearch {
  if (!client) {
    const config = useRuntimeConfig()
    client = new MeiliSearch({
      host: (config.meilisearchUrl as string) || 'http://meilisearch:7700',
      apiKey: config.meilisearchMasterKey as string,
    })
  }
  return client
}
