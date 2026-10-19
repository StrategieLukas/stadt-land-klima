import { createDirectus, rest, staticToken } from '@directus/sdk'
import { useRuntimeConfig } from '#app'

/**
 * Returns a Directus SDK client authenticated with the private frontend-server
 * token. Only use in server-side code (server/api, server/utils, server/plugins).
 * Never expose this client or its token to browser code.
 */
export function createDirectusServerClient() {
  const config = useRuntimeConfig()
  const directusUrl = (config.directusServerUrl as string) || 'http://directus:8055'
  const token = (config.directusFrontendServerToken as string) || (config.public.directusToken as string)

  if (!token) {
    throw new Error('Directus server token is not configured. Set DIRECTUS_FRONTEND_SERVER_TOKEN or DIRECTUS_TOKEN.')
  }

  return createDirectus(directusUrl).with(rest()).with(staticToken(token))
}
