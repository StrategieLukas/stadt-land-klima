/**
 * Nitro startup plugin: validates stadtlandzahl API configuration and
 * verifies the backend is reachable. Throws on failure so the server
 * refuses to start with a misconfigured or unreachable dependency.
 */
export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const serverUrl = config.stadtlandzahlServerBaseUrl as string | undefined
  const publicUrl = config.public.stadtlandzahlBaseUrl as string | undefined

  if (!publicUrl) {
    throw new Error(
      '[stadtlandzahl] STADTLANDZAHL_BASE_URL is not set. ' +
      'Set it to the public base URL of the stadtlandzahl API (e.g. https://data.stadt-land-klima.de).'
    )
  }

  // Server-side routes use the Docker-internal URL when available, falling back to the public URL.
  const checkUrl = serverUrl || publicUrl

  try {
    await $fetch(`${checkUrl}/api/areas/?limit=1`, { timeout: 8000 } as any)
    console.log(`[stadtlandzahl] API reachable at ${checkUrl}`)
  } catch (err) {
    throw new Error(
      `[stadtlandzahl] API is NOT reachable at ${checkUrl}. ` +
      `Check STADTLANDZAHL_SERVER_BASE_URL / STADTLANDZAHL_BASE_URL. Error: ${err}`
    )
  }
})
