import { cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { MeasureSchema } from "~/shared/contracts/municipality";
import { CatalogSchema } from "~/shared/contracts/search";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { defineEventHandler, getRouterParam, getQuery, createError, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../../utils/directusServerClient'
import { readMunicipalityCatalogs, catalogForRequest, publicMeasureFields } from '../../../utils/municipalityPageData'




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
  })).then(cmsRows)

  if (!measures[0]) {
    throw createError({ statusCode: 404, statusMessage: 'Measure not found' })
  }

  const versions = await client.request(readItems('measures', {
    filter: { slug: { _eq: slug }, status: { _eq: 'published' }, catalog_version: { id: { _in: catalogs.map(catalog => catalog.id) } } },
    fields: ['id', 'measure_id', 'catalog_version.id', 'catalog_version.name'], limit: 101,
  })).then(cmsRows)
  if (versions.length > 100) throw createError({ statusCode: 502, statusMessage: 'Measure version limit exceeded' })
  return {
    measure: parseCms(MeasureSchema, measures[0]), catalogVersion: selectedCatalog,
    versions: parseCms(z.array(z.object({id: z.string(), measure_id: z.string(), catalog_version: CatalogSchema.pick({id: true, name: true})})), versions),
  }
})
