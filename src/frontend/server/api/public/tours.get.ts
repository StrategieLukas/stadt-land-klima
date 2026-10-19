import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const tourFields = ['id', 'slug', 'title', 'description', 'image', 'status', 'date_created']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const limit = Math.min(Number(query.limit) || 20, 100)

  const tours = await client.request(readItems('success_project_tours', {
    filter: { status: { _eq: 'published' } },
    fields: tourFields,
    sort: ['-date_created'],
    limit,
  }))

  return { tours: tours.map(t => pick(t, tourFields)) }
})
