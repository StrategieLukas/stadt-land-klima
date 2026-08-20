/**
 * Nitro startup plugin: validates stadtlandzahl API configuration and
 * verifies the backend is reachable. Throws on failure so the server
 * refuses to start with a misconfigured or unreachable dependency.
 */
export default defineNitroPlugin(async () => {
  const checkUrls = getStadtlandzahlBaseUrls()

  try {
    await fetchStadtlandzahl('/api/areas/', { params: { limit: 1 }, timeout: 8000 })
    console.log(`[stadtlandzahl] API reachable (configured: ${checkUrls.map(url => url.origin).join(', ')})`)
  } catch (err) {
    throw new Error(
      `[stadtlandzahl] API is NOT reachable at ${checkUrls.map(url => url.origin).join(', ')}. ` +
      `Check STADTLANDZAHL_SERVER_BASE_URL / STADTLANDZAHL_BASE_URL. Error: ${err}`
    )
  }
})
