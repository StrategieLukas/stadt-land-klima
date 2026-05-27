// @ts-nocheck
// This file uses dynamic imports and complex patterns that need gradual refactoring
// The full type conversion is tracked separately

import type { Accountability, Database, Logger, Schema, Services } from '@directus/types';

console.log("Extension loaded");

interface HookContext {
  action: (event: string, handler: (...args: any[]) => void) => void;
  filter: any;
  schedule: (cron: string, handler: () => Promise<void>) => void;
}

interface ExtensionContext {
  accountability: Accountability;
  services: Services;
  database: Database;
  getSchema: () => Promise<Schema>;
  logger: Logger;
}

const adminAccountability = { admin: true };

/** ---------- Utility Functions ---------- **/

const calculateScores = async (params: any, ctx: any) => {
  const { calculateScores: calcFunc } = await import("./calculateScores.ts");
  return await calcFunc(params, ctx);
};

const updateRanks = async ({ catalogVersionId }: { catalogVersionId: number }, { services, getSchema, logger }: { services: Services; getSchema: () => Promise<Schema>; logger: Logger }) => {
  logger.info(`Updating ranks for catalogVersionId=${catalogVersionId}`);
  const schema = await getSchema();
  const municipalityScoresService = new services.ItemsService("municipality_scores", {
    schema,
    accountability: { admin: true },
  });

  // Load all municipality_scores for this catalog version where the municipality is published AND more than 98% rated
  const scores = await municipalityScoresService.readByQuery({
    limit: -1,
    filter: {
      catalog_version: { _eq: catalogVersionId },
      municipality: { status: { _eq: "published" } },
      percentage_rated: { _gt: 98 }
    },
    fields: ["id", "score_total"],
  });

  if (!scores?.length) return logger.info(`[updateRanks] No published scores with percentage_rated > 98 found for catalogVersion=${catalogVersionId}, thus not recalculating scores`);

  // Sort and rank
  const ranked = scores
    .sort((a: any, b: any) => (b.score_total ?? 0) - (a.score_total ?? 0))
    .map((s: any, i: number, arr: any[]) => ({
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

const createEmptyRatingsForNewMunicipality = async (municipality: any, { services, getSchema, logger }: { services: Services; getSchema: () => Promise<Schema>; logger: Logger }) => {
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

  const toCreate = publishedMeasures.map((measure: any) => ({
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

const createEmptyScoresForMunicipality = async (municipality: any, { services, getSchema, logger }: { services: Services; getSchema: () => Promise<Schema>; logger: Logger }) => {
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
  const scoresToCreate = measureCatalogs.map((cv: any) => ({
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

const createEmptyRatingsForNewMeasure = async (measureUUID: number | string, catalogVersionId: number, ratingChoices: any, { services, getSchema, logger }: { services: Services; getSchema: () => Promise<Schema>; logger: Logger }) => {
  logger.info(`Creating empty ratings_measures for measure ${measureUUID}`);
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

  const toCreate = municipalities.map((mun: any) => ({
    measure_id: measureUUID,
    catalog_version: catalogVersionId,
    localteam_id: mun.localteam_id,
    status: "draft",
    approved: true,
    choices: ratingChoices,
    rating: null,
  }));

  // DO NOT EMIT EVENTS HERE FOR THE CREATIONS - We handle calculateScores and updateRanks in the calling function
  await ratingsService.createMany(toCreate, { emitEvents: false });
  logger.info(`[createEmptyRatingsForNewMeasure] Created ${toCreate.length} ratings for measure=${measureUUID} and catalogVersion=${catalogVersionId}`);
};

/** ---------- Handlers ---------- **/

const handleMunicipalityCreated = async (meta: any, ctx: any) => {
  const schema = await ctx.getSchema();
  const munService = new ctx.services.ItemsService("municipalities", { schema, accountability: adminAccountability });
  const municipality = await munService.readOne(meta.key);
  if (!municipality) return;

  await createEmptyScoresForMunicipality(municipality, ctx);
  await createEmptyRatingsForNewMunicipality(municipality, ctx);
};

const handleMeasureCreatedOrPublished = async (meta: any, ctx: any) => {
  ctx.logger.info("handleMeasureCreatedOrPublished");

  const isPublished = meta.payload.status === "published";
  ctx.logger.info("[DEBUG] Measure is being published in this change " + isPublished);
  if (!isPublished) return;

  const measureUUID = Array.isArray(meta.keys) ? meta.keys[0] : meta.key;
  ctx.logger.info(`Measureid ${measureUUID}`);

  let catalogVersionId = meta.payload.catalog_version;
  let ratingChoices = meta.payload.choices_rating;
  ctx.logger.info(`Catalog version from payload: ${catalogVersionId} | Rating choices from payload: ${ratingChoices}`);
  if (!catalogVersionId || !ratingChoices) {
    ctx.logger.info("Fetching measure as catalogVersion/ratingChoices are not in the update payload. This is normal for updates.");
    const schema = await ctx.getSchema();
    const measureService = new ctx.services.ItemsService("measures", { schema, accountability: adminAccountability });
    const measure = await measureService.readOne(measureUUID);
    if (!measure || !measure.catalog_version) {
      ctx.logger.error(`Unable to fetch newly created measure: ${measureUUID}`);
      return;
    }
    catalogVersionId = typeof measure.catalog_version === "object"
      ? measure.catalog_version.id
      : measure.catalog_version;
    ratingChoices = measure.choices_rating;
  }

  ctx.logger.info("Creating empty ratings for measure " + measureUUID + " and catalog_version " + catalogVersionId);
  await createEmptyRatingsForNewMeasure(measureUUID, catalogVersionId, ratingChoices, ctx);
  await calculateScores({ catalogVersionId }, ctx);
  await updateRanks({ catalogVersionId }, ctx);
};

const handleRatingsMeasureUpdatedOrCreated = async (meta: any, ctx: any) => {
  const schema = await ctx.getSchema();
  const ratingsService = new ctx.services.ItemsService("ratings_measures", { schema, accountability: adminAccountability });
  const ratingId = meta.key ?? meta.keys[0];
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
const safeCall = (fnName: string, fn: (...args: any[]) => Promise<void>) => async (meta: any, ctx: any) => {
  try {
    if (!meta || !meta.collection) {
      ctx.logger.warn(`[HOOK:${fnName}] meta missing or malformed: ${JSON.stringify(meta)}`);
    }

    await fn(meta, ctx);
  } catch (err: any) {
    ctx.logger.error(`[HOOK:${fnName}] Caught error: ${err?.message}`);
    ctx.logger.error(err?.stack ?? err);

    throw err;
  }
};

const syncAllMunicipalityScores = async ({ services, getSchema, logger }: { services: Services; getSchema: () => Promise<Schema>; logger: Logger }) => {
  const schema = await getSchema();

  const municipalityService = new services.ItemsService("municipalities", {
    schema,
    accountability: adminAccountability,
  });
  const catalogService = new services.ItemsService("measure_catalog", {
    schema,
    accountability: adminAccountability,
  });
  const scoresService = new services.ItemsService("municipality_scores", {
    schema,
    accountability: adminAccountability,
  });

  logger.info("[syncAllMunicipalityScores] Checking if municipality_scores is empty...");

  const existing = await scoresService.readByQuery({
    limit: 1,
    fields: ["id"],
  });

  const catalogs = await catalogService.readByQuery({ limit: -1 });

  if (!existing || existing.length == 0) {
    logger.info("[syncAllMunicipalityScores] municipality_scores is empty - creating new blank ratings");

    const municipalities = await municipalityService.readByQuery({ limit: -1 });

    if (!municipalities?.length || !catalogs?.length) {
      logger.warn("[syncAllMunicipalityScores] No municipalities or catalog versions found.");
      return;
    }

    const toCreate: any[] = [];
    for (const mun of municipalities) {
      for (const cv of catalogs) {
        toCreate.push({
          municipality: mun.id,
          catalog_version: cv.id,
          score_total: 0,
          percentage_rated: 0,
          score_agriculture: 0,
          score_buildings: 0,
          score_management: 0,
          score_energy: 0,
          score_industry: 0,
          score_transport: 0,
        });
      }
    }

    if (toCreate.length) {
      logger.info(`[syncAllMunicipalityScores] Creating ${toCreate.length} initial municipality_scores...`);
      await scoresService.createMany(toCreate);
    } else {
      logger.info("[syncAllMunicipalityScores] No entries to create (unexpected).");
      return;
    }
  } else {
    logger.info("[syncAllMunicipalityScores] municipality_scores already exist - only calculating scores and not creating any new ones.")
  }

  for (const cv of catalogs) {
    logger.info(`[syncAllMunicipalityScores] Calculating scores for catalog version ${cv.id}...`);
    await calculateScores({ catalogVersionId: cv.id }, { services, getSchema, logger });

    logger.info(`[syncAllMunicipalityScores] Updating ranks for catalog version ${cv.id}...`);
    await updateRanks({ catalogVersionId: cv.id }, { services, getSchema, logger });
  }

  logger.info("[syncAllMunicipalityScores] Initial sync completed successfully.");
};

// Automatically trigger once at startup
(async () => {
  try {
    await syncAllMunicipalityScores({ services, getSchema, logger });
  } catch (err: any) {
    logger.error(`[syncAllMunicipalityScores] Failed during startup: ${err.message}`);
    logger.error(err.stack);
  }
})();

// map handlers you already defined to safeCall wrappers
action("items.create", safeCall("items.create", async (meta, ctx) => {
  switch (meta.collection) {
    case "municipalities": return await handleMunicipalityCreated(meta, ctx);
    case "measures": return await handleMeasureCreatedOrPublished(meta, ctx);
    case "ratings_measures": return await handleRatingsMeasureUpdatedOrCreated(meta, ctx);
    default: return;
  }
}));

action("items.update", safeCall("items.update", async (meta, ctx) => {
  switch (meta.collection) {
    case "measures": return await handleMeasureCreatedOrPublished(meta, ctx);
    case "ratings_measures": return await handleRatingsMeasureUpdatedOrCreated(meta, ctx);
    default: return;
  }
}));

export default ({ action, filter }: HookContext, { accountability, services, database, getSchema, logger }: ExtensionContext) => {
  // The action and filter are already set up above
  // This export is needed for Directus to recognize the extension
};
