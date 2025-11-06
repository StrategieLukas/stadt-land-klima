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

  // By default, we show the current frontend version, unless showCurrentBackend is true (then use isCurrentBackend)
  const defaults = versions.filter(v => showCurrentBackend ? v.isCurrentBackend === true : v.isCurrentFrontend === true);
  if (defaults.length !== 1) {
    throw new Error(`Exactly one version with ${showCurrentBackend ? "isCurrentBackend" : "isCurrentFrontend"}===true is required.`);
  }

  return defaults[0];
}

// Fetches the catalog version and updates the URL to match it
export async function setCatalogVersionUrl(route, router, selectedCatalogVersion) {
  // Change the URL to match the catalog version, if it didn't to begin with
  console.log("TEST")
  if (process.client && route.query.v != selectedCatalogVersion.name) {
    console.log("TEST2")
      console.log("TEST3")
      router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  }
}