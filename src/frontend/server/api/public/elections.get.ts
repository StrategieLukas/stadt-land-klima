import { cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { NullableTextSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
const PublicElectionSummarySchema = z.object({
  id: z.string(), is_public: z.literal(true), is_party_election: z.boolean(), descriptor: NullableTextSchema,
  custom_logo: NullableTextSchema, sharepic: NullableTextSchema, response_cutoff_date: NullableTextSchema,
  localteam: z.object({id: z.string(), name: NullableTextSchema, slug: NullableTextSchema}).nullable(),
});

const electionFields = ['id', 'is_public', 'is_party_election', 'descriptor', 'custom_logo', 'sharepic', 'response_cutoff_date', 'localteam']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()

  const elections = await client.request(readItems('elections', {
    filter: { is_public: { _eq: true } },
    fields: [...electionFields, 'localteam.id', 'localteam.name', 'localteam.slug'],
    sort: ['-date_created'],
    limit: 50,
  })).then(cmsRows)

  return { elections: parseCms(z.array(PublicElectionSummarySchema), elections) }
})
