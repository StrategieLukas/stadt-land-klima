export async function calculateScores(
  { municipalityIds = null, catalogVersionId },
  { services, getSchema, logger }
) {
  logger.info("Recalculating scores for " + (municipalityIds?.length ? municipalityIds?.length : "all") + " municipalities")
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

  const municipalityScoresService = new services.ItemsService("municipality_scores", {
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
      logger.info(`[calculateScores] No published measures for catalog ${catalogVersionId}.`);
      return;
    }

    // Map measures for quick lookup
    const measureById = new Map(measures.map((m) => [m.id, m]));

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

    logger.info(`[calculateScores] Processing ${municipalities.length} municipalities for catalog ${catalogVersionId}.`);

    // --- Iterate per municipality
    for (const municipality of municipalities) {
      const localteamId = municipality.localteam_id;
      if (!localteamId) continue;

      // fetch candidate ratings for this municipality & catalog version (do NOT filter rating != null)
      // preserve your nested measure_id filter shape (do not convert to measure_id._in)
      const allRatings = await ratingsService.readByQuery({
        limit: -1,
        filter: {
          localteam_id: { _eq: localteamId },
          applicable: { _eq: true },
          approved: { _eq: true },
          measure_published: { _eq: true },
          // keep your nested filter as you required
          measure_id: {
            catalog_version: { _eq: catalogVersionId },
            status: { _eq: "published" },
          },
        },
        fields: ["rating", "measure_id"],
      });

      if (!allRatings?.length) {
        logger.info(`[calculateScores] No candidate ratings for municipality "${municipality.name}".`);
        continue;
      }

      // --- Initialize score containers
      // For totals use two denominators:
      //   - denominator_all: total weight of all candidate measures (for percentage_rated denominator)
      //   - denominator_rated: total weight of rated measures (for score calculations denominator)
      const totals = {
        numerator_rated_sum: 0,     // sum(rating * weight) for rated entries
        denominator_rated: 0,       // sum(weight) for rated entries
        denominator_all: 0,         // sum(weight) for all candidate entries
      };

      // Per-sector containers: only track numerators & denominator_rated (we don't keep denominator_all per sector)
      const sectors = {};
      for (const m of measures) {
        if (!sectors[m.sector]) sectors[m.sector] = { numerator_rated: 0, denominator_rated: 0 };
      }

      // Also track total weight of rated items (for percentage numerator)
      let totalRatedWeight = 0;

      // --- Process all candidate ratings
      for (const r of allRatings) {
        // Normalize measure id (relation object or id)
        const measureId = typeof r.measure_id === "object" ? r.measure_id.id : r.measure_id;
        const measure = measureById.get(measureId);
        if (!measure) {
          // measure not part of current published measures for this catalog version
          continue;
        }

        const weight = measure.weight ?? 0;
        if (weight <= 0) {
          // ignore zero-weight measures entirely for both denominators
          continue;
        }

        const sector = measure.sector ?? "total";

        // Count this weight into denominator_all (for percentage calculation)
        totals.denominator_all += weight;

        // Convert rating string to numeric if present (ratings are 0..1)
        const raw = r.rating;
        const numeric = raw !== null && raw !== undefined ? parseFloat(raw) : NaN;

        // If rating is valid (non-null numeric), include in rated sums and sector sums
        if (!Number.isNaN(numeric)) {
          totals.numerator_rated_sum += numeric * weight;
          totals.denominator_rated += weight;
          totalRatedWeight += weight;

          if (!sectors[sector]) sectors[sector] = { numerator_rated: 0, denominator_rated: 0 };
          sectors[sector].numerator_rated += numeric * weight;
          sectors[sector].denominator_rated += weight;
        }
      }

      // --- Build output scores
      const scoresToPush = {};

      // percentage_rated = (weight of rated items) / (weight of all items) * 100
      scoresToPush.percentage_rated = totals.denominator_all > 0 ? (totalRatedWeight / totals.denominator_all) * 100 : 0;

      // score_total: (sum(rating*weight) / sum(weight of rated)) * 100  (rating scale 0..1 -> percent)
      if (totals.denominator_rated > 0) {
        scoresToPush.score_total = (totals.numerator_rated_sum / totals.denominator_rated) * 100;
      } else {
        scoresToPush.score_total = 0;
      }

      // per-sector scores as percentages
      for (const [sector, entry] of Object.entries(sectors)) {
        const val = entry.denominator_rated > 0 ? (entry.numerator_rated / entry.denominator_rated) * 100 : 0;
        scoresToPush[`score_${sector}`] = val;
      }

      // Log structure and result
//      logger.info(
//        {
//          municipality: municipality.name,
//          totals,
//          sectors,
//          scoresToPush,
//        },
//        `[calculateScores] Completed scoring for "${municipality.name}".`
//      );

      // --- Update municipality_scores record for this municipality & catalog version
      // --- Find the existing municipality_scores record
      const [scoreRecord] = await municipalityScoresService.readByQuery({
        limit: 1,
        filter: {
          municipality: { _eq: municipality.id },
          catalog_version: { _eq: catalogVersionId },
        },
        fields: ["id"],
      });

      if (scoreRecord?.id) {
        await municipalityScoresService.updateOne(scoreRecord.id, scoresToPush);
        logger.info(`[calculateScores] Completed scoring and updated municipality_scores for "${municipality.name}" (${scoreRecord.id}).`);
      } else {
        logger.warn(`[calculateScores] Completed scoring, but no municipality_scores record found for "${municipality.name}" and thus could not update scores!`);
      }

    }

    logger.info(`[calculateScores] Completed calculations for catalog ${catalogVersionId}.`);
  } catch (e) {
    logger.error(e);
    throw e;
  }
}
