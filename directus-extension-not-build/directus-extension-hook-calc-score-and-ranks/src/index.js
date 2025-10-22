console.log("Extension loaded");

export default ({ action, filter }, { services, database, getSchema, logger }) => {
  const adminAccountability = { admin: true };

  /** ---------- Utility Functions ---------- **/

  const calculateScores = async (params, ctx) => {
    const { calculateScores } = await import("./calculateScores.js");
    return await calculateScores(params, ctx);
  };

  const updateRanks = async ({ catalogVersionId }, { services, getSchema, logger }) => {
    const schema = await getSchema();
    const municipalityScoresService = new services.ItemsService("municipality_scores", {
      schema,
      accountability: { admin: true },
    });

    // Load all municipality_scores for this catalog version
    const scores = await municipalityScoresService.readByQuery({
      limit: -1,
      filter: {
        catalog_version: { _eq: catalogVersionId },
        municipality: { status: { _eq: "published" } },
      },
      fields: ["id", "score_total"],
    });

    if (!scores?.length) return logger.info(`[updateRanks] No published scores found for catalogVersion=${catalogVersionId}, thus not recalculating scores`);

    // Sort and rank
    const ranked = scores
      .sort((a, b) => (b.score_total ?? 0) - (a.score_total ?? 0))
      .map((s, i, arr) => ({
        id: s.id,
        rank:
          i === 0 || s.score_total !== arr[i - 1].score_total
            ? i + 1
            : arr[i - 1].rank,
      }));

    // Apply updates
    for (const r of ranked) {
      await municipalityScoresService.updateOne(r.id, { rank: r.rank });
    }

    logger.info(`[updateRanks] Updated ranks for ${ranked.length} municipality_scores`);
  };

  const createEmptyRatingsForMunicipality = async (municipality, { services, getSchema, logger }) => {
    const schema = await getSchema();
    const measuresService = new services.ItemsService("measures", { schema, accountability: adminAccountability });
    const ratingsService = new services.ItemsService("ratings_measures", {
      schema,
      accountability: adminAccountability,
    });

    const publishedMeasures = await measuresService.readByQuery({
      limit: -1,
      filter: { status: { _eq: "published" } },
    });

    if (!publishedMeasures?.length) {
      logger.info(`[createEmptyRatings] No published measures found for new municipality ${municipality.name}`);
      return;
    }

    const toCreate = publishedMeasures.map((measure) => ({
      measure_id: measure.id,
      catalog_version:
        typeof measure.catalog_version === "object"
          ? measure.catalog_version.id
          : measure.catalog_version,
      localteam_id: municipality.localteam_id,
      status: "draft",
      approved: true,
      choices: measure.choices_rating,
      rating: null,
    }));

    // Create silently (do not emit hooks)
    await ratingsService.createMany(toCreate, { emitEvents: false });
    logger.info(`[createEmptyRatings] Created ${toCreate.length} ratings_measures silently for municipality=${municipality.name}`);
  };

  const createEmptyScoresForMunicipality = async (municipality, { services, getSchema, logger }) => {
    const schema = await getSchema();
    const measureCatalogService = new services.ItemsService("measure_catalog", {
      schema,
      accountability: adminAccountability,
    });
    const municipalityScoresService = new services.ItemsService("municipality_scores", {
      schema,
      accountability: adminAccountability,
    });
    const munService = new services.ItemsService("municipalities", {
      schema,
      accountability: adminAccountability,
    });

    const measureCatalogs = await measureCatalogService.readByQuery({ limit: -1 });
    const scoresToCreate = measureCatalogs.map((cv) => ({
      municipality: municipality.id,
      catalog_version: cv.id,
      score_total: 0,
      percentage_rated: 0,
      score_agriculture: 0,
      score_buildings: 0,
      score_management: 0,
      score_energy: 0,
      score_industry: 0,
      score_transport: 0,
    }));

    const createdIds = await municipalityScoresService.createMany(scoresToCreate);
    await munService.updateOne(municipality.id, { scores: createdIds });

    logger.info(`[createEmptyScores] Created ${createdIds.length} municipality_scores for ${municipality.name}`);
  };

  const createEmptyRatingsForMeasure = async (measure, { services, getSchema, logger }) => {
    const schema = await getSchema();
    const municipalitiesService = new services.ItemsService("municipalities", {
      schema,
      accountability: adminAccountability,
    });
    const ratingsService = new services.ItemsService("ratings_measures", {
      schema,
      accountability: adminAccountability,
    });

    const municipalities = await municipalitiesService.readByQuery({ limit: -1 });
    if (!municipalities?.length) return;

    const toCreate = municipalities.map((mun) => ({
      measure_id: measure.id,
      catalog_version:
        typeof measure.catalog_version === "object"
          ? measure.catalog_version.id
          : measure.catalog_version,
      localteam_id: mun.localteam_id,
      status: "draft",
      approved: false,
      rating: null,
    }));

    await ratingsService.createMany(toCreate);
    logger.info(`[createEmptyRatingsForMeasure] Created ${toCreate.length} ratings for measure=${measure.id}`);
  };

  /** ---------- Handlers ---------- **/

  const handleMunicipalityCreated = async (meta, ctx) => {
    const schema = await getSchema();
    const munService = new services.ItemsService("municipalities", { schema, accountability: adminAccountability });
    const municipality = await munService.readOne(meta.key);
    if (!municipality) return;

    await createEmptyScoresForMunicipality(municipality, ctx);
    await createEmptyRatingsForMunicipality(municipality, ctx);
  };

  const handleMeasureCreatedOrPublished = async (meta, ctx) => {
    const schema = await getSchema();
    const measureService = new services.ItemsService("measures", { schema, accountability: adminAccountability });
    const measureId = Array.isArray(meta.keys) ? meta.keys[0] : meta.keys;
    const measure = await measureService.readOne(measureId);
    if (!measure || measure.status !== "published") return;

    await createEmptyRatingsForMeasure(measure, ctx);
    const catalogVersionId =
      typeof measure.catalog_version === "object"
        ? measure.catalog_version.id
        : measure.catalog_version;

    await calculateScores({ catalogVersionId }, ctx);
  };

  const handleRatingsMeasureUpdated = async (meta, ctx) => {
    const schema = await getSchema();
    const ratingsService = new services.ItemsService("ratings_measures", { schema, accountability: adminAccountability });
    const ratingId = meta.key ?? meta.keys[0]
    const rating = await ratingsService.readOne(ratingId, {
      fields: [
        "localteam_id.municipality_id",
        "measure_id.catalog_version"
      ]
    });

    const municipalityId = rating.localteam_id?.municipality_id;
    const catalogVersionId =
      typeof rating.measure_id.catalog_version === "object"
        ? rating.measure_id.catalog_version.id
        : rating.measure_id.catalog_version;

    if (!municipalityId || !catalogVersionId) return;

    await calculateScores({ municipalityIds: [municipalityId], catalogVersionId }, ctx);
    await updateRanks({ catalogVersionId }, ctx);
  };

  /** ---------- Hook Bindings ---------- **/

  // Adds extra diagnostics logging
  const safeCall = (fnName, fn) => async (meta, ctx) => {
    try {
      logger.info(`[HOOK] entering ${fnName} — collection=${meta.collection} key=${meta.key} keys=${meta.keys}`);
      // Basic introspection
      logger.info(`[HOOK] ctx keys: ${Object.keys(ctx || {}).join(", ")}`);
      logger.info(`[HOOK] services available: ${Object.keys(services || {}).slice(0,20).join(", ")}`);

      // Validate meta shape quickly
      if (!meta || !meta.collection) {
        logger.warn(`[HOOK:${fnName}] meta missing or malformed: ${JSON.stringify(meta)}`);
      }

      // Run the handler
      await fn(meta, { services, getSchema, database, logger });
    } catch (err) {
      // Full error dump with helpful runtime inspection
      logger.error(`[HOOK:${fnName}] Caught error: ${err?.message}`);
      logger.error(err?.stack ?? err);

      // Rethrow so Directus still sees the hook failure if you want — comment out to swallow
      throw err;
    }
  };

  // map handlers you already defined to safeCall wrappers
  action("items.create", safeCall("items.create", async (meta, ctx) => {
    switch (meta.collection) {
      case "municipalities": return await handleMunicipalityCreated(meta, ctx);
      case "measures": return await handleMeasureCreatedOrPublished(meta, ctx);
      case "ratings_measures": return await handleRatingsMeasureUpdated(meta, ctx);
      default: return;
    }
  }));

  action("items.update", safeCall("items.update", async (meta, ctx) => {
    switch (meta.collection) {
      case "measures": return await handleMeasureCreatedOrPublished(meta, ctx);
      case "ratings_measures": return await handleRatingsMeasureUpdated(meta, ctx);
      default: return;
    }
  }));

};
