import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, getQuery, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'
import { readMunicipalityCatalogs, catalogForRequest, publicMeasureFields } from '../../../utils/municipalityPageData'

type Row = Record<string, any>

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map(field => [field, row[field] ?? null]))
}

const measureDetailFields = publicMeasureFields

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
    fields: [...measureDetailFields.filter(field => field !== 'image'), 'image.id', 'image.image_credits'],
    limit: 1,
  }))

  if (!measures[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Measure not found' })
  }

  const versions = await client.request(readItems('measures', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' }, catalog_version: { id: { _in: catalogs.map(catalog => catalog.id) } } },
    fields: ['id', 'measure_id', 'catalog_version.id', 'catalog_version.name'], limit: 101,
  }))
  if (versions.length > 100) throw createError({ statusCode: 502, statusMessage: 'Measure version limit exceeded' })
  return {
    measure: pick(measures[0], measureDetailFields), catalogVersion: selectedCatalog,
    versions: versions.map(row => ({ id: row.id, measure_id: row.measure_id, catalog_version: pick(row.catalog_version, ['id', 'name']) })),
  }
})
