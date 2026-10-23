import { cmsRows } from "~/server/utils/cmsValue";
import { queryChoice, queryLimit } from "~/server/utils/publicQuery";
import { z } from "zod";
import { EventSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const filter: Record<string, unknown> = { status: { _eq: 'published' } }
  const category = queryChoice(query.category, ['internal', 'own_public', 'external', 'active_participation']);
  if (category) filter.event_category = {_eq: category};
  const excludeInternal = queryChoice(query.excludeInternal, ['true', 'false']);
  if (excludeInternal === 'true') filter._or = [{event_category: {_null: true}}, {event_category: {_neq: 'internal'}}];
  const limit = queryLimit(query.limit, 20, 200, true);
  const sort = queryChoice(query.sort, ['start_date', '-start_date', 'title', '-title'], '-start_date');

  const events = await client.request(readItems('events', {
    filter,
    fields: [
      'id', 'slug', 'title', 'description', 'start_date', 'end_date', 'date_only',
      'location', 'event_type', 'event_category', 'image_credits',
      { image: ['id', 'type'] },
    ],
    sort: [sort ?? '-start_date'],
    limit,
  })).then(cmsRows)

  return { events: parseCms(z.array(EventSchema), events) }
})
