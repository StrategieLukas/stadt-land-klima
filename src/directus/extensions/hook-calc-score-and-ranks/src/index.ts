import type { Accountability, Database, Logger, Schema, Services } from '@directus/types';
import { calculateScores } from './calculateScores.ts';

interface HookContext {
  action: (event: string, handler: (meta: any, ctx: ExtensionContext) => Promise<void>) => void;
  filter: (event: string, handler: (...args: any[]) => any) => void;
  schedule: (cron: string, handler: () => Promise<void>) => void;
}

interface ExtensionContext {
  accountability: Accountability;
  services: Services;
  database: Database;
  getSchema: () => Promise<Schema>;
  logger: Logger;
}

type ServiceContext = Pick<ExtensionContext, 'services' | 'getSchema' | 'logger'>;

const adminAccountability = { admin: true } as const;
const municipalityNameCollator = new Intl.Collator('de-DE', {
  numeric: true,
  sensitivity: 'base',
});

type RankedMunicipalityScore = {
  id: number | string;
  score_total: number | string | null;
  municipality?: {
    name?: string | null;
  } | null;
};

const getScoreValue = (score: RankedMunicipalityScore): number => {
  const value = Number(score.score_total);
  return Number.isFinite(value) ? value : 0;
};

const compareMunicipalityScores = (
  a: RankedMunicipalityScore,
  b: RankedMunicipalityScore
): number => {
  const scoreDifference = getScoreValue(b) - getScoreValue(a);
  if (scoreDifference !== 0) return scoreDifference;

  const nameDifference = municipalityNameCollator.compare(
    a.municipality?.name ?? '',
    b.municipality?.name ?? ''
  );
  if (nameDifference !== 0) return nameDifference;

  return String(a.id).localeCompare(String(b.id));
};

/** ---------- Utility Functions ---------- **/

const updateRanks = async (
  { catalogVersionId }: { catalogVersionId: number },
  { services, getSchema, logger }: ServiceContext
): Promise<void> => {
  logger.info(`Updating ranks for catalogVersionId=${catalogVersionId}`);
  const schema = await getSchema();
  const municipalityScoresService = new services.ItemsService('municipality_scores', {
    schema,
    accountability: adminAccountability,
  });

  // Only rank published municipalities that are more than 98% rated
  const scores: RankedMunicipalityScore[] =
    await municipalityScoresService.readByQuery({
      limit: -1,
      filter: {
        catalog_version: { _eq: catalogVersionId },
        municipality: { status: { _eq: 'published' } },
        percentage_rated: { _gt: 98 },
      },
      fields: ['id', 'score_total', 'municipality.name'],
    });

  if (!scores?.length) {
    logger.info(
      `[updateRanks] No published scores with percentage_rated > 98 found for catalogVersion=${catalogVersionId}, skipping rank update.`
    );
    return;
  }

  // Sort descending by score_total, then alphabetically by municipality name.
  const sorted = [...scores].sort(compareMunicipalityScores);

  // Ranks follow the final sorted order; equal scores are ordered by municipality name.
  const ranked: Array<{ id: number | string; rank: number }> = [];
  for (let i = 0; i < sorted.length; i++) {
    ranked.push({ id: sorted[i].id, rank: i + 1 });
  }

  for (const r of ranked) {
    await municipalityScoresService.updateOne(r.id, { rank: r.rank });
  }

  logger.info(`[updateRanks] Updated ranks for ${ranked.length} municipality_scores.`);
};

const createEmptyRatingsForNewMunicipality = async (
  municipality: { id: number; localteam_id: number; name: string },
  { services, getSchema, logger }: ServiceContext
): Promise<void> => {
  const schema = await getSchema();
  const measuresService = new services.ItemsService('measures', {
    schema,
    accountability: adminAccountability,
  });
  const ratingsService = new services.ItemsService('ratings_measures', {
    schema,
    accountability: adminAccountability,
  });

  const publishedMeasures: any[] = await measuresService.readByQuery({
    limit: -1,
    filter: { status: { _eq: 'published' } },
  });

  if (!publishedMeasures?.length) {
    logger.info(
      `[createEmptyRatings] No published measures found for new municipality "${municipality.name}".`
    );
    return;
  }

  const toCreate = publishedMeasures.map((measure: any) => ({
    measure_id: measure.id,
    catalog_version:
      typeof measure.catalog_version === 'object'
        ? measure.catalog_version.id
        : measure.catalog_version,
    localteam_id: municipality.localteam_id,
    status: 'draft',
    approved: true,
    applicable: true,
    measure_published: true,
    choices: measure.choices_rating,
    rating: null,
  }));

  await ratingsService.createMany(toCreate, { emitEvents: false });
  logger.info(
    `[createEmptyRatings] Created ${toCreate.length} ratings_measures for municipality="${municipality.name}".`
  );
};

const createEmptyScoresForMunicipality = async (
  municipality: { id: number; name: string },
  { services, getSchema, logger }: ServiceContext
): Promise<void> => {
  const schema = await getSchema();
  const measureCatalogService = new services.ItemsService('measure_catalog', {
    schema,
    accountability: adminAccountability,
  });
  const municipalityScoresService = new services.ItemsService('municipality_scores', {
    schema,
    accountability: adminAccountability,
  });
  const munService = new services.ItemsService('municipalities', {
    schema,
    accountability: adminAccountability,
  });

  const measureCatalogs: any[] = await measureCatalogService.readByQuery({ limit: -1 });
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

  logger.info(
    `[createEmptyScores] Created ${createdIds.length} municipality_scores for "${municipality.name}".`
  );
};

const createEmptyRatingsForNewMeasure = async (
  measureId: number | string,
  catalogVersionId: number,
  ratingChoices: any,
  { services, getSchema, logger }: ServiceContext
): Promise<void> => {
  logger.info(`[createEmptyRatingsForNewMeasure] Creating ratings for measure=${measureId}, catalogVersion=${catalogVersionId}`);
  const schema = await getSchema();
  const municipalitiesService = new services.ItemsService('municipalities', {
    schema,
    accountability: adminAccountability,
  });
  const ratingsService = new services.ItemsService('ratings_measures', {
    schema,
    accountability: adminAccountability,
  });

  const municipalities: any[] = await municipalitiesService.readByQuery({ limit: -1 });
  if (!municipalities?.length) return;

  const toCreate = municipalities.map((mun: any) => ({
    measure_id: measureId,
    catalog_version: catalogVersionId,
    localteam_id: mun.localteam_id,
    status: 'draft',
    approved: true,
    applicable: true,
    measure_published: true,
    choices: ratingChoices,
    rating: null,
  }));

  // Do not emit events — calculateScores and updateRanks are handled by the caller
  await ratingsService.createMany(toCreate, { emitEvents: false });
  logger.info(
    `[createEmptyRatingsForNewMeasure] Created ${toCreate.length} ratings for measure=${measureId}, catalogVersion=${catalogVersionId}.`
  );
};

const syncAllMunicipalityScores = async ({ services, getSchema, logger }: ServiceContext): Promise<void> => {
  const schema = await getSchema();

  const municipalityService = new services.ItemsService('municipalities', {
    schema,
    accountability: adminAccountability,
  });
  const catalogService = new services.ItemsService('measure_catalog', {
    schema,
    accountability: adminAccountability,
  });
  const scoresService = new services.ItemsService('municipality_scores', {
    schema,
    accountability: adminAccountability,
  });

  logger.info('[syncAllMunicipalityScores] Checking if municipality_scores is empty...');

  const existing: any[] = await scoresService.readByQuery({ limit: 1, fields: ['id'] });
  const catalogs: any[] = await catalogService.readByQuery({ limit: -1 });

  if (!existing?.length) {
    logger.info('[syncAllMunicipalityScores] municipality_scores is empty — creating initial blank scores.');

    const municipalities: any[] = await municipalityService.readByQuery({ limit: -1 });

    if (!municipalities?.length || !catalogs?.length) {
      logger.warn('[syncAllMunicipalityScores] No municipalities or catalog versions found.');
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
    }
  } else {
    logger.info('[syncAllMunicipalityScores] municipality_scores already populated — skipping creation, recalculating scores.');
  }

  for (const cv of catalogs) {
    logger.info(`[syncAllMunicipalityScores] Calculating scores for catalog version ${cv.id}...`);
    await calculateScores({ catalogVersionId: cv.id }, { services, getSchema, logger });

    logger.info(`[syncAllMunicipalityScores] Updating ranks for catalog version ${cv.id}...`);
    await updateRanks({ catalogVersionId: cv.id }, { services, getSchema, logger });
  }

  logger.info('[syncAllMunicipalityScores] Initial sync completed successfully.');
};

/** ---------- Event Handlers ---------- **/

const handleMunicipalityCreated = async (meta: any, ctx: ExtensionContext): Promise<void> => {
  const schema = await ctx.getSchema();
  const munService = new ctx.services.ItemsService('municipalities', {
    schema,
    accountability: adminAccountability,
  });
  const municipality = await munService.readOne(meta.key);
  if (!municipality) return;

  await createEmptyScoresForMunicipality(municipality, ctx);
  await createEmptyRatingsForNewMunicipality(municipality, ctx);
};

const handleMeasureCreatedOrPublished = async (meta: any, ctx: ExtensionContext): Promise<void> => {
  ctx.logger.info('[handleMeasureCreatedOrPublished] Triggered');

  const isPublished = meta.payload?.status === 'published';
  ctx.logger.info(`[handleMeasureCreatedOrPublished] Status is published: ${isPublished}`);
  if (!isPublished) return;

  // On create events meta.key is set; on bulk update events meta.keys is an array
  const measureId: number | string =
    meta.key ?? (Array.isArray(meta.keys) ? meta.keys[0] : null);

  if (!measureId) {
    ctx.logger.error('[handleMeasureCreatedOrPublished] Could not determine measure id from meta.');
    return;
  }

  ctx.logger.info(`[handleMeasureCreatedOrPublished] Measure id: ${measureId}`);

  let catalogVersionId: number = meta.payload?.catalog_version;
  let ratingChoices: any = meta.payload?.choices_rating;

  if (!catalogVersionId || !ratingChoices) {
    ctx.logger.info(
      '[handleMeasureCreatedOrPublished] catalogVersion/ratingChoices not in payload — fetching from DB (normal for updates).'
    );
    const schema = await ctx.getSchema();
    const measureService = new ctx.services.ItemsService('measures', {
      schema,
      accountability: adminAccountability,
    });
    const measure = await measureService.readOne(measureId);
    if (!measure?.catalog_version) {
      ctx.logger.error(
        `[handleMeasureCreatedOrPublished] Unable to fetch measure: ${measureId}`
      );
      return;
    }
    catalogVersionId =
      typeof measure.catalog_version === 'object'
        ? measure.catalog_version.id
        : measure.catalog_version;
    ratingChoices = measure.choices_rating;
  }

  ctx.logger.info(
    `[handleMeasureCreatedOrPublished] Creating empty ratings for measure=${measureId}, catalogVersion=${catalogVersionId}`
  );
  await createEmptyRatingsForNewMeasure(measureId, catalogVersionId, ratingChoices, ctx);
  await calculateScores({ catalogVersionId }, ctx);
  await updateRanks({ catalogVersionId }, ctx);
};

const handleRatingsMeasureUpdatedOrCreated = async (meta: any, ctx: ExtensionContext): Promise<void> => {
  const schema = await ctx.getSchema();
  const ratingsService = new ctx.services.ItemsService('ratings_measures', {
    schema,
    accountability: adminAccountability,
  });

  // Support both single (meta.key) and bulk (meta.keys) events
  const ratingIds: (number | string)[] = meta.key
    ? [meta.key]
    : Array.isArray(meta.keys)
      ? meta.keys
      : [];

  if (!ratingIds.length) {
    ctx.logger.warn('[handleRatingsMeasureUpdatedOrCreated] No rating id(s) found in meta.');
    return;
  }

  // Read the first rating to determine municipality + catalog version
  // (all ratings in a batch update should share the same localteam/catalog)
  const rating = await ratingsService.readOne(ratingIds[0], {
    fields: ['localteam_id.municipality_id', 'measure_id.catalog_version'],
  });

  const municipalityId: number | undefined = rating?.localteam_id?.municipality_id;
  const rawCatalogVersion = rating?.measure_id?.catalog_version;
  const catalogVersionId: number | undefined =
    typeof rawCatalogVersion === 'object' ? rawCatalogVersion?.id : rawCatalogVersion;

  if (!municipalityId || !catalogVersionId) {
    ctx.logger.warn(
      `[handleRatingsMeasureUpdatedOrCreated] Missing municipalityId (${municipalityId}) or catalogVersionId (${catalogVersionId}), skipping.`
    );
    return;
  }

  await calculateScores({ municipalityIds: [municipalityId], catalogVersionId }, ctx);
  await updateRanks({ catalogVersionId }, ctx);
};

/** ---------- Safe wrapper for diagnostic logging ---------- **/

const safeCall = (
  fnName: string,
  fn: (meta: any, ctx: ExtensionContext) => Promise<void>
) => async (meta: any, ctx: ExtensionContext): Promise<void> => {
  try {
    if (!meta?.collection) {
      ctx.logger.warn(`[HOOK:${fnName}] meta missing or malformed: ${JSON.stringify(meta)}`);
    }
    await fn(meta, ctx);
  } catch (err: unknown) {
    const e = err as Error;
    ctx.logger.error(`[HOOK:${fnName}] Caught error: ${e?.message}`);
    ctx.logger.error(e?.stack ?? String(err));
    throw err;
  }
};

/** ---------- Hook Registration ---------- **/

export default (
  { action }: HookContext,
  { services, getSchema, logger }: ExtensionContext
) => {
  // Run initial sync at startup — all context variables are in scope here
  syncAllMunicipalityScores({ services, getSchema, logger }).catch((err: unknown) => {
    const e = err as Error;
    logger.error(`[syncAllMunicipalityScores] Failed during startup: ${e?.message}`);
    logger.error(e?.stack ?? String(err));
  });

  action(
    'items.create',
    safeCall('items.create', async (meta, ctx) => {
      switch (meta.collection) {
        case 'municipalities':
          return handleMunicipalityCreated(meta, ctx);
        case 'measures':
          return handleMeasureCreatedOrPublished(meta, ctx);
        case 'ratings_measures':
          return handleRatingsMeasureUpdatedOrCreated(meta, ctx);
        default:
          return;
      }
    })
  );

  action(
    'items.update',
    safeCall('items.update', async (meta, ctx) => {
      switch (meta.collection) {
        case 'measures':
          return handleMeasureCreatedOrPublished(meta, ctx);
        case 'ratings_measures':
          return handleRatingsMeasureUpdatedOrCreated(meta, ctx);
        default:
          return;
      }
    })
  );
};
