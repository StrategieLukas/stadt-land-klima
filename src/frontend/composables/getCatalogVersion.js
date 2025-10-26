export async function getCatalogVersion($directus, $readItems, route) {
  const versions = await $directus.request(
    $readItems("measure_catalog", {
      fields: ["id", "name", "isCurrentFrontend"],
      filter: { hidden: { _eq: false } },
      limit: -1,
    })
  );

  if (!versions?.length) throw new Error("No catalog versions available");

  const param = route.query.v;
  const matched = versions.find(v => v.name === param);
  if (matched) return matched;

  const defaults = versions.filter(v => v.isCurrentFrontend === true);
  if (defaults.length !== 1) {
    throw new Error("Exactly one version with isCurrentFrontend=true is required.");
  }

  return defaults[0];
}
