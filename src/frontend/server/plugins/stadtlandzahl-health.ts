/**
 * Nitro startup plugin: validates stadtlandzahl API configuration and
 * checks backend reachability in the background. Nitro 2 does not await
 * plugin promises; failures are reported through its rejection handler.
 */
// Nitro 2 declares void plugins; retain the existing asynchronous background setup. Owner: app maintainers.
// eslint-disable-next-line @typescript-eslint/no-misused-promises
export default defineNitroPlugin(async () => {
  const checkUrls = getStadtlandzahlBaseUrls();

  try {
    await fetchStadtlandzahl("/api/areas/", { params: { limit: 1 }, timeout: 8000 });
    console.log(`[stadtlandzahl] API reachable (configured: ${checkUrls.map((url) => url.origin).join(", ")})`);
  } catch (err) {
    throw new Error(
      `[stadtlandzahl] API is NOT reachable at ${checkUrls.map((url) => url.origin).join(", ")}. ` +
        `Check STADTLANDZAHL_SERVER_BASE_URL / STADTLANDZAHL_BASE_URL. Error: ${err instanceof Error ? err.message : "Unknown upstream error"}`,
      { cause: err },
    );
  }
});
