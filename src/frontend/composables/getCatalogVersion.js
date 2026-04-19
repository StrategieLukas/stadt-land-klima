export async function getCatalogVersion($directus, $readItems, route, showCurrentBackend = false) {
  const versions = await $directus.request(
    $readItems("measure_catalog", {
      fields: ["id", "name", "isCurrentFrontend", "isCurrentBackend"],
      filter: { hidden: { _eq: false } },
      limit: -1,
    })
  );

  if (!versions?.length) throw new Error("No catalog versions available");

  const param = route.query.v;
  const matched = versions.find(v => v.name === param);
  if (matched) return matched;

  // If a preview token is present, always use the current backend version.
  // Otherwise respect the showCurrentBackend flag (defaults to isCurrentFrontend).
  const useBackend = showCurrentBackend || !!route.query.preview;
  const defaults = versions.filter(v => useBackend ? v.isCurrentBackend === true : v.isCurrentFrontend === true);
  if (defaults.length !== 1) {
    throw new Error(`Exactly one version with ${useBackend ? "isCurrentBackend" : "isCurrentFrontend"}===true is required.`);
  }

  return defaults[0];
}

export async function getCurrentFrontendCatalogVersion($directus, $readItems) {
  const response = await $directus.request(
    $readItems("measure_catalog", {
      fields: ["id", "name", "isCurrentFrontend", "isCurrentBackend"],
      filter: { hidden: { _eq: false }, isCurrentFrontend: { _eq: true } },
      limit: -1,
    })
  );
  return response?.[0];
}

// Fetches the catalog version and updates the URL to match it
export async function setCatalogVersionUrl(route, router, selectedCatalogVersion) {
  // Change the URL to match the catalog version, if it didn't to begin with
  if (process.client && route.query.v != selectedCatalogVersion.name) {
      router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  }
}
