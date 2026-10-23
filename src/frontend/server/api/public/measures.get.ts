import { cmsRows } from "~/server/utils/cmsValue";
import { queryChoice, queryText } from "~/server/utils/publicQuery";
import { sectors } from "~/shared/domain";
import { z } from "zod";
import { MeasureSchema } from "~/shared/contracts/municipality";

import { parseCms } from "~/server/utils/parseCms";
import { readItems } from '@directus/sdk'
import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { createDirectusServerClient } from '../../utils/directusServerClient'
import { readMunicipalityCatalogs, catalogForRequest, publicMeasureFields } from '../../utils/municipalityPageData'




const measureFields = publicMeasureFields

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  const client = createDirectusServerClient()
  const query = getQuery(event)

  const catalogs = await readMunicipalityCatalogs(client)
  const selectedCatalog = catalogForRequest(catalogs, query.v, false)

  const filter: Record<string, unknown> = {
    catalog_version: { _eq: selectedCatalog.id },
    status: { _eq: 'published' },
  }
  const sector = queryChoice(query.sector, sectors);
  if (sector) {
    filter.sector = { _eq: sector }
  }
  const search = queryText(query.search, 200);
  if (search) {
    filter._or = [
      { name: { _contains: search } },
      { description: { _contains: search } },
    ]
  }

  const limit = 501

  const measures = await client.request(readItems('measures', {
    filter,
    fields: measureFields,
    sort: ['measure_id'],
    limit,
  })).then(cmsRows)

  if (measures.length > 500) throw createError({ statusCode: 502, statusMessage: 'Measure limit exceeded' })
  return { measures: parseCms(z.array(MeasureSchema), measures), catalogVersion: selectedCatalog }
})
