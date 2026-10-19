import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const blockFields = ['id', 'bundle', 'props', 'sort_order', 'entity_type', 'entity_uuid', 'field_name', 'status']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const filter: Record<string, any> = { status: { _neq: 'archived' } }
  if (typeof query.entityUuid === 'string' && query.entityUuid) {
    filter.entity_uuid = { _eq: query.entityUuid }
  }
  if (typeof query.entityType === 'string' && query.entityType) {
    filter.entity_type = { _eq: query.entityType }
  }
  if (typeof query.fieldName === 'string' && query.fieldName) {
    filter.field_name = { _eq: query.fieldName }
  }

  const blocks = await client.request(readItems('blocks', {
    filter,
    fields: blockFields,
    sort: ['sort_order'],
    limit: 500,
  }))

  return { blocks: blocks.map(b => pick(b, blockFields)) }
})
