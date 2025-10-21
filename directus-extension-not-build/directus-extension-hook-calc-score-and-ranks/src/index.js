console.log("Extension read");

export default ({ action, filter }, { services, database, getSchema, logger }) => {
  const adminAccountability = { admin: true };

  /** ========== Utility functions ========== **/

  const updateRanks = async (database, logger) => {
    const sql = `
      BEGIN;
      SELECT FROM public.municipalities ORDER BY id FOR UPDATE;
      WITH RankedScores AS (
        SELECT id, DENSE_RANK() OVER (ORDER BY score_total DESC) AS place
        FROM public.municipalities
        WHERE status='published'
      )
      UPDATE public.municipalities AS m
      SET place = CASE WHEN m.status='published'
        THEN (SELECT r.place FROM RankedScores r WHERE r.id=m.id)
        ELSE -1
      END;
      COMMIT;
    `;
    await database.raw(sql);
    logger.info("[updateRanks] Municipality ranks updated.");
  };

  const seedRatingsForMeasure = async (measureId, catalogVersionId, { services, getSchema, logger }) => {
    const schema = await getSchema();
    const municipalitiesService = new services.ItemsService('municipalities', { schema, accountability: { admin: true } });
    const ratingsService = new services.ItemsService('ratings_measures', { schema, accountability: { admin: true } });

    const municipalities = (await municipalitiesService.readByQuery({ limit: -1 }))?.data ?? [];
    if (!municipalities.length) return;

    const toCreate = municipalities.map(mun => ({
      measure_id: measureId,
      catalog_version: catalogVersionId,
      localteam_id: mun.localteam_id,
      status: 'draft',
      approved: false,
      rating: null
    }));

    await ratingsService.createMany(toCreate);
    logger.info(`[SeedRatings] Created ${toCreate.length} rating stubs for measure=${measureId}`);
  };

  const seedRatingsForMunicipality = async (municipality, { services, getSchema, logger }) => {
    const schema = await getSchema();
    const measuresService = new services.ItemsService('measures', { schema, accountability: adminAccountability });
    const ratingsService = new services.ItemsService('ratings_measures', { schema, accountability: adminAccountability });

    const publishedMeasures = await measuresService.readByQuery({
      limit: -1,
      filter: { status: { _eq: "published" } }
    });

    if (!publishedMeasures.length) {
      logger.info(`[SeedRatings] No published measures found for new municipality ${municipality.name}`);
      return;
    }

    const toCreate = publishedMeasures.map(measure => ({
      measure_id: measure.id,
      catalog_version: typeof measure.catalog_version === 'object'
        ? measure.catalog_version.id
        : measure.catalog_version,
      localteam_id: municipality.localteam_id,
      status: 'draft',
      approved: false,
      rating: null
    }));

    await ratingsService.createMany(toCreate);
    logger.info(`[SeedRatings] Created ${toCreate.length} empty ratings for new municipality=${municipality.name}`);
  };

  /** ========== Handlers ========== **/

  const handleMunicipalityCreated = async (meta, { services, getSchema, logger }) => {
    logger.info("[Hook] municipalities.create triggered");

    const schema = await getSchema();
    const munService = new services.ItemsService('municipalities', { schema, accountability: adminAccountability });
    const measureCatalogService = new services.ItemsService('measure_catalog', { schema, accountability: adminAccountability });
    const municipalityScoresService = new services.ItemsService('municipality_scores', { schema, accountability: adminAccountability });

    const municipalityId = meta.key;
    const municipality = await munService.readOne(municipalityId);
    if (!municipality) return;

    // Create empty municipality_scores for all catalog versions
    const measureCatalogs = await measureCatalogService.readByQuery({ limit: -1 });
    const scoresToCreate = measureCatalogs.map(cv => ({
      municipality: municipality.id,
      catalog_version: cv.id,
      score_total: 0,
      percentage_rated: 0,
      score_agriculture: 0,
      score_buildings: 0,
      score_management: 0,
      score_energy: 0,
      score_industry: 0,
      score_transport: 0
    }));

    const createdScores = await municipalityScoresService.createMany(scoresToCreate);
    await munService.updateOne(municipality.id, { scores: createdScores });

    logger.info(`[Hook] Created ${createdScores.length} municipality_scores for ${municipality.name}`);

    // Create empty ratings for all published measures
    await seedRatingsForMunicipality(municipality, { services, getSchema, logger });
  };

  const handleMeasureCreated = async (meta, { services, getSchema, logger }) => {
    const schema = await getSchema();
    const measureService = new services.ItemsService('measures', { schema, accountability: adminAccountability });

    const measureId = Array.isArray(meta.keys) ? meta.keys[0] : meta.keys;
    const measure = await measureService.readOne(measureId);
    if (!measure || measure.status !== "published") return;

    const catalogVersionId = typeof measure.catalog_version === 'object' ? measure.catalog_version.id : measure.catalog_version;
    await seedRatingsForMeasure(measureId, catalogVersionId, { services, getSchema, logger });
  };

  const handleMeasureUpdated = async (meta, { services, getSchema, logger }) => {
    const schema = await getSchema();
    const measureService = new services.ItemsService('measures', { schema, accountability: adminAccountability });
    const measureId = Array.isArray(meta.keys) ? meta.keys[0] : meta.keys;
    const measure = await measureService.readOne(measureId);

    if (meta.payload?.status === "published" && measure.status === "published") {
      const catalogVersionId = typeof measure.catalog_version === 'object' ? measure.catalog_version.id : measure.catalog_version;
      await seedRatingsForMeasure(measureId, catalogVersionId, { services, getSchema, logger });
    }
  };

  const handleRatingsMeasureChanged = async (meta, { services, getSchema, database, logger }) => {
    const { calculateScores } = await import("./calculateScores.js"); // if you want to separate logic further
    await calculateScores({ keys: meta.keys }, { services, getSchema, logger });
    await updateRanks(database, logger);
  };

  /** ========== Hook bindings ========== **/

  action("items.create", async (meta, context) => {
    switch (meta.collection) {
      case "municipalities":
        return await handleMunicipalityCreated(meta, { services, getSchema, logger });
      case "measures":
        return await handleMeasureCreated(meta, { services, getSchema, logger });
      case "ratings_measures":
        return await handleRatingsMeasureChanged(meta, { services, getSchema, database, logger });
    }
  });

  action("items.update", async (meta, context) => {
    switch (meta.collection) {
      case "measures":
        return await handleMeasureUpdated(meta, { services, getSchema, logger });
      case "ratings_measures":
        return await handleRatingsMeasureChanged(meta, { services, getSchema, database, logger });
    }
  });

  filter("items.delete", async (meta, context) => {
    if (meta.collection !== "measures") return meta;

    const schema = await getSchema();
    const ratingsService = new services.ItemsService('ratings_measures', { schema, accountability: adminAccountability });

    for (const measureId of meta.keys) {
      const found = await ratingsService.readByQuery({
        filter: { measure_id: { _eq: measureId }, status: { _eq: 'published' } },
        limit: 1
      });
      if ((found?.data ?? []).length) {
        const err = new Error(`Cannot delete measure ${measureId}: published ratings exist.`);
        err.code = "FORBIDDEN";
        throw err;
      }
      await ratingsService.deleteByQuery({ filter: { measure_id: { _eq: measureId } } });
    }

    return meta;
  });
};
