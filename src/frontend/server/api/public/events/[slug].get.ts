import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }

  const events = await client.request(readItems('events', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: [
      'id', 'slug', 'title', 'description', 'start_date', 'end_date', 'date_only',
      'location', 'event_type', 'event_category', 'image_credits',
      'registration_url', 'cta_label',
      { image: ['id', 'type'] },
      { series: ['slug', 'title', 'format'] },
    ],
    limit: 1,
  }))

  if (!events || events.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' })
  }

  const eventRow = events[0]

  // Fetch ordinary reports (non-tour-redirect news items linked to this event)
  const reports = await client.request(readItems('news_items', {
    filter: { report_event: { _eq: eventRow.id }, status: { _eq: 'published' }, is_tour_redirect: { _eq: false } },
    fields: ['slug'],
    limit: 1,
  }))

  // Fetch project links via events_articles junction table
  const links = await client.request(readItems('events_articles', {
    filter: { events_id: { _eq: eventRow.id } },
    fields: [{ articles_id: ['id', 'slug', 'title'] }],
    limit: -1,
  }))
  const projects = links.map(link => link.articles_id).filter(Boolean)

  return {
    event: eventRow,
    ordinaryReport: reports[0] || null,
    eventProjects: projects,
  }
})
