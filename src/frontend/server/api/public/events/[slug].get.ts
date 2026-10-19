import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const eventDetailFields = [
  'id', 'slug', 'title', 'description', 'start_date', 'end_date', 'date_only',
  'location', 'event_type', 'event_category', 'image', 'image_credits',
  'registration_url', 'cta_label', 'series', 'series_order', 'projects', 'reports',
]

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }

  const events = await client.request(readItems('events', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: eventDetailFields,
    limit: 1,
  }))

  if (!events || events.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }

  return { event: pick(events[0], eventDetailFields) }
})
