import { cmsRecord, cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { PublicMunicipalitySchema } from "~/shared/contracts/search";
import { parseCms } from "~/server/utils/parseCms";
import { queryChoice, queryLimit, queryText } from "~/server/utils/publicQuery";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
import { readPublicItems } from '../../utils/publicItems'
import { readMunicipalityCatalogs, catalogForRequest } from '../../utils/municipalityPageData'

type Row = Record<string, unknown>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const municipalityFields = ['id', 'slug', 'name', 'ars', 'status', 'localteam_id', 'state', 'population', 'municipality_type', 'image', 'image_credits', 'date_updated']
const scoreFields = ['score_total', 'score_max', 'percentage_rated', 'rank', 'published', 'catalog_version']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const catalogs = await readMunicipalityCatalogs(client)
  const selectedCatalog = catalogForRequest(catalogs, query.v, false)

  const filter: Record<string, unknown> = { status: { _eq: 'published' } }
  const search = queryText(query.search, 200);
  if (search) {
    filter._or = [
      { name: { _contains: search } },
      { slug: { _contains: search } },
    ]
  }

  const limit = queryLimit(query.limit, 50, 200)
  const sort = queryChoice(query.sort, ['name', '-name', 'slug', '-slug'], 'name') ?? 'name'

  const municipalities = await client.request(readItems('municipalities', {
    filter,
    fields: municipalityFields,
    sort: [sort],
    limit,
  })).then(cmsRows)

  if (municipalities.length === 0) {
    return { municipalities: [], catalogVersion: selectedCatalog }
  }

  const municipalityIds = municipalities.map(m => m.id).filter(Boolean)

  const scores = municipalityIds.length > 0
    ? await readPublicItems('municipality_scores', {
        filter: {
          municipality: { _in: municipalityIds },
          catalog_version: { _in: catalogs.map(catalog => catalog.id) },
          published: { _eq: true },
        },
        fields: [...scoreFields, 'municipality.id'],
      })
    : []

  const result = municipalities.map(m => {
    const matchingScores = scores.filter(score => cmsRecord(score.municipality ?? {}).id === m.id).map(score => ({
      ...pick(score, scoreFields),
      catalog_version: { id: score.catalog_version, name: catalogs.find(catalog => catalog.id === score.catalog_version)?.name },
    }))
    return {
      ...pick(m, municipalityFields),
      scores: matchingScores,
      score: matchingScores.find(score => score.catalog_version.id === selectedCatalog.id) ?? null,
    }
  })

  return { municipalities: parseCms(z.array(PublicMunicipalitySchema), result), catalogVersion: selectedCatalog }
})
