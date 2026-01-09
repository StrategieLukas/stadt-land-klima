export async function fetchRatingsMeasures($directus, $readItems, localteamId, catalogVersionId) {
  if(!localteamId) throw Error("Tried to fetch ratingsMeasures for a null localteamId");
  if(!catalogVersionId) throw Error("Tried to fetch ratingsMeasures for a null catalogVersionId");

  return await $directus.request(
      $readItems("ratings_measures", {
        filter: {
          localteam_id: { _eq: localteamId},
          measure_id: { catalog_version: { _eq: catalogVersionId } }
          },
      }),
    );
} 