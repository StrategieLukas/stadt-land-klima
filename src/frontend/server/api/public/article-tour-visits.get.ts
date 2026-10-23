import { cmsRows } from "~/server/utils/cmsValue";
import { queryText } from "~/server/utils/publicQuery";
import { z } from "zod";
import { ContentIdentitySchema, FileSchema, NullableTextSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)
  const articleId = queryText(query.articleId, 100)

  if (!articleId) {
    return { visits: [] }
  }

  const links = parseCms(z.array(z.object({stop: ContentIdentitySchema.extend({location: NullableTextSchema, start_date: z.string(), end_date: NullableTextSchema, report_status: z.string(), tour: ContentIdentitySchema.extend({cover_image_credits: NullableTextSchema, cover_image: FileSchema.nullable()})}).nullable()})), await client.request(readItems('success_project_tour_stops_articles', {
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
  })).then(cmsRows))

  const visits = links
    .flatMap(link => link.stop?.tour ? [link.stop] : [])
    .map((stop) => ({
      stop,
      tour: stop.tour,
      report: stop.report_status === 'published',
    }))
    .sort(
      (a, b) => new Date(a.stop.start_date).getTime() - new Date(b.stop.start_date).getTime(),
    )

  return { visits }
})
