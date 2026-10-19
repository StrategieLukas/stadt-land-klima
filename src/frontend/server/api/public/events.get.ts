import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const eventListFields = ['id', 'slug', 'title', 'description', 'start_date', 'end_date', 'location', 'event_type', 'event_category', 'image', 'image_credits']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const filter: Record<string, any> = { status: { _eq: 'published' } }
  if (typeof query.category === 'string' && query.category) {
    filter.event_category = { _eq: query.category }
  }

  const limit = Math.min(Number(query.limit) || 20, 100)
  const sort = typeof query.sort === 'string' ? query.sort : '-start_date'

  const events = await client.request(readItems('events', {
    filter,
    fields: eventListFields,
    sort: [sort],
    limit,
  }))

  return { events: events.map(e => pick(e, eventListFields)) }
})
