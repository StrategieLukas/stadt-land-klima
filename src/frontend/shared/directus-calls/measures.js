export async function fetchMeasuresForCatalog($directus, $readItems, catalogVersionId) {
  if(!$directus || !$readItems) throw Error("Did not pass $directus and $readItems to fetchMeasuresForCatalog");
  if(!catalogVersionId) throw Error("Tried to fetch measures for a null catalogVersionId");
  return $directus.request($readItems("measures", {
    filter: { catalog_version: { _eq: catalogVersionId }}
  }));
}