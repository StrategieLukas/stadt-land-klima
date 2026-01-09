export async function fetchMunicipalityScores($directus, $readItems, slug) {
  if(!$directus || !$readItems) throw Error("Did not pass $directus and $readItems to fetchMunicipalityScores");
  if(!slug) throw Error("Tried to fetch municipalityScores for a null slug");

  return $directus.request(
      $readItems("municipality_scores", {
      fields: ["*", { catalog_version: ["*"]}],
      filter: { municipality: { slug: { _eq: slug } }},
      }),
    );
}


export async function fetchFullMunicipalityScores($directus, $readItems, slug, catalogVersionId) {
  if(!$directus || !$readItems) throw Error("Did not pass $directus and $readItems to fetchFullMunicipalityScores");
  if(!slug) throw Error("Tried to fetch full municipalityScores for a null slug");
  if(!catalogVersionId) throw Error("Tried to fetch municipality scores for a null catalogVersionId");

  return $directus.request(
      $readItems("municipality_scores", {
        fields: ["*", { municipality: ["*"]}, { catalog_version: ["*"]}],
        filter: { catalog_version: { _eq: catalogVersionId }, municipality: { slug: { _eq: slug } }},
        limit: 1,
      }),
    );
}