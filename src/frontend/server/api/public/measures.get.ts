import { readItems } from '@directus/sdk'
import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
import { readMunicipalityCatalogs, catalogForRequest, publicMeasureFields } from '../../utils/municipalityPageData'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const measureFields = publicMeasureFields

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

  const limit = 501

  const measures = await client.request(readItems('measures', {
    filter,
    fields: measureFields,
    sort: ['measure_id'],
    limit,
  }))

  if (measures.length > 500) throw createError({ statusCode: 502, statusMessage: 'Measure limit exceeded' })
  return { measures: measures.map(m => pick(m, measureFields)), catalogVersion: selectedCatalog }
})
