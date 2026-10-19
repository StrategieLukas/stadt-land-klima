import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const seriesFields = ['id', 'slug', 'title', 'introduction', 'format', 'cover_image', 'cover_image_credits', 'brand_logo', 'closing_reflection']
const eventInSeriesFields = ['id', 'slug', 'title', 'start_date', 'end_date', 'location', 'event_type', 'image']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Event series not found' })
  }

  const series = await client.request(readItems('event_series', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: [...seriesFields, 'events.id', 'events.slug', 'events.title', 'events.start_date', 'events.end_date', 'events.location', 'events.event_type', 'events.image'],
    limit: 1,
  }))

  if (!series || series.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Event series not found' })
  }

  const s = series[0]
  const events = (s.events || []).map((e: any) => pick(e, eventInSeriesFields))

  return {
    series: pick(s, seriesFields),
    events,
  }
})
