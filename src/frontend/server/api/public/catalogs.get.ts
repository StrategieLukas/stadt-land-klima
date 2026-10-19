import { createDirectusServerClient } from '../../utils/directusServerClient'
import { readMunicipalityCatalogs } from '../../utils/municipalityPageData'

export default defineEventHandler(async () => {
  try {
    return await readMunicipalityCatalogs(createDirectusServerClient())
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Catalog data unavailable' })
  }
})
