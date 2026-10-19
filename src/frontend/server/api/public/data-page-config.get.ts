import { readItems } from '@directus/sdk'
import { defineEventHandler, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  const client = createDirectusServerClient()

  const configs = await client.request(readItems('data_page_config', {
    fields: ['collection_ids', 'include_only', 'under_construction', 'under_construction_explanation'],
    limit: 1,
  }))

  return {
    config: configs[0] ? pick(configs[0], ['collection_ids', 'include_only', 'under_construction', 'under_construction_explanation']) : null,
  }
})
