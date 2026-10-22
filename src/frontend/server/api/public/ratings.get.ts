import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
import { readMunicipalityCatalogs, catalogForRequest } from '../../utils/municipalityPageData'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const ratingFields = ['measure_id', 'rating', 'applicable']
const measureRefFields = ['id', 'name', 'sector']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const catalogs = await readMunicipalityCatalogs(client)
  const selectedCatalog = catalogForRequest(catalogs, query.v, false)

  // Require a published municipality/localteam to look up ratings
  if (!query.municipalitySlug && !query.localteamId) {
    return { ratings: [] }
  }

  let localteamId: string | undefined

  if (query.municipalitySlug) {
    const municipalities = await client.request(readItems('municipalities', {
      filter: { slug: { _eq: query.municipalitySlug } },
      fields: ['localteam_id.id'],
      limit: 1,
    }))
    localteamId = municipalities[0]?.localteam_id?.id
  } else if (typeof query.localteamId === 'string') {
    localteamId = query.localteamId
  }

  if (!localteamId) {
    return { ratings: [] }
  }

  const publishedScores = await client.request(readItems('municipality_scores', {
    filter: { municipality: { localteam_id: { _eq: localteamId }, status: { _eq: 'published' } }, catalog_version: { _eq: selectedCatalog.id }, published: { _eq: true } },
    fields: ['id'], limit: 1,
  }))
  if (!publishedScores.length) return { ratings: [] }

  const filter: Record<string, any> = {
    localteam_id: { _eq: localteamId },
    measure_id: { catalog_version: { _eq: selectedCatalog.id }, status: { _eq: 'published' } },
    status: { _eq: 'published' },
    approved: { _eq: true },
  }

  if (typeof query.measureId === 'string') {
    filter.measure_id = {
      _and: [
        { catalog_version: { _eq: selectedCatalog.id } },
        { status: { _eq: 'published' } },
        { id: { _eq: query.measureId } },
      ],
    }
  }

  const ratings = await client.request(readItems('ratings_measures', {
    filter,
    fields: [...ratingFields, 'measure_id.id', 'measure_id.name', 'measure_id.sector'],
    limit: 500,
  }))

  const result = ratings.map((r: any) => ({
    ...pick(r, ratingFields),
    measure: r.measure_id ? pick(r.measure_id, measureRefFields) : null,
  }))

  return { ratings: result }
})
