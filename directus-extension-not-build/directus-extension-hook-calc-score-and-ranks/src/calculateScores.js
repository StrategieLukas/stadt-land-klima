export async function calculateScores(
  { municipalityIds = null, catalogVersionId },
  { services, getSchema, logger }
) {
  const schema = await getSchema();

  const ratingsService = new services.ItemsService("ratings_measures", {
    schema,
    accountability: { admin: true },
  });

  const measuresService = new services.ItemsService("measures", {
    schema,
    accountability: { admin: true },
  });

  const municipalitiesService = new services.ItemsService("municipalities", {
    schema,
    accountability: { admin: true },
  });

  try {
    // --- Load measures that are published and belong to this catalog version
    const measures = await measuresService.readByQuery({
      limit: -1,
      filter: {
        catalog_version: { _eq: catalogVersionId },
        status: { _eq: "published" },
      },
      fields: ["id", "sector", "weight"],
    });

    if (!measures?.length) {
      logger.info(`[calculateScores] No published measures for catalog "${catalogVersionId}".`);
      return;
    }

    const measureIds = measures.map((m) => m.id);

    // --- Load municipalities
    const municipalities = await municipalitiesService.readByQuery({
      limit: -1,
      ...(municipalityIds?.length ? { filter: { id: { _in: municipalityIds } } } : {}),
      fields: ["id", "localteam_id", "name"],
    });

    if (!municipalities?.length) {
      logger.info(`[calculateScores] No municipalities to process.`);
      return;
    }

    logger.info(`[calculateScores] Processing ${municipalities.length} municipalities for ${catalogVersionId}.`);

    // --- Iterate per municipality
    for (const municipality of municipalities) {
      const localteamId = municipality.localteam_id;
      if (!localteamId) continue;

      const allRatings = await ratingsService.readByQuery({
        limit: -1,
        filter: {
          localteam_id: { _eq: localteamId },
          applicable: { _eq: true },
          approved: { _eq: true },
          measure_published: { _eq: true },
          rating: { _neq: null },
          measure_id: {         catalog_version: { _eq: catalogVersionId },
                                status: { _eq: "published" }, },
        },
        fields: ["rating", "measure_id"],
      });

      if (!allRatings?.length) {
        logger.info(`[calculateScores] No valid ratings for municipality "${municipality.name}".`);
        continue;
      }

      // --- Initialize scoring containers
      const scoreDict = {
        total: { numerator: 0, denominator: 0 },
        numberOfRated: { numerator: 0, denominator: 0 },
      };

      // Add dynamic sectors from measures
      for (const m of measures) {
        if (!scoreDict[m.sector]) {
          scoreDict[m.sector] = { numerator: 0, denominator: 0 };
        }
      }

      // --- Process all valid ratings
      for (const rating of allRatings) {
        const measure = measures.find((m) => m.id === rating.measure_id);
        if (!measure) continue;

        const { rating: score } = rating;
        const weight = measure.weight ?? 0;
        const sector = measure.sector;

        if (weight <= 0) continue;

        scoreDict.total.denominator += weight;
        scoreDict.numberOfRated.denominator += weight;
        if (scoreDict[sector]) scoreDict[sector].denominator += weight;

        logger.info(score);
        logger.info(rating);
        logger.info("hi");
        if (typeof score === "number" && !isNaN(score)) {
          scoreDict.total.numerator += score * weight;
          scoreDict.numberOfRated.numerator += weight;
          if (scoreDict[sector]) scoreDict[sector].numerator += score * weight;
        }
      }

      // --- Calculate normalized scores
      const scoresToPush = {};
      for (const [key, { numerator, denominator }] of Object.entries(scoreDict)) {
        const value = denominator > 0 ? numerator / denominator : 0;
        if (key === "numberOfRated") {
          scoresToPush.percentage_rated = value;
        } else {
          scoresToPush[`score_${key}`] = value;
        }
      }

      logger.info(
        {
          municipality: municipality.name,
          scoreDict,
          scoresToPush,
        },
        `[calculateScores] Completed scoring for "${municipality.name}".`
      );

      // --- Write to municipality
      await municipalitiesService.updateOne(municipality.id, scoresToPush);
    }

    logger.info(`[calculateScores] Completed calculations for catalog ${catalogVersionId}.`);
  } catch (e) {
    logger.error(e);
    throw e;
  }
}
