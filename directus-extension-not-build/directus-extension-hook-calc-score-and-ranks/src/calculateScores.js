// calculateScores.js
export async function calculateScores(
  { municipalityIds = null, catalogVersionId },
  { services, getSchema, logger }
) {
  try {
    logger.info("[calculateScores] start");
    const schema = await getSchema();

    const ratingsService = new services.ItemsService("ratings_measures", {
      schema,
      accountability: { admin: true },
    });

    const municipalityScoresService = new services.ItemsService("municipality_scores", {
      schema,
      accountability: { admin: true },
    });

    const municipalitiesService = new services.ItemsService("municipalities", {
      schema,
      accountability: { admin: true },
    });

    const measuresService = new services.ItemsService("measures", {
      schema,
      accountability: { admin: true },
    });

    logger.info("test1: params", { municipalityIds, catalogVersionId });

    // --- Step 1: get measures for catalogVersionId ---
    logger.info("test2: fetching measures for catalogVersionId");
    const measures = await measuresService.readByQuery({
      limit: -1,
      filter: { catalog_version: { _eq: catalogVersionId } },
      fields: ["id", "category"],
    });
    logger.info("test2a: measures response length", Array.isArray(measures) ? measures.length : 0);

    if (!measures || !measures.length) {
      logger.info(`[calculateScores] No measures found for catalog_version=${catalogVersionId}`);
      return;
    }

    const measureIds = measures.map((m) => m.id);
    logger.info("test2b: measureIds count", measureIds.length);

    // --- Step 2: if municipalityIds provided, resolve localteam_ids ---
    let localteamIds = [];
    if (municipalityIds && municipalityIds.length) {
      logger.info("test3: fetching municipalities to resolve localteam_ids", municipalityIds);
      const munRecords = await municipalitiesService.readByQuery({
        limit: -1,
        filter: { id: { _in: municipalityIds.flat() } },
        fields: ["id", "localteam_id"],
      });
      logger.info("test3a: municipalities fetched", { count: Array.isArray(munRecords) ? munRecords.length : 0 });

      localteamIds = (munRecords || []).map((m) => m.localteam_id).filter(Boolean);
      logger.info("test3b: resolved localteamIds", localteamIds);
      if (!localteamIds.length) {
        logger.info("[calculateScores] No localteam_ids resolved from municipalityIds — nothing to do");
        return;
      }
    }

    // --- Step 3: build ratings filter (use measure_id and localteam_id only) ---
    const ratingsFilter = { measure_id: { _in: measureIds } };
    if (localteamIds.length) ratingsFilter.localteam_id = { _in: localteamIds };

    logger.info("test4: ratingsFilter", ratingsFilter);

    // --- Step 4: fetch ratings (dot-notation fields only!) ---
    logger.info("test5: fetching ratings");
    const ratings = await ratingsService.readByQuery({
      limit: -1,
      filter: ratingsFilter,
      // MUST use dot-notation strings; object-style fields cause `fieldKey.includes is not a function` here
      fields: ["rating", "measure_id.category", "localteam_id.municipality_id"],
    });
    logger.info("test5a: ratings fetched count", Array.isArray(ratings) ? ratings.length : 0);

    if (!ratings || !ratings.length) {
      logger.info(`[calculateScores] No ratings found for catalogVersionId=${catalogVersionId}`);
      return;
    }

    // --- Step 5: aggregate per municipality ---
    logger.info("test6: aggregating ratings");
    const grouped = {}; // munId -> { total, count, categories: { ... } }
    for (const r of ratings) {
      const munId = r?.localteam_id?.municipality_id;
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
        grouped[munId].count += 1;
        const cat = r?.measure_id?.category;
        if (cat && Object.prototype.hasOwnProperty.call(grouped[munId].categories, cat)) {
          grouped[munId].categories[cat].push(r.rating);
        }
      }
    }

    logger.info("test7: aggregation complete", { municipalities: Object.keys(grouped).length });

    // --- Step 6: update municipality_scores in bulk-ish (chunked) ---
    const groupedKeys = Object.keys(grouped);
    logger.info("test8: preparing updates", { groupedCount: groupedKeys.length });

    for (const munId of groupedKeys) {
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

      // find existing municipality_scores entry (SDK returns array)
      const existingScores = await municipalityScoresService.readByQuery({
        limit: 1,
        filter: {
          municipality: { _eq: munId },
          catalog_version: { _eq: catalogVersionId },
        },
        fields: ["id"],
      });

      const existingArr = existingScores || [];
      if (existingArr.length) {
        const id = existingArr[0].id;
        logger.info("test9: updating municipality_scores", { munId, id, updatePayload });
        await municipalityScoresService.updateOne(id, updatePayload);
      } else {
        logger.warn("test9: municipality_scores missing, skipping update", { munId, catalogVersionId });
      }
    }

    logger.info(`[calculateScores] done — recalculated ${Object.keys(grouped).length} municipalities (catalog_version=${catalogVersionId})`);
    return;
  } catch (err) {
    logger.error("[calculateScores] error", err?.message ?? String(err));
    logger.error(err?.stack ?? err);
    throw err;
  }
}
