import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'
import { readMunicipalityCatalogs } from '../../../utils/municipalityPageData'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const municipalityFields = ['id', 'name', 'slug', 'localteam_id', 'state', 'municipality_type', 'population']
const scoreFields = ['id', 'published', 'percentage_rated', 'score_total', 'score_max', 'score_points', 'rank', 'localteam_id']
const measureFields = ['id', 'measure_id', 'name', 'sector', 'weight']
const ratingFields = ['measure_id', 'rating', 'applicable', 'localteam_id']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const catalogName = getRouterParam(event, 'catalog')

  if (!catalogName || !/^[a-z0-9-]{1,100}$/.test(catalogName)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid catalog' })
  }

  const catalogs = await readMunicipalityCatalogs(client)
  const selectedCatalog = catalogs.find(c => c.name === catalogName)
  if (!selectedCatalog) {
    throw createError({ statusCode: 404, statusMessage: 'Catalog not found' })
  }

  const [municipalities, scores, measures, ratings] = await Promise.all([
    client.request(readItems('municipalities', {
      filter: { status: { _eq: 'published' } },
      fields: municipalityFields,
      limit: 500,
    })),
    client.request(readItems('municipality_scores', {
      filter: {
        catalog_version: { _eq: selectedCatalog.id },
        published: { _eq: true },
      },
      fields: [...scoreFields, 'municipality.id', 'municipality.name', 'municipality.slug', 'municipality.state', 'municipality.municipality_type', 'municipality.population'],
      limit: 500,
    })),
    client.request(readItems('measures', {
      filter: {
        catalog_version: { _eq: selectedCatalog.id },
        status: { _eq: 'published' },
      },
      fields: measureFields,
      limit: 500,
    })),
    client.request(readItems('ratings_measures', {
      filter: {
        measure_id: { catalog_version: { _eq: selectedCatalog.id }, status: { _eq: 'published' } },
        status: { _eq: 'published' },
        approved: { _eq: true },
      },
      fields: ratingFields,
      limit: 50000,
    })),
  ])

  return {
    catalogVersion: selectedCatalog,
    municipalities: municipalities.map((m: any) => pick(m, municipalityFields)),
    scores: scores.map((s: any) => ({
      ...pick(s, scoreFields),
      municipality: s.municipality ? pick(s.municipality, ['id', 'name', 'slug', 'state', 'municipality_type', 'population']) : null,
    })),
    measures: measures.map((m: any) => pick(m, measureFields)),
    ratings: ratings.map((r: any) => pick(r, ratingFields)),
  }
})
