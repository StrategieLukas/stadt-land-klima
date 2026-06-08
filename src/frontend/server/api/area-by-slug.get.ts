/**
 * Resolves a URL slug like "stadtkreis-karlsruhe" to a full area object
 * via the REST areas endpoint.
 *
 * geo_area (the boundary polygon) is stripped by default — it can be many MB
 * for Germany or states, and is only needed client-side. Pass includeGeo=true
 * to get it (e.g. for the sticky map panel on Kreis/Gemeinde pages).
 *
 * The REST API accepts the same slugified prefix-name form directly, so a
 * single request replaces the old multi-step GraphQL search loop.
 */

export default defineEventHandler(async (event) => {
  // event.url is h3 v2 only; at runtime nitropack uses h3 v1 where event.path is the path+query string
  const sp = new URLSearchParams((event.path ?? '').split('?')[1] ?? '')
  const slug = sp.get('slug') ?? ''
  const includeGeo = sp.get('includeGeo') === 'true'
  if (!slug.trim()) return null

  const config = useRuntimeConfig()
  const baseUrl = (config.stadtlandzahlServerBaseUrl as string) || (config.public.stadtlandzahlBaseUrl as string)

  try {
    const data = await $fetch<Record<string, unknown>>(`${baseUrl}/api/areas/${encodeURIComponent(slug)}/`)
    if (!includeGeo && data && typeof data === 'object') {
      const { geo_area: _geo, ...rest } = data
      return rest
    }
    return data
  } catch {
    return null
  }
})
