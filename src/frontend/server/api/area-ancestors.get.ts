/**
 * GET /api/area-ancestors?ars=<ars>
 *
 * Proxies to GET /api/areas/{ars}/ancestors/ on the stadtlandzahl backend.
 * Returns { ancestors: AncestorArea[] } ordered Bundesland → Kreis.
 * Routing through a server route ensures SSR uses the Docker-internal URL.
 */

export default defineEventHandler(async (event) => {
  const sp  = new URLSearchParams((event.path ?? '').split('?')[1] ?? '')
  const ars = sp.get('ars') ?? ''
  if (!ars.trim()) return { ancestors: [] }

  const config  = useRuntimeConfig()
  const baseUrl = (config.stadtlandzahlServerBaseUrl as string) || (config.public.stadtlandzahlBaseUrl as string)

  try {
    return await $fetch(`${baseUrl}/api/areas/${encodeURIComponent(ars)}/ancestors/`)
  } catch {
    return { ancestors: [] }
  }
})
