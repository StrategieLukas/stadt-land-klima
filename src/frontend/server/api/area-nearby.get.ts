import { queryText, queryLimit } from "~/server/utils/publicQuery";
import { z } from "zod";
import { AreaSchema } from "~/shared/contracts/search";
import { parseCms } from "~/server/utils/parseCms";
/**
 * GET /api/area-nearby?ars=<ars>&radius_km=40&levels=4,5,6
 *
 * Proxies to GET /api/areas/{ars}/nearby/ on the stadtlandzahl backend.
 * Returns { source_area, radius_km, count, areas: NearbyArea[] }.
 * Routing through a server route ensures SSR uses the Docker-internal URL.
 */

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const ars = queryText(query.ars, 12)
  if (ars && !/^\d+$/.test(ars)) throw createError({statusCode: 400, statusMessage: 'Invalid ARS'})
  const radiusKm = String(queryLimit(query.radius_km, 40, 1000))
  const limit = String(queryLimit(query.limit, 50, 500))
  const levels = queryText(query.levels, 20) ?? '4,5,6'
  if (!/^[1-6](,[1-6]){0,5}$/.test(levels)) throw createError({statusCode: 400, statusMessage: 'Invalid levels'})
  if (!ars) return { areas: [] }

  try {
    return parseCms(z.object({areas: z.array(AreaSchema)}), await fetchStadtlandzahl(`/api/areas/${encodeURIComponent(ars)}/nearby/`, {
      params: { radius_km: radiusKm, levels, limit },
    }))
  } catch {
    return { areas: [] }
  }
})
