import { readItems } from '@directus/sdk'

type DirectusClient = {
  request<T = unknown>(query: unknown): Promise<T>
}

type DirectusBlockRecord = {
  uuid: string
  bundle: string
  options?: Record<string, unknown> | null
  props?: Record<string, unknown> | null
}

export type BlokkliBlockItem = {
  uuid: string
  bundle: string
  options: Record<string, unknown>
  props: Record<string, unknown>
}

type DirectusBlocksQuery = {
  directus: DirectusClient
  entityType: string
  entityUuid?: string | null
  fieldName?: string
}

function normalizeDirectusBlock(block: DirectusBlockRecord): BlokkliBlockItem {
  return {
    uuid: block.uuid,
    bundle: block.bundle,
    options: block.options || {},
    props: block.props || {},
  }
}

export async function fetchDirectusBlocks({
  directus,
  entityType,
  entityUuid,
  fieldName = 'content',
}: DirectusBlocksQuery): Promise<BlokkliBlockItem[]> {
  if (!entityUuid) return []

  try {
    const query = readItems('blocks' as never, {
      filter: {
        entity_type: { _eq: entityType },
        entity_uuid: { _eq: entityUuid },
        field_name: { _eq: fieldName },
        status: { _neq: 'archived' },
      },
      sort: ['sort_order'],
    } as never)

    const blocks = await directus.request<DirectusBlockRecord[]>(query as unknown)
    return (blocks || []).map(normalizeDirectusBlock)
  } catch {
    return []
  }
}
