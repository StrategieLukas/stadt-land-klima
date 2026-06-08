/**
 * GET /api/area-children
 *
 * Returns direct child administrative areas for a given parent area.
 *
 * Query params:
 *   level        - required, numeric administrative level of the children (2 = Bundesland, 4 = Kreis)
 *   arsPrefix    - optional, leading chars of ARS to filter (e.g. "08" for BW Kreise)
 *   includeGeo   - optional "true" to include geoArea polygon (large!)
 *   first        - optional, max results (default 200, max 500)
 */

export default defineEventHandler(async (event) => {
  // event.url is h3 v2 only; at runtime nitropack uses h3 v1 where event.path is the path+query string
  const sp = new URLSearchParams((event.path ?? '').split('?')[1] ?? '')
  const level      = sp.get('level')      ?? undefined
  const arsPrefix  = sp.get('arsPrefix')  ?? undefined
  const includeGeo = sp.get('includeGeo') ?? undefined
  const first      = sp.get('first')      ?? '200'

  if (!level) return []

  const config = useRuntimeConfig()
  const restUrl = (config.stadtlandzahlServerBaseUrl as string) || (config.public.stadtlandzahlBaseUrl as string)

  const numLevel = parseInt(level, 10)
  if (isNaN(numLevel)) return []

  const numFirst = Math.min(parseInt(String(first), 10) || 200, 500)
  const withGeo  = includeGeo === 'true'

  // Sanitise arsPrefix — only allow digits
  const safePrefix = arsPrefix ? String(arsPrefix).replace(/\D/g, '') : null

  try {
    const params: Record<string, string> = {
      level: String(numLevel),
      limit: String(numFirst),
      ordering: 'name',
    }
    if (safePrefix) params.ars = safePrefix

    const res = await $fetch<unknown>(`${restUrl}/api/areas/`, { params })

    // Handle both plain array and paginated { results: [...] } responses
    const raw: Record<string, unknown>[] = Array.isArray(res)
      ? (res as Record<string, unknown>[])
      : (((res as Record<string, unknown>)?.results ?? []) as Record<string, unknown>[])

    // /api/areas/?ars= filters by prefix, but can match sub-strings — keep only genuine prefixes
    let areas = safePrefix ? raw.filter(a => (a.ars as string)?.startsWith(safePrefix)) : raw

    // Normalise snake_case REST fields to the camelCase shape consumers expect
    areas = areas.map(a => {
      const out: Record<string, unknown> = { ...a }
      if ('geo_center' in a) { out.geoCenter = a.geo_center; delete out.geo_center }
      if ('geo_area' in a) {
        if (withGeo) out.geoArea = a.geo_area
        delete out.geo_area
      }
      if ('geo_area_km2' in a)                     { delete out.geo_area_km2 }
      if ('is_reasonable_for_municipal_rating' in a) { delete out.is_reasonable_for_municipal_rating }
      if ('stadtlandklima_data_all' in a)            { delete out.stadtlandklima_data_all }
      return out
    })

    return areas
  } catch {
    return []
  }
})
