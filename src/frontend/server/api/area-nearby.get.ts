/**
 * GET /api/area-nearby?ars=<ars>&radius_km=40&levels=4,5,6
 *
 * Proxies to GET /api/areas/{ars}/nearby/ on the stadtlandzahl backend.
 * Returns { source_area, radius_km, count, areas: NearbyArea[] }.
 * Routing through a server route ensures SSR uses the Docker-internal URL.
 */

export default defineEventHandler(async (event) => {
  const sp       = new URLSearchParams((event.path ?? '').split('?')[1] ?? '')
  const ars      = sp.get('ars')       ?? ''
  const radiusKm = sp.get('radius_km') ?? '40'
  const levels   = sp.get('levels')    ?? '4,5,6'
  const limit    = sp.get('limit')     ?? '50'

  if (!ars.trim()) return { areas: [] }

  const config  = useRuntimeConfig()
  const baseUrl = (config.stadtlandzahlServerBaseUrl as string) || (config.public.stadtlandzahlBaseUrl as string)

  try {
    return await $fetch(`${baseUrl}/api/areas/${encodeURIComponent(ars)}/nearby/`, {
      params: { radius_km: radiusKm, levels, limit },
    })
  } catch {
    return { areas: [] }
  }
})
