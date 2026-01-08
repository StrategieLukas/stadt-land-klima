export async function fetchMunicipalityData(slug, catalogVersionId) {
    console.log("fetching municipality data for", slug, catalogVersionId);
    if(slug == null || catalogVersionId == null) {
        console.error(`Cannot fetchMunicipalityData: slug=${slug} | catalogVersionId=${catalogVersionId}`);
        return {};
    }
    const { $directus, $readItems } = useNuxtApp();

    return await useAsyncData(`municipality_${slug}_${catalogVersionId}`, async () => {
    const [municipalityScores, measures] = await Promise.all([
      $directus.request(
        $readItems("municipality_scores", {
          fields: ["*", { municipality: ["*"]}, { catalog_version: ["*"]}],
          filter: { catalog_version: { _eq: catalogVersionId }, municipality: {slug: { _eq: slug } }},
          limit: 1,
        }),
      ),
      $directus.request($readItems("measures", {})),
    ]);
  
    // Early return if municipalities is empty or null
    if (!municipalityScores || municipalityScores.length === 0) {
        console.warn(`Did not find municipalityScore for these parameters: slug=${slug} | catalogVersionId=${catalogVersionId}`)
        return {};
    }

    if(municipalityScores.length !== 1) {
        console.error(`Should have exactly one municipalityScore for a query with a slug and catalog version number: slug=${slug} | catalogVersionId=${catalogVersionId}`)
        return {};
    }
    const municipalityScore = municipalityScores[0]
  
    const ratingsMeasures = await $directus.request(
      $readItems("ratings_measures", {
        filter: {
            localteam_id: { _eq: municipalityScore.municipality.localteam_id },
            measure_id: { catalog_version: { _eq: catalogVersionId } }
          },
      }),
    );

    return {
      municipalityScore,
      measures,
      ratingsMeasures,
      sortedRatings: sortRatingsBySector(ratingsMeasures, measures),
    };
  });
}

// Sort ratings by sector and measure_id (used inside fetchMunicipalityData)
function sortRatingsBySector(ratingsMeasures, measures) {
    if(ratingsMeasures === null || measures === null || !Array.isArray(ratingsMeasures) || !Array.isArray(measures)) {
        return {};
    }
    const measureMap = new Map(measures.map((measure) => [measure.id, measure]));
    const dictMeasuresRatingSorted = {};

    for (const item of ratingsMeasures) {
        const measure = measureMap.get(item.measure_id);
        if (measure) {
        if(item.applicable && item.rating === null) {
            console.error(`Item ${item.rating} hat kein rating, obwohl applicable=true. Unbewertete Massnahmen sollten nicht ans Frontend geschickt werden.`)
            // Do not add the broken rating to the dict in this case
        } else {
            const { sector } = measure;
            item.measure = measure;
            if(!item.applicable) {
            item.rating = null
            }
            dictMeasuresRatingSorted[sector] = dictMeasuresRatingSorted[sector] || [];
            dictMeasuresRatingSorted[sector].push(item);
        }
        }
    }


    // Sort each sector's array: by rating (desc), then measure_id (asc)
    for (const sector in dictMeasuresRatingSorted) {
        dictMeasuresRatingSorted[sector].sort((a, b) => {
        const ratingA = a.rating;
        const ratingB = b.rating;

        // Handle nulls: treat null as lowest
        if (ratingA == null && ratingB != null) return 1;
        if (ratingA != null && ratingB == null) return -1;
        if (ratingA != null && ratingB != null) {
            if (ratingA !== ratingB) {
            return ratingB - ratingA; // Descending
            }
        }

        // Tiebreaker: sort by measure_id ascending
        if (a.measure_id < b.measure_id) return -1;
        if (a.measure_id > b.measure_id) return 1;
        return 0;
        });
    }

    return dictMeasuresRatingSorted;
}