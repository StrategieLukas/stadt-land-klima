import { readItems } from '@directus/sdk'
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
import { readMunicipalityCatalogs, catalogForRequest } from '../../utils/municipalityPageData'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const measureFields = ['id', 'measure_id', 'name', 'slug', 'sector', 'description', 'image', 'impact', 'feasibility', 'weight']

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const catalogs = await readMunicipalityCatalogs(client)
  const selectedCatalog = catalogForRequest(catalogs, query.v, false)

  const filter: Record<string, any> = {
    catalog_version: { _eq: selectedCatalog.id },
    status: { _eq: 'published' },
  }
  if (typeof query.sector === 'string' && query.sector) {
    filter.sector = { _eq: query.sector }
  }
  if (typeof query.search === 'string' && query.search) {
    filter._or = [
      { name: { _contains: query.search } },
      { description: { _contains: query.search } },
    ]
  }

  const limit = Math.min(Number(query.limit) || 50, 200)

  const measures = await client.request(readItems('measures', {
    filter,
    fields: measureFields,
    sort: ['name'],
    limit,
  }))

  return { measures: measures.map(m => pick(m, measureFields)), catalogVersion: selectedCatalog }
})
