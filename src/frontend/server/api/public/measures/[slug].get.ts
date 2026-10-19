import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, getQuery, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'
import { readMunicipalityCatalogs, catalogForRequest } from '../../../utils/municipalityPageData'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const measureDetailFields = [
  'id', 'measure_id', 'name', 'slug', 'sector', 'weight', 'image', 'image_credits',
  'description', 'description_about', 'description_benefit', 'description_contribution',
  'description_implementation', 'description_funding', 'description_legal',
  'description_evaluation_criteria', 'description_verification', 'description_tutorial',
  'impact', 'feasibility', 'feasibility_economical', 'feasibility_political',
]

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const slug = getRouterParam(event, 'slug')
  const query = getQuery(event)

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Measure not found' })
  }

  const catalogs = await readMunicipalityCatalogs(client)
  const selectedCatalog = catalogForRequest(catalogs, query.v, false)

  const measures = await client.request(readItems('measures', {
    filter: {
      slug: { _eq: slug },
      catalog_version: { _eq: selectedCatalog.id },
      status: { _eq: 'published' },
    },
    fields: measureDetailFields,
    limit: 1,
  }))

  if (!measures || measures.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Measure not found' })
  }

  return { measure: pick(measures[0], measureDetailFields), catalogVersion: selectedCatalog }
})
