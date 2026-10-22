import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

const TOUR_FIELDS = [
  'id', 'slug', 'title', 'status', 'introduction', 'closing_reflection',
  'featured_on_projects', 'cover_image_credits',
  { cover_image: ['id', 'type'] },
  { brand_logo: ['id', 'type'] },
]

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)
  const slug = query.slug as string | undefined

  if (!slug) {
    return { series: null }
  }

  const series = await client.request(readItems('success_project_tours', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
    fields: [...TOUR_FIELDS],
    limit: 1,
  }))

  return { series: series[0] || null }
})
