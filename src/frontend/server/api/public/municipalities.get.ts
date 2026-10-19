import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
import { readMunicipalityCatalogs, catalogForRequest } from '../../utils/municipalityPageData'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const municipalityFields = ['id', 'slug', 'name', 'state', 'population', 'municipality_type', 'image', 'image_credits', 'date_updated']
const scoreFields = ['score_total', 'score_max', 'percentage_rated', 'rank', 'published']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const catalogs = await readMunicipalityCatalogs(client)
  const selectedCatalog = catalogForRequest(catalogs, query.v, false)

  const filter: Record<string, any> = { status: { _eq: 'published' } }
  if (typeof query.search === 'string' && query.search) {
    filter._or = [
      { name: { _contains: query.search } },
      { slug: { _contains: query.search } },
    ]
  }

  const limit = Math.min(Number(query.limit) || 50, 200)
  const sort = typeof query.sort === 'string' ? query.sort : 'name'

  const municipalities = await client.request(readItems('municipalities', {
    filter,
    fields: municipalityFields,
    sort: [sort],
    limit,
  }))

  if (municipalities.length === 0) {
    return { municipalities: [], catalogVersion: selectedCatalog }
  }

  const municipalityIds = municipalities.map(m => m.id).filter(Boolean)

  const scores = municipalityIds.length > 0
    ? await client.request(readItems('municipality_scores', {
        filter: {
          municipality: { _in: municipalityIds },
          catalog_version: { _eq: selectedCatalog.id },
          published: { _eq: true },
        },
        fields: [...scoreFields, 'municipality.id'],
        limit: 500,
      }))
    : []

  const scoreByMunicipality = new Map<string, Row>()
  for (const score of scores) {
    const mId = typeof score.municipality === 'object' ? score.municipality.id : score.municipality
    scoreByMunicipality.set(String(mId), pick(score, scoreFields))
  }

  const result = municipalities.map(m => {
    const mId = m.id
    const score = mId ? scoreByMunicipality.get(String(mId)) : null
    return {
      ...pick(m, municipalityFields),
      score: score || null,
    }
  })

  return { municipalities: result, catalogVersion: selectedCatalog }
})
