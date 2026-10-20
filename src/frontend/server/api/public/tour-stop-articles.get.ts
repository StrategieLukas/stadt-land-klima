import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const stopIdsParam = query.stopIds as string | undefined
  if (!stopIdsParam) {
    return []
  }

  const stopIds = stopIdsParam.split(',').map((id: string) => id.trim()).filter(Boolean)
  if (!stopIds.length) {
    return []
  }

  const links = await client.request(readItems('success_project_tour_stops_articles', {
    filter: {
      stop: { id: { _in: stopIds } },
      articles_id: { status: { _eq: 'published' } },
    },
    fields: ['stop', { articles_id: ['id', 'slug', 'title', 'profile_stage'] }],
    limit: -1,
  }))

  return links
})
