import { Meilisearch } from 'meilisearch'

let client: Meilisearch | null = null

export function getMeilisearch(): Meilisearch {
  if (!client) {
    const config = useRuntimeConfig()
    client = new Meilisearch({
      host: (config.meilisearchUrl as string) || 'http://meilisearch:7700',
      apiKey: config.meilisearchMasterKey as string,
    })
  }
  return client
}
