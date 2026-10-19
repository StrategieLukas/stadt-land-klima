import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const orgFields = ['id', 'name', 'logo', 'link']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  // Support batch lookup by IDs
  if (typeof query.ids === 'string' && query.ids) {
    const ids = query.ids.split(',').map(id => id.trim()).filter(Boolean)
    if (ids.length === 0) return { organisations: [] }

    const orgs = await client.request(readItems('organisations', {
      filter: { id: { _in: ids } },
      fields: orgFields,
      limit: 100,
    }))

    return { organisations: orgs.map(o => pick(o, orgFields)) }
  }

  const orgs = await client.request(readItems('organisations', {
    fields: orgFields,
    limit: 200,
  }))

  return { organisations: orgs.map(o => pick(o, orgFields)) }
})
