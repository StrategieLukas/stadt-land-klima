import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const filter: Record<string, any> = { status: { _eq: 'published' } }
  if (typeof query.category === 'string' && query.category) {
    filter.event_category = { _eq: query.category }
  }
  // Support excluding internal events
  if (query.excludeInternal === 'true') {
    filter._or = [
      { event_category: { _null: true } },
      { event_category: { _neq: 'internal' } },
    ]
  }

  const limitParam = query.limit
  const limit = limitParam === '-1' ? -1 : Math.min(Number(limitParam) || 20, 200)
  const sort = typeof query.sort === 'string' ? query.sort : '-start_date'

  const events = await client.request(readItems('events', {
    filter,
    fields: [
      'id', 'slug', 'title', 'description', 'start_date', 'end_date', 'date_only',
      'location', 'event_type', 'event_category', 'image_credits',
      { image: ['id', 'type'] },
    ],
    sort: [sort],
    limit,
  }))

  return { events }
})
