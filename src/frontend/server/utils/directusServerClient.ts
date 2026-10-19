import { createDirectus, rest, staticToken } from '@directus/sdk'

/**
 * Returns a Directus SDK client authenticated with the private frontend-server
 * token. Only use in server-side code (server/api, server/utils, server/plugins).
 * Never expose this client or its token to browser code.
 *
 * Fails closed if the private server token is not configured.
 */
export function createDirectusServerClient() {
  const runtimeConfig = useRuntimeConfig()
  const directusUrl = (runtimeConfig.directusServerUrl as string) || 'http://directus:8055'
  const token = runtimeConfig.directusFrontendServerToken as string | undefined

  if (!token) {
    throw new Error('DIRECTUS_FRONTEND_SERVER_TOKEN is required for server-side Directus access.')
  }

  return createDirectus(String(directusUrl)).with(rest()).with(staticToken(token))
}
