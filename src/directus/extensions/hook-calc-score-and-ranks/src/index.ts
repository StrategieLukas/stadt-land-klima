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

interface Accountability {
  admin?: boolean;
  user?: number | string | null;
}

interface FilterContext {
  accountability?: Accountability | null;
}

const adminAccountability = { admin: true } as const;
const unverifiedPublishError = 'Your account must be verified before publishing municipality scores.';

type RankedMunicipalityScore = {
  id: number | string;
  score_total: number | string | null;
  published: boolean | null;
  rank: number | string | null;
};

type RelationId = number | string | { id?: number | string | null } | null;
type MunicipalityStatus = 'draft' | 'published';
type MeasureSnapshot = {
  id: number | string;
  status: string | null;
  catalogVersionId: number | string | null;
};

const pendingMeasureSnapshots = new Map<string, MeasureSnapshot>();
const ratingScoreFields = ['rating', 'applicable', 'approved'] as const;

/** ---------- Utility Functions ---------- **/

const normalizeRelationId = (value: RelationId): number | string | null => {
  if (typeof value === 'object' && value !== null) {
    return value.id ?? null;
  }

  return value ?? null;
};

const normalizeRelationIds = (
  value: RelationId | RelationId[]
): Array<number | string> => {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(normalizeRelationId)
    .filter((id): id is number | string => id !== null);
};

const getEventKeys = (meta: any): Array<number | string> => {
  if (meta?.key !== null && meta?.key !== undefined) return [meta.key];
  return Array.isArray(meta?.keys) ? meta.keys : [];
};

const payloadHasAnyField = (
  payload: unknown,
  fields: readonly string[]
): boolean => {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }

  return fields.some((field) => Object.prototype.hasOwnProperty.call(payload, field));
};

const recalculateCatalogVersions = async (
  catalogVersionIds: Iterable<number | string>,
  ctx: ServiceContext
): Promise<void> => {
  for (const catalogVersionId of new Set(catalogVersionIds)) {
    await calculateScores({ catalogVersionId }, ctx);
    await updateRanks({ catalogVersionId }, ctx);
  }
};

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

const syncMunicipalityPublicationStatus = async (
  { municipalityId }: { municipalityId: number | string },
  { services, getSchema, logger }: ServiceContext
): Promise<void> => {
  const schema = await getSchema();
  const municipalityScoresService = new services.ItemsService('municipality_scores', {
    schema,
    accountability: adminAccountability,
  });
  const municipalitiesService = new services.ItemsService('municipalities', {
    schema,
    accountability: adminAccountability,
  });

  const publishedScores: Array<{ id: number | string }> =
    await municipalityScoresService.readByQuery({
      limit: 1,
      filter: {
        municipality: { _eq: municipalityId },
        published: { _eq: true },
      },
      fields: ['id'],
    });
  const status: MunicipalityStatus = publishedScores.length > 0 ? 'published' : 'draft';
  const municipality = await municipalitiesService.readOne(municipalityId, { fields: ['status'] }) as { status?: string | null };

  if (municipality?.status === status) return;

  await municipalitiesService.updateOne(municipalityId, { status });
  logger.info(`[syncMunicipalityPublicationStatus] Municipality ${municipalityId} status updated to ${status}.`);
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
    score_points: 0,
    score_max: 0,
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

const ensureRatingsForPublishedMeasure = async (
  measureId: number | string,
  catalogVersionId: number | string,
  ratingChoices: any,
  { services, getSchema, logger }: ServiceContext
): Promise<void> => {
  logger.info(`[ensureRatingsForPublishedMeasure] Syncing ratings for measure=${measureId}, catalogVersion=${catalogVersionId}`);
  const schema = await getSchema();
  const municipalitiesService = new services.ItemsService('municipalities', {
    schema,
    accountability: adminAccountability,
  });
  const ratingsService = new services.ItemsService('ratings_measures', {
    schema,
    accountability: adminAccountability,
  });

  const municipalities: Array<{ localteam_id?: RelationId }> =
    await municipalitiesService.readByQuery({
      limit: -1,
      fields: ['localteam_id'],
    });
  if (!municipalities?.length) return;

  const existingRatings: Array<{ id: number | string; localteam_id: RelationId }> =
    await ratingsService.readByQuery({
      limit: -1,
      filter: { measure_id: { _eq: measureId } },
      fields: ['id', 'localteam_id'],
    });
  const existingLocalteamIds = new Set(
    existingRatings
      .map((rating) => normalizeRelationId(rating.localteam_id))
      .filter((id): id is number | string => id !== null)
      .map(String)
  );
  const toCreate = municipalities.flatMap((municipality) => {
    const localteamId = normalizeRelationId(municipality.localteam_id ?? null);
    if (localteamId === null || existingLocalteamIds.has(String(localteamId))) return [];

    return [{
      measure_id: measureId,
      catalog_version: catalogVersionId,
      localteam_id: localteamId,
      status: 'draft',
      approved: true,
      choices: ratingChoices,
      rating: null,
    }];
  });

  if (existingRatings.length) {
    await ratingsService.updateMany(
      existingRatings.map((rating) => rating.id),
      { measure_published: true },
      { emitEvents: false }
    );
  }
  if (toCreate.length) {
    // Do not emit events — score and rank recalculation is handled by the caller.
    await ratingsService.createMany(toCreate, { emitEvents: false });
  }
  logger.info(
    `[ensureRatingsForPublishedMeasure] Created ${toCreate.length} missing ratings for measure=${measureId}, catalogVersion=${catalogVersionId}.`
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
          score_points: 0,
          score_max: 0,
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

const payloadChangesPublished = (payload: unknown): boolean => {
  return (
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Object.prototype.hasOwnProperty.call(payload, 'published')
  );
};

const enforceVerifiedPublisher = async (
  payload: unknown,
  meta: any,
  eventContext: FilterContext | undefined,
  serviceContext: ServiceContext
): Promise<unknown> => {
  if (meta?.collection !== 'municipality_scores' || !payloadChangesPublished(payload)) {
    return payload;
  }

  const accountability = eventContext?.accountability ?? null;

  if (!accountability?.user) {
    if (accountability?.admin === true) {
      return payload;
    }

    throw new Error(unverifiedPublishError);
  }

  const schema = await serviceContext.getSchema();
  const usersService = new serviceContext.services.ItemsService('directus_users', {
    schema,
    accountability: adminAccountability,
  });
  const user = await usersService.readOne(accountability.user, { fields: ['verified'] }) as { verified?: boolean | null };

  if (user?.verified !== true) {
    throw new Error(unverifiedPublishError);
  }

  return payload;
};

const captureMeasureSnapshots = async (
  meta: any,
  serviceContext: ServiceContext
): Promise<void> => {
  if (meta?.collection !== 'measures') return;

  const measureIds = getEventKeys(meta);
  if (!measureIds.length) return;

  const schema = await serviceContext.getSchema();
  const measuresService = new serviceContext.services.ItemsService('measures', {
    schema,
    accountability: adminAccountability,
  });
  const measures: Array<{
    id: number | string;
    status?: string | null;
    catalog_version?: RelationId;
  }> = await measuresService.readByQuery({
    limit: -1,
    filter: { id: { _in: measureIds } },
    fields: ['id', 'status', 'catalog_version'],
  });

  for (const measure of measures) {
    pendingMeasureSnapshots.set(String(measure.id), {
      id: measure.id,
      status: measure.status ?? null,
      catalogVersionId: normalizeRelationId(measure.catalog_version ?? null),
    });
  }
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

const handleMeasuresCreatedOrUpdated = async (meta: any, ctx: ServiceContext): Promise<void> => {
  const measureIds = getEventKeys(meta);
  if (!measureIds.length) {
    ctx.logger.warn('[handleMeasuresCreatedOrUpdated] No measure id(s) found in meta.');
    return;
  }

  const schema = await ctx.getSchema();
  const measureService = new ctx.services.ItemsService('measures', {
    schema,
    accountability: adminAccountability,
  });
  const currentMeasures: Array<{
    id: number | string;
    status?: string | null;
    catalog_version?: RelationId;
    choices_rating?: any;
  }> = await measureService.readByQuery({
    limit: -1,
    filter: { id: { _in: measureIds } },
    fields: ['id', 'status', 'catalog_version', 'choices_rating'],
  });
  const currentById = new Map(currentMeasures.map((measure) => [String(measure.id), measure]));
  const catalogVersionIds = new Set<number | string>();

  for (const measureId of measureIds) {
    const previous = pendingMeasureSnapshots.get(String(measureId));
    pendingMeasureSnapshots.delete(String(measureId));
    const current = currentById.get(String(measureId));
    if (!current) continue;

    const currentCatalogVersionId = normalizeRelationId(current.catalog_version ?? null);
    const wasPublished = previous?.status === 'published';
    const isPublished = current.status === 'published';

    if (wasPublished && previous?.catalogVersionId !== null && previous?.catalogVersionId !== undefined) {
      catalogVersionIds.add(previous.catalogVersionId);
    }
    if (
      isPublished &&
      currentCatalogVersionId !== null
    ) {
      catalogVersionIds.add(currentCatalogVersionId);
    }

    // If a filter snapshot is unavailable, a status change away from published
    // still needs a conservative recalculation of the measure's current catalog.
    if (
      !previous &&
      payloadHasAnyField(meta.payload, ['status']) &&
      currentCatalogVersionId !== null
    ) {
      catalogVersionIds.add(currentCatalogVersionId);
    }

    if (isPublished && !wasPublished && currentCatalogVersionId !== null) {
      await ensureRatingsForPublishedMeasure(
        measureId,
        currentCatalogVersionId,
        current.choices_rating,
        ctx
      );
    }
  }

  await recalculateCatalogVersions(catalogVersionIds, ctx);
};

const handleRatingsMeasureUpdatedOrCreated = async (meta: any, ctx: ServiceContext): Promise<void> => {
  if (
    meta.event === 'update' &&
    !payloadHasAnyField(meta.payload, ratingScoreFields)
  ) {
    return;
  }

  const schema = await ctx.getSchema();
  const ratingsService = new ctx.services.ItemsService('ratings_measures', {
    schema,
    accountability: adminAccountability,
  });

  // Support both single (meta.key) and bulk (meta.keys) events
  const ratingIds = getEventKeys(meta);

  if (!ratingIds.length) {
    ctx.logger.warn('[handleRatingsMeasureUpdatedOrCreated] No rating id(s) found in meta.');
    return;
  }

  const ratings: Array<{
    localteam_id?: { municipality_id?: RelationId | RelationId[] } | null;
    measure_id?: { catalog_version?: RelationId } | null;
  }> = await ratingsService.readByQuery({
    limit: -1,
    filter: { id: { _in: ratingIds } },
    fields: ['localteam_id.municipality_id', 'measure_id.catalog_version'],
  });
  const municipalityIdsByCatalog = new Map<string, {
    catalogVersionId: number | string;
    municipalityIds: Set<number | string>;
  }>();

  for (const rating of ratings) {
    const municipalityIds = normalizeRelationIds(
      rating.localteam_id?.municipality_id ?? null
    );
    const catalogVersionId = normalizeRelationId(
      rating.measure_id?.catalog_version ?? null
    );
    if (!municipalityIds.length || catalogVersionId === null) continue;

    const key = String(catalogVersionId);
    const scope = municipalityIdsByCatalog.get(key) ?? {
      catalogVersionId,
      municipalityIds: new Set<number | string>(),
    };
    for (const municipalityId of municipalityIds) {
      scope.municipalityIds.add(municipalityId);
    }
    municipalityIdsByCatalog.set(key, scope);
  }

  for (const { catalogVersionId, municipalityIds } of municipalityIdsByCatalog.values()) {
    await calculateScores({
      municipalityIds: [...municipalityIds],
      catalogVersionId,
    }, ctx);
    await updateRanks({ catalogVersionId }, ctx);
  }
};

const handleMeasuresDeleted = async (meta: any, ctx: ServiceContext): Promise<void> => {
  const catalogVersionIds = new Set<number | string>();

  for (const measureId of getEventKeys(meta)) {
    const previous = pendingMeasureSnapshots.get(String(measureId));
    pendingMeasureSnapshots.delete(String(measureId));
    if (
      previous?.status === 'published' &&
      previous.catalogVersionId !== null
    ) {
      catalogVersionIds.add(previous.catalogVersionId);
    }
  }

  if (!catalogVersionIds.size) {
    ctx.logger.info('[handleMeasuresDeleted] No published measures were deleted.');
    return;
  }

  await recalculateCatalogVersions(catalogVersionIds, ctx);
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

  const scores: Array<{ catalog_version: RelationId; municipality: RelationId }> =
    await scoresService.readByQuery({
      limit: -1,
      filter: { id: { _in: scoreIds } },
      fields: ['catalog_version', 'municipality'],
    });

  const catalogVersionIds = [
    ...new Set(
      scores
        .map((score) => normalizeRelationId(score.catalog_version))
        .filter((id): id is number | string => id !== null && id !== undefined && id !== '')
    ),
  ];
  const municipalityIds = [
    ...new Set(
      scores
        .map((score) => normalizeRelationId(score.municipality))
        .filter((id): id is number | string => id !== null && id !== undefined && id !== '')
    ),
  ];

  for (const municipalityId of municipalityIds) {
    await syncMunicipalityPublicationStatus({ municipalityId }, ctx);
  }

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
  { action, filter }: HookContext,
  extensionContext: ServiceContext
) => {
  const { services, getSchema, logger } = extensionContext;

  // Run initial sync at startup — all context variables are in scope here
  syncAllMunicipalityScores({ services, getSchema, logger }).catch((err: unknown) => {
    const e = err as Error;
    logger.error(`[syncAllMunicipalityScores] Failed during startup: ${e?.message}`);
    logger.error(e?.stack ?? String(err));
  });

  filter('items.update', async (payload, meta, eventContext) => {
    await captureMeasureSnapshots(meta, extensionContext);
    return enforceVerifiedPublisher(payload, meta, eventContext, extensionContext);
  });

  filter('items.delete', async (keys, meta) => {
    await captureMeasureSnapshots({ ...meta, keys }, extensionContext);
    return keys;
  });

  action(
    'items.create',
    safeCall('items.create', extensionContext, async (meta, ctx) => {
      switch (meta.collection) {
        case 'municipalities':
          return handleMunicipalityCreated(meta, ctx);
        case 'measures':
          return handleMeasuresCreatedOrUpdated({ ...meta, event: 'create' }, ctx);
        case 'ratings_measures':
          return handleRatingsMeasureUpdatedOrCreated({ ...meta, event: 'create' }, ctx);
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
          return handleMeasuresCreatedOrUpdated({ ...meta, event: 'update' }, ctx);
        case 'ratings_measures':
          return handleRatingsMeasureUpdatedOrCreated({ ...meta, event: 'update' }, ctx);
        case 'municipality_scores':
          return handleMunicipalityScoreUpdated(meta, ctx);
        default:
          return;
      }
    })
  );

  action(
    'items.delete',
    safeCall('items.delete', extensionContext, async (meta, ctx) => {
      if (meta.collection === 'measures') {
        return handleMeasuresDeleted(meta, ctx);
      }
    })
  );
};
