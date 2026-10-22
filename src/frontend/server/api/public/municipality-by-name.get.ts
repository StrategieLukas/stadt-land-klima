import { z } from "zod";
import { PublicScoreSchema } from "~/shared/contracts/search";
import { parseCms } from "~/server/utils/parseCms";
import { queryText } from "~/server/utils/publicQuery";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { readMunicipalityCatalogs } from '../../utils/municipalityPageData'
import { createDirectusServerClient } from '../../utils/directusServerClient'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)
  const name = queryText(query.name, 200)

  if (!name) {
    return { municipality: null }
  }

  const results = await client.request(readItems('municipalities', {
    filter: { name: { _eq: name } },
    fields: [
      'slug', 'ars',
      { scores: ['catalog_version', 'published', 'percentage_rated'] },
    ],
    limit: 1,
  }))

  const municipality = parseCms(z.array(z.object({slug: z.string().nullable(), ars: z.string().nullable(), scores: z.array(PublicScoreSchema)})), results)[0]
  if (!municipality) return { municipality: null }
  const catalogs = await readMunicipalityCatalogs(client)
  const visibleCatalogs = new Set(catalogs.map(catalog => catalog.id))
  return { municipality: { slug: municipality.slug, ars: municipality.ars, scores: (municipality.scores ?? []).filter((score) => score.published === true && typeof score.catalog_version === "string" && visibleCatalogs.has(score.catalog_version)) } }
})
