import { defineEventHandler, getRouterParam, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'
import { readPublicItems } from '../../../utils/publicItems'
import { readMunicipalityCatalogs, publicMeasureFields } from '../../../utils/municipalityPageData'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const municipalityFields = ['id', 'name', 'slug', 'ars', 'status', 'localteam_id', 'state', 'municipality_type', 'population', 'geolocation', 'image', 'image_credits', 'date_updated']
const scoreFields = ['id', 'catalog_version', 'published', 'percentage_rated', 'score_total', 'score_max', 'score_points', 'rank', 'score_buildings', 'score_energy', 'score_transport', 'score_industry', 'score_agriculture', 'score_management']
const measureFields = publicMeasureFields
const ratingFields = ['measure_id', 'rating', 'applicable', 'localteam_id']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const catalogName = getRouterParam(event, 'catalog')

  if (!catalogName || !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(catalogName)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid catalog' })
  }

  const catalogs = await readMunicipalityCatalogs(client)
  const selectedCatalog = catalogs.find(c => c.name === catalogName)
  if (!selectedCatalog) {
    throw createError({ statusCode: 404, statusMessage: 'Catalog not found' })
  }

  const [municipalities, scores, measures] = await Promise.all([
    readPublicItems('municipalities', {
      filter: { status: { _eq: 'published' } },
      fields: municipalityFields,
    }),
    readPublicItems('municipality_scores', {
      filter: {
        catalog_version: { _eq: selectedCatalog.id },
        published: { _eq: true },
        municipality: { status: { _eq: 'published' } },
      },
      fields: [...scoreFields, ...municipalityFields.map(field => `municipality.${field}`)],
    }),
    readPublicItems('measures', {
      filter: {
        catalog_version: { _eq: selectedCatalog.id },
        status: { _eq: 'published' },
      },
      fields: measureFields,
    }),
  ])
  const localteams = [...new Set(scores.map(score => score.municipality?.localteam_id).filter(Boolean))]
  const ratings = localteams.length ? await readPublicItems('ratings_measures', {
      filter: {
        measure_id: { catalog_version: { _eq: selectedCatalog.id }, status: { _eq: 'published' } },
        status: { _eq: 'published' },
        approved: { _eq: true },
        localteam_id: { _in: localteams },
      },
      fields: ratingFields,
    }) : []

  return {
    catalogVersion: selectedCatalog,
    municipalities: municipalities.map((m: any) => pick(m, municipalityFields)),
    scores: scores.map((s: any) => ({
      ...pick(s, scoreFields),
      municipality: s.municipality ? pick(s.municipality, municipalityFields) : null,
    })),
    measures: measures.map((m: any) => pick(m, measureFields)),
    ratings: ratings.map((r: any) => pick(r, ratingFields)),
  }
})
