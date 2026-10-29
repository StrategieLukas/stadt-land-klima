import { createHash } from "node:crypto";
import type { ApiExtensionContext, SchemaOverview, Filter } from "@directus/types";

type Context = Pick<ApiExtensionContext, "services" | "getSchema">;
type Score = {
  id: string;
  published: boolean;
  percentage_rated: string | number | null;
  score_total: string | number | null;
  date_updated: string | null;
  date_created: string | null;
  municipality: { status: string; localteam_id: string | null };
  catalog_version: { id: string; hidden: boolean };
};
type Entry = {
  id: string;
  source_hash: string;
  score_total: number | string;
  score: string;
  kind: string;
  occurred_at: string;
  previous_total: number | string | null;
  event_key: string;
};
type Rating = {
  id: string;
  rating: number | string | null;
  applicable: boolean | null;
  current_progress: string | null;
  source: string | null;
  why_not_applicable: string | null;
  date_updated: string | null;
  date_created: string | null;
  measure_id: { id: string; sector: string; weight: number | string | null };
};
const accountability = { admin: true, role: null, roles: [], user: null, app: false, ip: null };
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function historyFingerprint(score: Pick<Score, "score_total">, ratings: Rating[]): string {
  return hash([
    Number(score.score_total),
    ratings
      .map(({ date_updated: _updated, date_created: _created, ...rating }) => ({
        ...rating,
        rating: rating.rating === null ? null : Number(rating.rating),
        measure_id: { ...rating.measure_id, weight: Number(rating.measure_id.weight) },
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  ]);
}

/** Append immutable snapshots. Drafts and metadata-only changes never create events. */
export async function recordRatingHistory(
  context: Context,
  filter: Filter = {},
  mode: "initial" | "update" | "published" = "update",
): Promise<void> {
  const schema: SchemaOverview = await context.getSchema();
  // During the first deployment, the importer creates the collection after startup.
  if (!schema.collections?.municipality_rating_updates) return;
  const options = { schema, accountability };
  const scores = new context.services.ItemsService<Score>("municipality_scores", options);
  const history = new context.services.ItemsService<Entry>("municipality_rating_updates", options);
  const ratingsService = new context.services.ItemsService<Rating>("ratings_measures", options);
  let offset = 0;
  while (true) {
    const batch: Score[] = await scores.readByQuery({
      filter: {
        _and: [
          filter,
          {
            published: { _eq: true },
            percentage_rated: { _gte: 100 },
            municipality: { status: { _eq: "published" } },
            catalog_version: { hidden: { _eq: false } },
          },
        ],
      },
      fields: [
        "id",
        "published",
        "percentage_rated",
        "score_total",
        "date_updated",
        "date_created",
        "municipality.status",
        "municipality.localteam_id",
        "catalog_version.id",
        "catalog_version.hidden",
      ],
      sort: ["id"],
      limit: 100,
      offset,
    });
    for (const score of batch) {
      if (
        !score.published ||
        Number(score.percentage_rated) < 100 ||
        score.municipality?.status !== "published" ||
        score.catalog_version?.hidden !== false ||
        !score.municipality.localteam_id
      )
        continue;
      const [previous]: Entry[] = await history.readByQuery({
        filter: { score: { _eq: score.id } },
        fields: ["id", "source_hash", "score_total"],
        sort: ["-occurred_at", "-id"],
        limit: 1,
      });
      if (mode === "initial" && previous) continue;
      const ratings: Rating[] = await ratingsService.readByQuery({
        filter: {
          localteam_id: { _eq: score.municipality.localteam_id },
          approved: { _eq: true },
          status: { _eq: "published" },
          measure_published: { _eq: true },
          measure_id: { status: { _eq: "published" }, catalog_version: { _eq: score.catalog_version.id } },
        },
        fields: [
          "id",
          "rating",
          "applicable",
          "current_progress",
          "source",
          "why_not_applicable",
          "date_updated",
          "date_created",
          "measure_id.id",
          "measure_id.sector",
          "measure_id.weight",
        ],
        sort: ["id"],
        limit: -1,
      });
      const fingerprint = historyFingerprint(score, ratings);
      if (previous?.source_hash === fingerprint && mode !== "published") continue;
      const latestRating = Math.max(
        0,
        ...ratings.map((rating) => Date.parse(rating.date_updated || rating.date_created || "") || 0),
      );
      const initialDate = latestRating || Date.parse(score.date_updated || score.date_created || "") || Date.now();
      const kind = mode === "initial" ? "initial" : mode === "published" || !previous ? "published" : "update";
      const eventKey = hash([
        score.id,
        fingerprint,
        latestRating,
        kind,
        mode === "published" ? score.date_updated : null,
      ]);
      // Unique event_key makes concurrent deliveries and startup retries idempotent.
      const [duplicate] = await history.readByQuery({
        filter: { event_key: { _eq: eventKey } },
        fields: ["id"],
        limit: 1,
      });
      if (duplicate) continue;
      try {
        await history.createOne(
          {
            score: score.id,
            kind,
            occurred_at: new Date(mode === "initial" ? initialDate : Date.now()).toISOString(),
            score_total: Number(score.score_total),
            previous_total: kind === "initial" ? null : (previous?.score_total ?? null),
            source_hash: fingerprint,
            event_key: eventKey,
          },
          { emitEvents: false },
        );
      } catch (error) {
        // Only suppress a duplicate that another worker actually persisted.
        const [persisted] = await history.readByQuery({
          filter: { event_key: { _eq: eventKey } },
          fields: ["id"],
          limit: 1,
        });
        if (!persisted) throw error;
      }
    }
    if (batch.length < 100) break;
    offset += batch.length;
  }
}
