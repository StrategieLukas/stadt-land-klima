import { municipalityRanks, type RankedMunicipalityScore } from "./ranks.ts";
import { extensionLog, extensionError } from "../../shared/securityLogger.ts";
import type { ApiExtensionContext, SchemaOverview } from "@directus/types";
import {
  changesPublication,
  enforcePublication,
  ensurePreviewToken,
  logPublication,
  type PublicationEventContext,
} from "./publication.ts";
import { recordRatingHistory } from "./history.ts";
import { calculateScores } from "./calculateScores.ts";

type Logger = ApiExtensionContext["logger"];
type Schema = SchemaOverview;
type Services = ApiExtensionContext["services"];

interface HookContext {
  action: (event: string, handler: (meta: any, ctx?: PublicationEventContext) => Promise<void>) => void;
  filter: (event: string, handler: (...args: any[]) => any) => void;
  schedule: (cron: string, handler: () => Promise<void>) => void;
}

interface ServiceContext {
  services: Services;
  getSchema: () => Promise<Schema>;
  logger: Logger;
  event?: PublicationEventContext | undefined;
}

const adminAccountability = { admin: true, role: null, roles: [], user: null, app: false, ip: null };

type RelationId = number | string | { id?: number | string | null } | null;
type MunicipalityStatus = "draft" | "published";
type MeasureSnapshot = {
  id: number | string;
  status: string | null;
  catalogVersionId: number | string | null;
};

type RatingScope = {
  id: string | number;
  localteam_id?: { municipality_id?: RelationId | RelationId[] } | null;
  measure_id?: { catalog_version?: RelationId } | null;
};
const pendingRatingScopes = new Map<string, RatingScope>();
const pendingMeasureSnapshots = new Map<string, MeasureSnapshot>();
const ratingScoreFields = [
  "rating",
  "applicable",
  "approved",
  "status",
  "measure_published",
  "current_progress",
  "source",
  "why_not_applicable",
] as const;

/** ---------- Utility Functions ---------- **/

const normalizeRelationId = (value: RelationId): number | string | null => {
  if (typeof value === "object" && value !== null) {
    return value.id ?? null;
  }

  return value ?? null;
};

const normalizeRelationIds = (value: RelationId | RelationId[]): Array<number | string> => {
  const values = Array.isArray(value) ? value : [value];
  return values.map(normalizeRelationId).filter((id): id is number | string => id !== null);
};

const getEventKeys = (meta: any): Array<number | string> => {
  if (meta?.key !== null && meta?.key !== undefined) return [meta.key];
  return Array.isArray(meta?.keys) ? meta.keys : [];
};

const payloadHasAnyField = (payload: unknown, fields: readonly string[]): boolean => {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return fields.some((field) => Object.prototype.hasOwnProperty.call(payload, field));
};

const recalculateCatalogVersions = async (
  catalogVersionIds: Iterable<number | string>,
  ctx: ServiceContext,
): Promise<void> => {
  for (const catalogVersionId of new Set(catalogVersionIds)) {
    await calculateScores({ catalogVersionId }, ctx);
    await updateRanks({ catalogVersionId }, ctx);
    await recordRatingHistory(ctx, { catalog_version: { _eq: catalogVersionId } });
  }
};

const updateRanks = async (
  { catalogVersionId }: { catalogVersionId: number | string },
  { services, getSchema }: ServiceContext,
): Promise<void> => {
  const schema = await getSchema();
  const municipalityScoresService = new services.ItemsService<RankedMunicipalityScore>("municipality_scores", {
    schema,
    accountability: adminAccountability,
  });

  const scores: RankedMunicipalityScore[] = await municipalityScoresService.readByQuery({
    limit: -1,
    filter: {
      catalog_version: { _eq: catalogVersionId },
    },
    fields: ["id", "score_total", "published", "rank", "percentage_rated", "municipality.status", "municipality.name"],
  });

  if (!scores?.length) {
    return;
  }

  const rankById = municipalityRanks(scores);

  for (const score of scores) {
    const nextRank = rankById.get(String(score.id)) ?? -1;
    if (Number(score.rank) === nextRank) continue;
    await municipalityScoresService.updateOne(score.id, { rank: nextRank });
  }
};

const syncMunicipalityPublicationStatus = async (
  { municipalityId }: { municipalityId: number | string },
  { services, getSchema }: ServiceContext,
): Promise<void> => {
  const schema = await getSchema();
  const municipalityScoresService = new services.ItemsService<RankedMunicipalityScore>("municipality_scores", {
    schema,
    accountability: adminAccountability,
  });
  const municipalitiesService = new services.ItemsService("municipalities", {
    schema,
    accountability: adminAccountability,
  });

  const publishedScores: Array<{ id: number | string }> = await municipalityScoresService.readByQuery({
    limit: 1,
    filter: {
      municipality: { _eq: municipalityId },
      published: { _eq: true },
    },
    fields: ["id"],
  });
  const status: MunicipalityStatus = publishedScores.length > 0 ? "published" : "draft";
  const municipality = (await municipalitiesService.readOne(municipalityId, { fields: ["status"] })) as {
    status?: string | null;
  };

  if (municipality?.status === status) return;

  await municipalitiesService.updateOne(municipalityId, { status });
};

const createEmptyRatingsForNewMunicipality = async (
  municipality: { id: number; localteam_id: number; name: string },
  { services, getSchema, logger }: ServiceContext,
): Promise<void> => {
  const schema = await getSchema();
  const measuresService = new services.ItemsService("measures", {
    schema,
    accountability: adminAccountability,
  });
  const ratingsService = new services.ItemsService<{
    id: string | number;
    localteam_id: RelationId;
    measure_published?: boolean;
  }>("ratings_measures", {
    schema,
    accountability: adminAccountability,
  });

  const publishedMeasures: any[] = await measuresService.readByQuery({
    limit: -1,
    filter: { status: { _eq: "published" } },
  });

  if (!publishedMeasures?.length) {
    return;
  }

  const toCreate = publishedMeasures.map((measure: any) => ({
    measure_id: measure.id,
    catalog_version: typeof measure.catalog_version === "object" ? measure.catalog_version.id : measure.catalog_version,
    localteam_id: municipality.localteam_id,
    status: "draft",
    approved: true,
    choices: measure.choices_rating,
    rating: null,
  }));

  await ratingsService.createMany(toCreate, { emitEvents: false });
  extensionLog(logger, "info", "directus.ratings.initialized", {
    municipalityId: municipality.id,
    resource: "ratings_measures",
    count: toCreate.length,
    outcome: "success",
  });
};

const createEmptyScoresForMunicipality = async (
  municipality: { id: number; name: string },
  { services, getSchema }: ServiceContext,
): Promise<void> => {
  const schema = await getSchema();
  const measureCatalogService = new services.ItemsService("measure_catalog", {
    schema,
    accountability: adminAccountability,
  });
  const municipalityScoresService = new services.ItemsService<RankedMunicipalityScore>("municipality_scores", {
    schema,
    accountability: adminAccountability,
  });
  const munService = new services.ItemsService("municipalities", {
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
};

const ensureRatingsForPublishedMeasure = async (
  measureId: number | string,
  catalogVersionId: number | string,
  ratingChoices: any,
  { services, getSchema, logger }: ServiceContext,
): Promise<void> => {
  const schema = await getSchema();
  const municipalitiesService = new services.ItemsService("municipalities", {
    schema,
    accountability: adminAccountability,
  });
  const ratingsService = new services.ItemsService<{
    id: string | number;
    localteam_id: RelationId;
    measure_published?: boolean;
  }>("ratings_measures", {
    schema,
    accountability: adminAccountability,
  });

  const municipalities: Array<{ localteam_id?: RelationId }> = await municipalitiesService.readByQuery({
    limit: -1,
    fields: ["localteam_id"],
  });
  if (!municipalities?.length) return;

  const existingRatings: Array<{ id: number | string; localteam_id: RelationId }> = await ratingsService.readByQuery({
    limit: -1,
    filter: { measure_id: { _eq: measureId } },
    fields: ["id", "localteam_id"],
  });
  const existingLocalteamIds = new Set(
    existingRatings
      .map((rating) => normalizeRelationId(rating.localteam_id))
      .filter((id): id is number | string => id !== null)
      .map(String),
  );
  const toCreate = municipalities.flatMap((municipality) => {
    const localteamId = normalizeRelationId(municipality.localteam_id ?? null);
    if (localteamId === null || existingLocalteamIds.has(String(localteamId))) return [];

    return [
      {
        measure_id: measureId,
        catalog_version: catalogVersionId,
        localteam_id: localteamId,
        status: "draft",
        approved: true,
        choices: ratingChoices,
        rating: null,
      },
    ];
  });

  if (existingRatings.length) {
    await ratingsService.updateMany(
      existingRatings.map((rating) => rating.id),
      { measure_published: true },
      { emitEvents: false },
    );
    extensionLog(logger, "info", "directus.ratings.measure_reactivated", {
      resource: "measures",
      resourceId: measureId,
      catalogId: catalogVersionId,
      count: existingRatings.length,
      outcome: "success",
    });
  }
  if (toCreate.length) {
    // Do not emit events — score and rank recalculation is handled by the caller.
    await ratingsService.createMany(toCreate, { emitEvents: false });
    extensionLog(logger, "info", "directus.ratings.measure_initialized", {
      resource: "measures",
      resourceId: measureId,
      catalogId: catalogVersionId,
      count: toCreate.length,
      outcome: "success",
    });
  }
};

const syncAllMunicipalityScores = async ({ services, getSchema, logger }: ServiceContext): Promise<void> => {
  const schema = await getSchema();

  const municipalityService = new services.ItemsService("municipalities", {
    schema,
    accountability: adminAccountability,
  });
  const catalogService = new services.ItemsService("measure_catalog", {
    schema,
    accountability: adminAccountability,
  });
  const scoresService = new services.ItemsService<RankedMunicipalityScore>("municipality_scores", {
    schema,
    accountability: adminAccountability,
  });

  const existing: any[] = await scoresService.readByQuery({ limit: 1, fields: ["id"] });
  const catalogs: any[] = await catalogService.readByQuery({ limit: -1 });

  if (!existing?.length) {
    const municipalities: any[] = await municipalityService.readByQuery({ limit: -1 });

    if (!municipalities?.length || !catalogs?.length) {
      extensionLog(logger, "warn", "app.hook-calc-score-and-ranks.index.degraded");
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
      await scoresService.createMany(toCreate);
    }
  }

  for (const cv of catalogs) {
    await calculateScores({ catalogVersionId: cv.id }, { services, getSchema, logger });

    await updateRanks({ catalogVersionId: cv.id }, { services, getSchema, logger });
  }
};

const captureMeasureSnapshots = async (meta: any, serviceContext: ServiceContext): Promise<void> => {
  if (meta?.collection !== "measures") return;

  const measureIds = getEventKeys(meta);
  if (!measureIds.length) return;

  const schema = await serviceContext.getSchema();
  const measuresService = new serviceContext.services.ItemsService<{
    id: string | number;
    status?: string | null;
    catalog_version?: RelationId;
  }>("measures", {
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
    fields: ["id", "status", "catalog_version"],
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
  const munService = new ctx.services.ItemsService<{ id: number; name: string; localteam_id: number }>(
    "municipalities",
    {
      schema,
      accountability: adminAccountability,
    },
  );
  const municipality = await munService.readOne(meta.key);
  if (!municipality) return;

  await createEmptyScoresForMunicipality(municipality, ctx);
  await createEmptyRatingsForNewMunicipality(municipality, ctx);
};

const handleMeasuresCreatedOrUpdated = async (meta: any, ctx: ServiceContext): Promise<void> => {
  const measureIds = getEventKeys(meta);
  if (!measureIds.length) {
    extensionLog(ctx.logger, "warn", "app.hook-calc-score-and-ranks.index.degraded");
    return;
  }

  const schema = await ctx.getSchema();
  const measureService = new ctx.services.ItemsService<{
    id: string | number;
    status?: string | null;
    catalog_version?: RelationId;
    choices_rating?: unknown;
  }>("measures", {
    schema,
    accountability: adminAccountability,
  });
  const currentMeasures: Array<{
    id: number | string;
    status?: string | null;
    catalog_version?: RelationId;
    choices_rating?: unknown;
  }> = await measureService.readByQuery({
    limit: -1,
    filter: { id: { _in: measureIds } },
    fields: ["id", "status", "catalog_version", "choices_rating"],
  });
  const currentById = new Map(currentMeasures.map((measure) => [String(measure.id), measure]));
  const catalogVersionIds = new Set<number | string>();

  for (const measureId of measureIds) {
    const previous = pendingMeasureSnapshots.get(String(measureId));
    pendingMeasureSnapshots.delete(String(measureId));
    const current = currentById.get(String(measureId));
    if (!current) continue;

    const currentCatalogVersionId = normalizeRelationId(current.catalog_version ?? null);
    const wasPublished = previous?.status === "published";
    const isPublished = current.status === "published";

    if (wasPublished && previous?.catalogVersionId !== null && previous?.catalogVersionId !== undefined) {
      catalogVersionIds.add(previous.catalogVersionId);
    }
    if (isPublished && currentCatalogVersionId !== null) {
      catalogVersionIds.add(currentCatalogVersionId);
    }

    // If a filter snapshot is unavailable, a status change away from published
    // still needs a conservative recalculation of the measure's current catalog.
    if (!previous && payloadHasAnyField(meta.payload, ["status"]) && currentCatalogVersionId !== null) {
      catalogVersionIds.add(currentCatalogVersionId);
    }

    if (isPublished && !wasPublished && currentCatalogVersionId !== null) {
      await ensureRatingsForPublishedMeasure(measureId, currentCatalogVersionId, current.choices_rating, ctx);
    }
  }

  await recalculateCatalogVersions(catalogVersionIds, ctx);
};

const handleRatingsMeasureUpdatedOrCreated = async (meta: any, ctx: ServiceContext): Promise<void> => {
  if (meta.event === "update" && !payloadHasAnyField(meta.payload, ratingScoreFields)) {
    return;
  }

  const schema = await ctx.getSchema();
  const ratingsService = new ctx.services.ItemsService<RatingScope>("ratings_measures", {
    schema,
    accountability: adminAccountability,
  });

  // Support both single (meta.key) and bulk (meta.keys) events
  const ratingIds = getEventKeys(meta);

  if (!ratingIds.length) {
    extensionLog(ctx.logger, "warn", "app.hook-calc-score-and-ranks.index.degraded");
    return;
  }

  const ratings: RatingScope[] =
    meta.event === "delete"
      ? ratingIds.flatMap((id) => {
          const rating = pendingRatingScopes.get(String(id));
          pendingRatingScopes.delete(String(id));
          return rating ? [rating] : [];
        })
      : await ratingsService.readByQuery({
          limit: -1,
          filter: { id: { _in: ratingIds } },
          fields: ["localteam_id.municipality_id", "measure_id.catalog_version"],
        });
  const municipalityIdsByCatalog = new Map<
    string,
    {
      catalogVersionId: number | string;
      municipalityIds: Set<number | string>;
    }
  >();

  for (const rating of ratings) {
    const municipalityIds = normalizeRelationIds(rating.localteam_id?.municipality_id ?? null);
    const catalogVersionId = normalizeRelationId(rating.measure_id?.catalog_version ?? null);
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
    await calculateScores(
      {
        municipalityIds: [...municipalityIds],
        catalogVersionId,
      },
      ctx,
    );
    await updateRanks({ catalogVersionId }, ctx);
    await recordRatingHistory(ctx, {
      catalog_version: { _eq: catalogVersionId },
      municipality: { id: { _in: [...municipalityIds] } },
    });
  }
};

const handleMeasuresDeleted = async (meta: any, ctx: ServiceContext): Promise<void> => {
  const catalogVersionIds = new Set<number | string>();

  for (const measureId of getEventKeys(meta)) {
    const previous = pendingMeasureSnapshots.get(String(measureId));
    pendingMeasureSnapshots.delete(String(measureId));
    if (previous?.status === "published" && previous.catalogVersionId !== null) {
      catalogVersionIds.add(previous.catalogVersionId);
    }
  }

  if (!catalogVersionIds.size) {
    return;
  }

  await recalculateCatalogVersions(catalogVersionIds, ctx);
};

const handleMunicipalityScoreUpdated = async (meta: any, ctx: ServiceContext): Promise<void> => {
  if (!changesPublication(meta.payload)) return;

  const scoreIds: Array<number | string> = meta.key ? [meta.key] : Array.isArray(meta.keys) ? meta.keys : [];

  if (!scoreIds.length) {
    extensionLog(ctx.logger, "warn", "app.hook-calc-score-and-ranks.index.degraded");
    return;
  }

  const schema = await ctx.getSchema();
  const scoresService = new ctx.services.ItemsService<{ catalog_version: RelationId; municipality: RelationId }>(
    "municipality_scores",
    {
      schema,
      accountability: adminAccountability,
    },
  );

  const scores: Array<{ catalog_version: RelationId; municipality: RelationId }> = await scoresService.readByQuery({
    limit: -1,
    filter: { id: { _in: scoreIds } },
    fields: ["catalog_version", "municipality"],
  });

  const catalogVersionIds = [
    ...new Set(
      scores
        .map((score) => normalizeRelationId(score.catalog_version))
        .filter((id): id is number | string => id !== null && id !== undefined && id !== ""),
    ),
  ];
  const municipalityIds = [
    ...new Set(
      scores
        .map((score) => normalizeRelationId(score.municipality))
        .filter((id): id is number | string => id !== null && id !== undefined && id !== ""),
    ),
  ];

  for (const municipalityId of municipalityIds) {
    if (meta.payload.preview_enabled === true) await ensurePreviewToken(municipalityId, ctx);
    await syncMunicipalityPublicationStatus({ municipalityId }, ctx);
  }

  for (const catalogVersionId of catalogVersionIds) {
    await calculateScores({ catalogVersionId, municipalityIds }, ctx);
    await updateRanks({ catalogVersionId }, ctx);
  }
  await logPublication(meta, ctx.event, ctx);
  if (meta.payload.published === true) await recordRatingHistory(ctx, { id: { _in: scoreIds } }, "published");
};

/** ---------- Safe wrapper for diagnostic logging ---------- **/

const safeCall =
  (fnName: string, extensionContext: ServiceContext, fn: (meta: any, ctx: ServiceContext) => Promise<void>) =>
  async (meta: any, event?: PublicationEventContext): Promise<void> => {
    try {
      if (!meta?.collection) {
        extensionLog(extensionContext.logger, "warn", "app.hook-calc-score-and-ranks.index.degraded");
      }
      await fn(meta, { ...extensionContext, event });
    } catch (err: unknown) {
      extensionError(extensionContext.logger, "directus.score_hook.failed", err);
      throw err;
    }
  };

/** ---------- Hook Registration ---------- **/

export default ({ action, filter, schedule }: HookContext, extensionContext: ServiceContext) => {
  const { services, getSchema, logger } = extensionContext;

  // Run initial sync at startup — all context variables are in scope here
  syncAllMunicipalityScores({ services, getSchema, logger })
    .then(() => recordRatingHistory(extensionContext, {}, "initial"))
    .catch((err: unknown) => {
      extensionError(logger, "directus.score_initialization.failed", err);
    });

  schedule?.("*/5 * * * *", async () => {
    await recordRatingHistory(extensionContext, {}, "initial");
  });

  filter("items.update", async (payload, meta, eventContext) => {
    await captureMeasureSnapshots(meta, extensionContext);
    return enforcePublication(payload, meta, eventContext, extensionContext);
  });

  filter("items.create", (payload, meta, eventContext) =>
    enforcePublication(payload, meta, eventContext, extensionContext),
  );

  filter("items.delete", async (keys, meta) => {
    if (meta.collection === "ratings_measures") {
      const schema = await getSchema();
      const ratingsService = new services.ItemsService<RatingScope>("ratings_measures", {
        schema,
        accountability: adminAccountability,
      });
      const ratings: RatingScope[] = await ratingsService.readByQuery({
        limit: -1,
        filter: { id: { _in: keys } },
        fields: ["id", "localteam_id.municipality_id", "measure_id.catalog_version"],
      });
      for (const rating of ratings) pendingRatingScopes.set(String(rating.id), rating);
    }
    await captureMeasureSnapshots({ ...meta, keys }, extensionContext);
    return keys;
  });

  action(
    "items.create",
    safeCall("items.create", extensionContext, async (meta, ctx) => {
      switch (meta.collection) {
        case "municipalities":
          if (meta.key !== undefined) await ensurePreviewToken(meta.key, ctx);
          return handleMunicipalityCreated(meta, ctx);
        case "measures":
          return handleMeasuresCreatedOrUpdated({ ...meta, event: "create" }, ctx);
        case "ratings_measures":
          return handleRatingsMeasureUpdatedOrCreated({ ...meta, event: "create" }, ctx);
        case "municipality_scores":
          return handleMunicipalityScoreUpdated(meta, ctx);
        default:
          return;
      }
    }),
  );

  action(
    "items.update",
    safeCall("items.update", extensionContext, async (meta, ctx) => {
      switch (meta.collection) {
        case "measures":
          return handleMeasuresCreatedOrUpdated({ ...meta, event: "update" }, ctx);
        case "ratings_measures":
          return handleRatingsMeasureUpdatedOrCreated({ ...meta, event: "update" }, ctx);
        case "municipality_scores":
          return handleMunicipalityScoreUpdated(meta, ctx);
        default:
          return;
      }
    }),
  );

  action(
    "items.delete",
    safeCall("items.delete", extensionContext, async (meta, ctx) => {
      if (meta.collection === "measures") return handleMeasuresDeleted(meta, ctx);
      if (meta.collection === "ratings_measures")
        return handleRatingsMeasureUpdatedOrCreated({ ...meta, event: "delete" }, ctx);
    }),
  );
};
