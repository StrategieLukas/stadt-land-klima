import { cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { PublicMunicipalitySchema } from "~/shared/contracts/search";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
import { readMunicipalityCatalogs, catalogForRequest } from '../../utils/municipalityPageData'

export default defineEventHandler(async event => {
  const client = createDirectusServerClient()
  const query = getQuery(event)
  const catalogs = await readMunicipalityCatalogs(client)
  const selectedCatalog = catalogForRequest(catalogs, query.v, false)
  const ars = typeof query.ars === 'string' ? query.ars.split(',').map(s => s.trim()).filter(Boolean) : []
  const slugs = typeof query.slugs === 'string' ? query.slugs.split(',').map(s => s.trim()).filter(Boolean) : []
  const arsPrefix = typeof query.arsPrefix === 'string' ? query.arsPrefix : ''
  if (ars.length > 200 || slugs.length > 200 || ars.some(code => !/^\d{2,12}$/.test(code)) || slugs.some(slug => !/^[a-z0-9-]{1,160}$/.test(slug)) || (arsPrefix && !/^\d{2}$/.test(arsPrefix))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid municipality selection' })
  }
  if (!ars.length && !slugs.length && !arsPrefix) return { municipalities: [] }
  const municipalities = await client.request(readItems('municipalities', {
    filter: { status: { _eq: 'published' }, ...(ars.length ? { ars: { _in: ars } } : {}), ...(slugs.length ? { slug: { _in: slugs } } : {}), ...(arsPrefix ? { ars: { _starts_with: arsPrefix } } : {}) },
    fields: ['id', 'ars', 'slug', 'name', 'status', 'localteam_id', 'image', 'image_credits'], limit: 10001,
  })).then(cmsRows)
  if (municipalities.length > 10000) throw createError({ statusCode: 502, statusMessage: 'Municipality limit exceeded' })
  const scores = municipalities.length ? await client.request(readItems('municipality_scores', {
    filter: { municipality: { _in: municipalities.map(row => row.id) }, catalog_version: { _in: catalogs.map(catalog => catalog.id) }, published: { _eq: true } },
    fields: ['municipality', 'published', 'percentage_rated', 'score_total', 'catalog_version', 'rank'], limit: 10001,
  })).then(cmsRows) : []
  if (scores.length > 10000) throw createError({ statusCode: 502, statusMessage: 'Score limit exceeded' })
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return { municipalities: parseCms(z.array(PublicMunicipalitySchema), municipalities.map(row => ({ ...row, scores: scores.filter(score => score.municipality === row.id).sort((a, b) => Number(b.catalog_version === selectedCatalog.id) - Number(a.catalog_version === selectedCatalog.id)).map(({ municipality: _municipality, ...score }) => ({ ...score, catalog_version: { id: score.catalog_version, name: catalogs.find(catalog => catalog.id === score.catalog_version)?.name } })) }))) }
})
