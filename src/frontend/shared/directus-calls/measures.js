export async function fetchMeasuresForCatalog($directus, $readItems, catalogVersionId, locale = null) {
  if(!$directus || !$readItems) throw Error("Did not pass $directus and $readItems to fetchMeasuresForCatalog");
  if(!catalogVersionId) throw Error("Tried to fetch measures for a null catalogVersionId");
  
  const query = {
    fields: ["*", "translations.*"],
    filter: { catalog_version: { _eq: catalogVersionId }}
  };

  if (locale) {
    query.deep = {
      translations: {
        _filter: {
          languages_code: { _eq: locale },
        },
      },
    };
  }

  return $directus.request($readItems("measures", query));
}