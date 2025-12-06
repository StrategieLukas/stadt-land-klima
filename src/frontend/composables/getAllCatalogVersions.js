// Returns all available catalog versions (not hidden)
export async function getAllCatalogVersions($directus, $readItems) {
  return await $directus.request(
    $readItems("measure_catalog", {
      fields: ["id", "name", "isCurrentFrontend", "isCurrentBackend"],
      filter: { hidden: { _eq: false } },
      limit: -1,
    })
  );
}