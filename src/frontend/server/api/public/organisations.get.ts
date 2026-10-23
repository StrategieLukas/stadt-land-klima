import { cmsRows } from "~/server/utils/cmsValue";
import { queryText, queryIds } from "~/server/utils/publicQuery";
import { z } from "zod";
import { OrganisationSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'

const orgFields = ['id', 'name', 'logo', 'link']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  // Support batch lookup by IDs
  if (queryText(query.ids, 20200)) {
    const ids = queryIds(query.ids)
    if (ids.length === 0) return { organisations: [] }

    const orgs = await client.request(readItems('organisations', {
      filter: { id: { _in: ids } },
      fields: orgFields,
      limit: 100,
    })).then(cmsRows)

    return { organisations: parseCms(z.array(OrganisationSchema), orgs) }
  }

  const orgs = await client.request(readItems('organisations', {
    fields: orgFields,
    limit: 200,
  })).then(cmsRows)

  return { organisations: parseCms(z.array(OrganisationSchema), orgs) }
})
