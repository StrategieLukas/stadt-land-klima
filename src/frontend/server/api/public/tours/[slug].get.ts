import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const tourDetailFields = ['id', 'slug', 'title', 'description', 'image', 'status', 'date_created']
const stopFields = ['id', 'slug', 'title', 'description', 'sort_order']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Tour not found' })
  }

  const tours = await client.request(readItems('success_project_tours', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: [...tourDetailFields, 'stops.id', 'stops.slug', 'stops.title', 'stops.description', 'stops.sort_order'],
    limit: 1,
  }))

  if (!tours || tours.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Tour not found' })
  }

  const tour = tours[0]
  const stops = (tour.stops || []).map((s: any) => pick(s, stopFields))

  return {
    tour: pick(tour, tourDetailFields),
    stops,
  }
})
