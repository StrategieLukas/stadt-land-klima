import { createError } from "@directus/errors";
import type { ApiExtensionContext, Accountability } from "@directus/types";
import { randomBytes } from "node:crypto";
import { ratingCompletesMeasure } from "./calculateScores.ts";

type Id = string | number;
type Relation = Id | { id: Id } | null;
export type PublicationContext = Pick<ApiExtensionContext, "services" | "getSchema" | "logger">;
export type PublicationEventContext = {
  accountability?: Pick<Accountability, "admin" | "user"> | null;
  database?: ApiExtensionContext["database"];
};
const admin = { admin: true, role: null, roles: [], user: null, app: false, ip: null };
const NotVerified = createError(
  "ACCOUNT_NOT_VERIFIED",
  "Account verification is an anti-spam feature. Email info@stadt-land-klima.de to verify your account before publishing or enabling a preview.",
  403,
);
const Incomplete = createError(
  "RATINGS_INCOMPLETE",
  "Rate every measure (100%) before publishing. A verified user can enable a preview at any percentage.",
  400,
);
const InvalidState = createError(
  "INVALID_PUBLICATION_STATE",
  "Save the score first and use boolean publication controls.",
  400,
);
const relationId = (value: Relation): Id | null => (typeof value === "object" && value !== null ? value.id : value);
export const changesPublication = (payload: unknown): payload is Record<string, unknown> =>
  !!payload &&
  typeof payload === "object" &&
  !Array.isArray(payload) &&
  ["published", "preview_enabled"].some((key) => Object.prototype.hasOwnProperty.call(payload, key));

export async function enforcePublication(
  payload: unknown,
  meta: { collection?: string; keys?: Id[]; key?: Id },
  event: PublicationEventContext | undefined,
  context: PublicationContext,
): Promise<unknown> {
  if (meta.collection !== "municipality_scores" || !changesPublication(payload)) return payload;
  for (const key of ["published", "preview_enabled"]) {
    if (key in payload && typeof payload[key] !== "boolean") throw new InvalidState();
  }
  const schema = await context.getSchema();
  const options = { schema, accountability: admin, ...(event?.database ? { knex: event.database } : {}) };
  const { ItemsService } = context.services;
  const actor = event?.accountability;
  if (!actor?.user && actor?.admin !== true) throw new NotVerified();
  if (actor?.user) {
    const user = await new ItemsService<{ verified: boolean | null }>("directus_users", options).readOne(actor.user, {
      fields: ["verified"],
    });
    if (user.verified !== true) throw new NotVerified();
  }
  if (payload.published !== true) return payload;
  const ids = meta.keys ?? (meta.key === undefined ? [] : [meta.key]);
  if (!ids.length) throw new InvalidState();
  const scores = await new ItemsService<{ id: Id; municipality: Relation; catalog_version: Relation }>(
    "municipality_scores",
    options,
  ).readByQuery({ filter: { id: { _in: ids } }, fields: ["id", "municipality", "catalog_version"], limit: -1 });
  if (scores.length !== new Set(ids).size) throw new InvalidState();
  for (const score of scores) {
    const municipalityId = relationId(score.municipality);
    const catalogId = relationId(score.catalog_version);
    if (municipalityId === null || catalogId === null) throw new Incomplete();
    const municipality = await new ItemsService<{ localteam_id: Relation }>("municipalities", options).readOne(
      municipalityId,
      { fields: ["localteam_id"] },
    );
    const teamId = relationId(municipality.localteam_id);
    if (teamId === null) throw new Incomplete();
    // Inspect actual assessments instead of trusting stale or client-submitted percentages.
    const measures = new ItemsService<{ id: Id }>("measures", options);
    const ratings = new ItemsService<{
      measure_id: Relation;
      rating: string | number | null;
      applicable: boolean | null;
    }>("ratings_measures", options);
    const required = new Set<Id>();
    for (let offset = 0; ;) {
      const page = await measures.readByQuery({
        filter: { catalog_version: { _eq: catalogId }, status: { _eq: "published" } },
        fields: ["id"],
        sort: ["id"],
        limit: 100,
        offset,
      });
      if (!page.length) break;
      for (const row of page) required.add(row.id);
      offset += page.length;
    }
    if (!required.size) throw new Incomplete();
    const completed = new Set<Id>();
    for (let offset = 0; ;) {
      const page = await ratings.readByQuery({
        filter: {
          localteam_id: { _eq: teamId },
          approved: { _eq: true },
          measure_published: { _eq: true },
          measure_id: { catalog_version: { _eq: catalogId }, status: { _eq: "published" } },
        },
        fields: ["measure_id", "rating", "applicable"],
        sort: ["id"],
        limit: 100,
        offset,
      });
      if (!page.length) break;
      for (const row of page) {
        const id = relationId(row.measure_id);
        if (id !== null && required.has(id) && ratingCompletesMeasure(row)) completed.add(id);
      }
      offset += page.length;
    }
    if (completed.size !== required.size) throw new Incomplete();
  }
  return payload;
}

/** Generate tokens for every new municipality, independent of legacy verification. */
export async function ensurePreviewToken(id: Id, context: PublicationContext): Promise<void> {
  const service = new context.services.ItemsService<{ preview_token: string | null }>("municipalities", {
    schema: await context.getSchema(),
    accountability: admin,
  });
  const row = await service.readOne(id, { fields: ["preview_token"] });
  if (!row.preview_token) await service.updateOne(id, { preview_token: randomBytes(32).toString("hex") });
}

/** Pino emits structured fields safely; never include preview credentials or editorial research. */
export async function logPublication(
  meta: { collection?: string; key?: Id; keys?: Id[]; payload?: unknown },
  event: PublicationEventContext | undefined,
  context: PublicationContext,
): Promise<void> {
  if (meta.collection !== "municipality_scores" || !changesPublication(meta.payload)) return;
  const patch = meta.payload;
  try {
    const options = { schema: await context.getSchema(), accountability: admin };
    const actorId = event?.accountability?.user ?? null;
    const actor = actorId
      ? await new context.services.ItemsService<{ email: string | null }>("directus_users", options).readOne(actorId, {
          fields: ["email"],
        })
      : null;
    const ids = meta.keys ?? (meta.key === undefined ? [] : [meta.key]);
    const rows = await new context.services.ItemsService("municipality_scores", options).readByQuery({
      filter: { id: { _in: ids } },
      fields: [
        "id",
        "published",
        "preview_enabled",
        "percentage_rated",
        "municipality.id",
        "municipality.name",
        "catalog_version.id",
        "catalog_version.name",
      ],
      limit: -1,
    });
    for (const row of rows)
      context.logger.info(
        {
          event: "municipality.publication.updated",
          actorId,
          actorEmail: actor?.email ?? null,
          scoreId: row.id,
          municipality: row.municipality,
          catalog: row.catalog_version,
          percentageRated: row.percentage_rated,
          published: row.published,
          previewEnabled: row.preview_enabled,
          changes: Object.fromEntries(
            ["published", "preview_enabled"].filter((key) => key in patch).map((key) => [key, patch[key]]),
          ),
        },
        "Municipality publication/preview state updated",
      );
  } catch {
    context.logger.warn("Publication log enrichment failed; native Directus activity retains the mutation audit.");
  }
}
