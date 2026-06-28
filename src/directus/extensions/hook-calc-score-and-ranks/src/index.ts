import type { Logger, Schema, Services } from '@directus/types';
import { calculateScores } from './calculateScores.ts';

interface HookContext {
  action: (event: string, handler: (meta: any, ctx?: unknown) => Promise<void>) => void;
  filter: (event: string, handler: (...args: any[]) => any) => void;
  schedule: (cron: string, handler: () => Promise<void>) => void;
}

interface ServiceContext {
  services: Services;
  getSchema: () => Promise<Schema>;
  logger: Logger;
}

const adminAccountability = { admin: true } as const;

type RankedMunicipalityScore = {
  id: number | string;
  score_total: number | string | null;
  published: boolean | null;
  rank: number | string | null;
};

/** ---------- Utility Functions ---------- **/

const updateRanks = async (
  { catalogVersionId }: { catalogVersionId: number | string },
  { services, getSchema, logger }: ServiceContext
): Promise<void> => {
  logger.info(`Updating ranks for catalogVersionId=${catalogVersionId}`);
  const schema = await getSchema();
  const municipalityScoresService = new services.ItemsService('municipality_scores', {
    schema,
    accountability: adminAccountability,
  });

  const scores: RankedMunicipalityScore[] =
    await municipalityScoresService.readByQuery({
      limit: -1,
      filter: {
        catalog_version: { _eq: catalogVersionId },
      },
      fields: ['id', 'score_total', 'published', 'rank'],
    });

  if (!scores?.length) {
    logger.info(
      `[updateRanks] No scores found for catalogVersion=${catalogVersionId}, skipping rank update.`
    );
    return;
  }

  const sortedScores = scores.filter((score) => score.published === true).sort(
    (a, b) => (Number(b.score_total) || 0) - (Number(a.score_total) || 0)
  );

  if (!sortedScores.length) {
    logger.info(
      `[updateRanks] No published scores found for catalogVersion=${catalogVersionId}; resetting ranks.`
    );
  }

  const ranked: Array<{ id: number | string; rank: number }> = [];
  for (let index = 0; index < sortedScores.length; index++) {
    const score = sortedScores[index];
    const previousScore = sortedScores[index - 1];
    const previousRank = ranked[index - 1]?.rank;
    ranked.push({
      id: score.id,
      rank:
        index === 0 || score.score_total !== previousScore.score_total
          ? index + 1
          : previousRank ?? index + 1,
    });
  }

  const rankById = new Map(ranked.map((entry) => [String(entry.id), entry.rank]));
  let updated = 0;

  for (const score of scores) {
    const nextRank = rankById.get(String(score.id)) ?? -1;
    if (Number(score.rank) === nextRank) continue;
    await municipalityScoresService.updateOne(score.id, { rank: nextRank });
    updated++;
  }

  logger.info(`[updateRanks] Updated ranks for ${updated} municipality_scores.`);
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
    published: false,
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
          published: false,
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

const handleMunicipalityCreated = async (meta: any, ctx: ServiceContext): Promise<void> => {
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

const handleMeasureCreatedOrPublished = async (meta: any, ctx: ServiceContext): Promise<void> => {
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

const handleRatingsMeasureUpdatedOrCreated = async (meta: any, ctx: ServiceContext): Promise<void> => {
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
  const catalogVersionId: number | string | undefined =
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

const handleMunicipalityScoreUpdated = async (meta: any, ctx: ServiceContext): Promise<void> => {
  if (!Object.prototype.hasOwnProperty.call(meta.payload ?? {}, 'published')) return;

  const scoreIds: Array<number | string> = meta.key
    ? [meta.key]
    : Array.isArray(meta.keys)
      ? meta.keys
      : [];

  if (!scoreIds.length) {
    ctx.logger.warn('[handleMunicipalityScoreUpdated] No municipality_score id(s) found in meta.');
    return;
  }

  const schema = await ctx.getSchema();
  const scoresService = new ctx.services.ItemsService('municipality_scores', {
    schema,
    accountability: adminAccountability,
  });

  const scores: Array<{ catalog_version: number | string | { id: number | string } | null }> =
    await scoresService.readByQuery({
      limit: -1,
      filter: { id: { _in: scoreIds } },
      fields: ['catalog_version'],
    });

  const catalogVersionIds = [
    ...new Set(
      scores
        .map((score) => (
          typeof score.catalog_version === 'object'
            ? score.catalog_version?.id
            : score.catalog_version
        ))
        .filter((id): id is number | string => id !== null && id !== undefined && id !== '')
    ),
  ];

  for (const catalogVersionId of catalogVersionIds) {
    await updateRanks({ catalogVersionId }, ctx);
  }
};

/** ---------- Safe wrapper for diagnostic logging ---------- **/

const safeCall = (
  fnName: string,
  extensionContext: ServiceContext,
  fn: (meta: any, ctx: ServiceContext) => Promise<void>
) => async (meta: any): Promise<void> => {
  try {
    if (!meta?.collection) {
      extensionContext.logger.warn(`[HOOK:${fnName}] meta missing or malformed: ${JSON.stringify(meta)}`);
    }
    await fn(meta, extensionContext);
  } catch (err: unknown) {
    const e = err as Error;
    extensionContext.logger.error(`[HOOK:${fnName}] Caught error: ${e?.message}`);
    extensionContext.logger.error(e?.stack ?? String(err));
    throw err;
  }
};

/** ---------- Hook Registration ---------- **/

export default (
  { action }: HookContext,
  extensionContext: ServiceContext
) => {
  const { services, getSchema, logger } = extensionContext;

  // Run initial sync at startup — all context variables are in scope here
  syncAllMunicipalityScores({ services, getSchema, logger }).catch((err: unknown) => {
    const e = err as Error;
    logger.error(`[syncAllMunicipalityScores] Failed during startup: ${e?.message}`);
    logger.error(e?.stack ?? String(err));
  });

  action(
    'items.create',
    safeCall('items.create', extensionContext, async (meta, ctx) => {
      switch (meta.collection) {
        case 'municipalities':
          return handleMunicipalityCreated(meta, ctx);
        case 'measures':
          return handleMeasureCreatedOrPublished(meta, ctx);
        case 'ratings_measures':
          return handleRatingsMeasureUpdatedOrCreated(meta, ctx);
        case 'municipality_scores':
          return handleMunicipalityScoreUpdated(meta, ctx);
        default:
          return;
      }
    })
  );

  action(
    'items.update',
    safeCall('items.update', extensionContext, async (meta, ctx) => {
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
