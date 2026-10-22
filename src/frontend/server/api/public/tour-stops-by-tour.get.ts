import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

const REPORT_FIELDS = [
  'report_status', 'report_title', 'teaser', 'author', 'date_published', 'image_credits',
  { image: ['id', 'type'] },
  { media: ['id', 'sort', 'alt', 'caption', 'credit', { file: ['id', 'type'] }, { poster: ['id', 'type'] }] },
]

const STOP_FIELDS = [
  'id', 'slug', 'title', 'status', 'sort', 'location', 'state', 'geolocation',
  'start_date', 'end_date', 'date_only', 'visit_details', 'itinerary_image_credits',
  { itinerary_image: ['id', 'type'] },
  { tour: ['id', 'slug', 'title', 'status'] },
  ...REPORT_FIELDS,
]

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)
  const tourId = query.tourId as string | undefined

  if (!tourId) {
    return { stops: [] }
  }

  const stops = await client.request(readItems('success_project_tour_stops', {
    filter: {
      status: { _eq: 'published' },
      tour: { id: { _eq: tourId }, status: { _eq: 'published' } },
    },
    fields: [...STOP_FIELDS],
    limit: -1,
  }))

  return { stops }
})
