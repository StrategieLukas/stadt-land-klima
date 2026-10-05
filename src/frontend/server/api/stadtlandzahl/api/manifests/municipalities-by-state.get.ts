const MANIFEST_MAX_AGE_SECONDS = 60 * 60;
const MANIFEST_STALE_MAX_AGE_SECONDS = 24 * 60 * 60;

const getMunicipalitiesManifest = defineCachedFunction(
  async () => {
    const manifest = await fetchStadtlandzahl("/api/manifests/municipalities-by-state", {
      headers: { "accept-encoding": "gzip" },
    });
    // Returning an object makes H3 pretty-print the large payload in dev. Cache
    // the compact representation so both dev and production send the same body.
    return JSON.stringify(manifest);
  },
  {
    name: "municipalities-by-state",
    group: "stadtlandzahl/manifests",
    // Bump when the cached representation changes.
    getKey: () => "v2",
    maxAge: MANIFEST_MAX_AGE_SECONDS,
    swr: true,
    staleMaxAge: MANIFEST_STALE_MAX_AGE_SECONDS,
  },
);

export default defineEventHandler(async (event) => {
  event.node.res.setHeader("Content-Type", "application/json; charset=utf-8");
  event.node.res.setHeader(
    "Cache-Control",
    `public, max-age=${MANIFEST_MAX_AGE_SECONDS}, stale-while-revalidate=${MANIFEST_STALE_MAX_AGE_SECONDS}`,
  );

  return await getMunicipalitiesManifest();
});
