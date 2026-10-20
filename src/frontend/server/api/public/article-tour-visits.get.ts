import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)
  const articleId = query.articleId as string | undefined

  if (!articleId) {
    return { visits: [] }
  }

  const links = await client.request(readItems('success_project_tour_stops_articles', {
    filter: {
      articles_id: { _eq: articleId },
      stop: {
        status: { _eq: 'published' },
        tour: { status: { _eq: 'published' } },
      },
    },
    fields: [
      {
        stop: [
          'id', 'slug', 'title', 'location', 'start_date', 'end_date', 'report_status',
          {
            tour: [
              'id', 'slug', 'title', 'cover_image_credits',
              { cover_image: ['id', 'type'] },
            ],
          },
        ],
      },
    ],
    limit: -1,
  }))

  const visits = links
    .filter((link: any) => link.stop?.tour)
    .map((link: any) => ({
      stop: link.stop,
      tour: link.stop.tour,
      report: link.stop.report_status === 'published',
    }))
    .sort(
      (a: any, b: any) => new Date(a.stop.start_date).getTime() - new Date(b.stop.start_date).getTime(),
    )

  return { visits }
})
