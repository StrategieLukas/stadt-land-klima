export async function calculateScores(
  { municipalityIds = null, catalogVersionId },
  { services, getSchema, logger }
) {
  const schema = await getSchema();

  const ratingsService = new services.ItemsService("ratings_measures", {
    schema,
    accountability: { admin: true },
  });

  const municipalityScoresService = new services.ItemsService("municipality_scores", {
    schema,
    accountability: { admin: true },
  });

  logger.info("[calculateScores] Start recalculation");

  // 1️⃣ Get all measures in this catalog version
  const measuresService = new services.ItemsService("measures", {
    schema,
    accountability: { admin: true },
  });

  const measuresResp = await measuresService.readByQuery({
    limit: -1,
    filter: { catalog_version: { _eq: catalogVersionId } },
    fields: ["id", "category"],
  });

  const measureIds = measuresResp?.data?.map((m) => m.id) ?? [];
  if (!measureIds.length) {
    logger.info(`[calculateScores] No measures found for catalog_version=${catalogVersionId}`);
    return;
  }

  logger.info(`[calculateScores] Found ${measureIds.length} measures`);

  // 2️⃣ Build filter for ratings
  const filter = { measure_id: { _in: measureIds } };
  if (municipalityIds?.length) {
    filter["localteam_id.municipality_id"] = { _in: municipalityIds.flat() };
  }

  logger.info("Filter for ratings_measures:", filter);

  // 3️⃣ Fetch ratings
  const ratingsResp = await ratingsService.readByQuery({
    limit: -1,
    filter,
    fields: ["rating", { measure_id: ["category"] }, { localteam_id: ["municipality_id"] }],
  });

  const ratings = ratingsResp?.data ?? [];
  logger.info(`[calculateScores] Loaded ${ratings.length} ratings`);
  if (!ratings.length) return;

  // 4️⃣ Aggregate ratings by municipality
  const grouped = {};
  for (const r of ratings) {
    const munId = r.localteam_id?.municipality_id;
    if (!munId) continue;

    if (!grouped[munId]) {
      grouped[munId] = {
        municipality: munId,
        total: 0,
        count: 0,
        categories: {
          agriculture: [],
          buildings: [],
          management: [],
          energy: [],
          industry: [],
          transport: [],
        },
      };
    }

    if (r.rating != null) {
      grouped[munId].total += r.rating;
      grouped[munId].count++;
      const cat = r.measure_id?.category;
      if (cat && grouped[munId].categories[cat]) {
        grouped[munId].categories[cat].push(r.rating);
      }
    }
  }

  logger.info("[calculateScores] Aggregation complete");

  // 5️⃣ Update municipality_scores
  for (const munId of Object.keys(grouped)) {
    const g = grouped[munId];
    const avgTotal = g.count ? g.total / g.count : 0;

    const catAvgs = {};
    for (const [cat, vals] of Object.entries(g.categories)) {
      catAvgs[`score_${cat}`] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }

    const updatePayload = {
      score_total: avgTotal,
      percentage_rated: g.count ? Math.round((g.count / ratings.length) * 100) : 0,
      ...catAvgs,
    };

    const existingScoresResp = await municipalityScoresService.readByQuery({
      limit: 1,
      filter: {
        municipality: { _eq: munId },
        catalog_version: { _eq: catalogVersionId },
      },
    });

    const existingScores = existingScoresResp?.data ?? [];
    if (existingScores.length) {
      await municipalityScoresService.updateOne(existingScores[0].id, updatePayload);
      logger.info(`[calculateScores] Updated municipality_scores for mun=${munId}`);
    } else {
      logger.warn(`[calculateScores] No municipality_scores found for mun=${munId}, catalog_version=${catalogVersionId}`);
    }
  }

  logger.info(`[calculateScores] Recalculated scores for ${Object.keys(grouped).length} municipalities (catalog_version=${catalogVersionId})`);
}
