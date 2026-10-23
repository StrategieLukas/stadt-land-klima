import { cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { NullableTextSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { queryText } from "~/server/utils/publicQuery";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
const LocalteamSchema = z.object({id: z.string(), name: NullableTextSchema, slug: NullableTextSchema, municipality_id: z.array(z.string()).nullable(), municipality_name: NullableTextSchema});

const localteamFields = ['id', 'name', 'slug', 'municipality_id', 'municipality_name']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const municipality = queryText(query.municipalitySlug)
  const filter = { status: { _eq: 'published' }, ...(municipality ? {municipality_name: {_eq: municipality}} : {}) }

  const localteams = await client.request(readItems('localteams', {
    filter,
    fields: localteamFields,
    sort: ['name'],
    limit: 200,
  })).then(cmsRows)

  return { localteams: parseCms(z.array(LocalteamSchema), localteams) }
})
