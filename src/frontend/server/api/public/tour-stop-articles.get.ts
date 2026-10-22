import { queryText, queryIds } from "~/server/utils/publicQuery";
import { z } from "zod";
import { ProjectIdentitySchema, NullableTextSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const stopIdsParam = queryText(query.stopIds, 20200)
  if (!stopIdsParam) {
    return []
  }

  const stopIds = queryIds(stopIdsParam)
  if (!stopIds.length) {
    return []
  }

  const links = await client.request(readItems('success_project_tour_stops_articles', {
    filter: {
      stop: { id: { _in: stopIds }, status: { _eq: 'published' }, tour: { status: { _eq: 'published' } } },
      articles_id: { status: { _eq: 'published' } },
    },
    fields: ['stop', { articles_id: ['id', 'slug', 'title', 'profile_stage'] }],
    limit: -1,
  }))

  return parseCms(z.array(z.object({stop: z.string(), articles_id: ProjectIdentitySchema.extend({profile_stage: NullableTextSchema}).nullable()})), links)
})
