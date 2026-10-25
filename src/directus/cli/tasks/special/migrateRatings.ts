import { readItems, updateItems } from "@directus/sdk";
import { createInterface } from "node:readline/promises";
import { z } from "zod";
import createDirectusClient from "../shared/createDirectusClient.ts";

const idSchema = z.string().min(1);
const catalogSchema = z.object({ id: idSchema, name: z.string().min(1) });
const measureSchema = z.object({
  id: idSchema,
  measure_id: z.string().min(1),
  must_be_rated_again: z.boolean().nullable(),
});
const ratingSchema = z.object({
  id: idSchema,
  localteam_id: idSchema,
  status: z.enum(["published", "draft", "archived"]),
  internal_note: z.string().nullable(),
  current_progress: z.string().nullable(),
  source: z.string().nullable(),
  applicable: z.boolean().nullable(),
  why_not_applicable: z.string().nullable(),
  rating: z.union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/)]).nullable(),
});
type Rating = z.infer<typeof ratingSchema>;
type RatingUpdate = Partial<Omit<Rating, "id" | "localteam_id">>;
export const SUPERSEDED_RATING_UPDATE = Object.freeze({ status: "draft" as const });

export function buildNewRatingUpdate(oldRating: Rating, mustBeRatedAgain: boolean): RatingUpdate {
  const preservedText = {
    internal_note: oldRating.internal_note,
    current_progress: oldRating.current_progress,
    source: oldRating.source,
  };
  if (mustBeRatedAgain) return preservedText;
  return {
    ...preservedText,
    status: oldRating.status,
    applicable: oldRating.applicable,
    why_not_applicable: oldRating.why_not_applicable,
    rating: oldRating.rating,
  };
}

export interface RatingMigrationStore {
  catalogs(versions: string[]): Promise<unknown>;
  measures(catalogId: string): Promise<unknown>;
  ratings(measureId: string): Promise<unknown>;
  /** Apply only if the full rating still matches this snapshot; throw on conflict. */
  update(snapshot: Rating, patch: RatingUpdate): Promise<void>;
}

function uniqueBy<T>(rows: T[], key: (row: T) => string, label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const value = key(row);
    if (result.has(value)) throw new Error(`Ambiguous ${label}; no migration was started.`);
    result.set(value, row);
  }
  return result;
}

function matches(rating: Rating, patch: RatingUpdate): boolean {
  return Object.entries(patch).every(([key, value]) => rating[key as keyof Rating] === value);
}

function isEmpty(rating: Rating): boolean {
  return (
    rating.status === "draft" &&
    rating.applicable !== false &&
    rating.rating === null &&
    [rating.internal_note, rating.current_progress, rating.source, rating.why_not_applicable].every(
      (value) => !value?.trim(),
    )
  );
}

/** Preflight all matches before writing. Copies and retirement use optimistic concurrency checks. */
export async function migrateRatingVersions(store: RatingMigrationStore, oldVersion: string, newVersion: string) {
  if (!oldVersion.trim() || !newVersion.trim() || oldVersion === newVersion) {
    throw new Error("Choose two distinct, nonempty catalog versions.");
  }
  const catalogs = uniqueBy(
    catalogSchema.array().parse(await store.catalogs([oldVersion, newVersion])),
    (row) => row.name,
    "catalog versions",
  );
  const oldCatalog = catalogs.get(oldVersion);
  const newCatalog = catalogs.get(newVersion);
  if (!oldCatalog || !newCatalog || oldCatalog.id === newCatalog.id) {
    throw new Error("Both distinct catalog versions must exist.");
  }
  const oldMeasures = uniqueBy(
    measureSchema.array().parse(await store.measures(oldCatalog.id)),
    (row) => row.measure_id,
    "source measure identifiers",
  );
  const newMeasures = uniqueBy(
    measureSchema.array().parse(await store.measures(newCatalog.id)),
    (row) => row.measure_id,
    "destination measure identifiers",
  );
  const plan: { source: Rating; target: Rating; patch: RatingUpdate; alreadyCopied: boolean }[] = [];
  let skipped = 0;
  for (const [key, sourceMeasure] of oldMeasures) {
    const targetMeasure = newMeasures.get(key);
    if (!targetMeasure) continue;
    const sources = uniqueBy(
      ratingSchema.array().parse(await store.ratings(sourceMeasure.id)),
      (row) => row.localteam_id,
      "source local team ratings",
    );
    const targets = uniqueBy(
      ratingSchema.array().parse(await store.ratings(targetMeasure.id)),
      (row) => row.localteam_id,
      "destination local team ratings",
    );
    for (const source of sources.values()) {
      if (source.status === "archived") {
        skipped++;
        continue;
      }
      const target = targets.get(source.localteam_id);
      if (!target || target.id === source.id)
        throw new Error("Missing or invalid destination rating; no migration was started.");
      const patch = buildNewRatingUpdate(source, targetMeasure.must_be_rated_again === true);
      const alreadyCopied = matches(target, patch);
      // A rerun sees a drafted source. Never downgrade a populated destination's status or rating.
      if (source.status === "draft" && !isEmpty(target) && matches(target, buildNewRatingUpdate(source, true))) {
        skipped++;
        continue;
      }
      if (!isEmpty(target) && !alreadyCopied) {
        throw new Error("Destination contains different work; no migration was started.");
      }
      plan.push({ source, target, patch, alreadyCopied });
    }
  }
  let copied = 0;
  let drafted = 0;
  for (const { source, target, patch, alreadyCopied } of plan) {
    try {
      // Even an identical target is checked again before retiring the source.
      await store.update(target, alreadyCopied ? { status: target.status } : patch);
      copied++;
      if (source.status !== "draft") {
        await store.update(source, SUPERSEDED_RATING_UPDATE);
        drafted++;
      }
    } catch {
      // Provider errors can include research and tokens. Report only safe IDs and recovery state.
      throw new Error(
        `Migration stopped at source ${source.id}, destination ${target.id}. ` +
          `${copied} copies confirmed, ${drafted} sources drafted. Review these records before retrying.`,
      );
    }
  }
  return { copied, drafted, skipped };
}

function directusStore(): RatingMigrationStore {
  const client = createDirectusClient<{
    measure_catalog: z.infer<typeof catalogSchema>[];
    measures: (z.infer<typeof measureSchema> & { catalog_version: string; status: string })[];
    ratings_measures: (Rating & { measure_id: string })[];
  }>();
  const ratingFields = [
    "id",
    "localteam_id",
    "status",
    "internal_note",
    "current_progress",
    "source",
    "applicable",
    "why_not_applicable",
    "rating",
  ] as const;
  // Explicit pages also work when the API's maximum page size is below our requested size.
  async function pages<T>(read: (offset: number) => Promise<T[]>): Promise<T[]> {
    const result: T[] = [];
    for (let offset = 0; ;) {
      const rows = await read(offset);
      if (!rows.length) return result;
      result.push(...rows);
      offset += rows.length;
    }
  }
  return {
    catalogs: (versions) =>
      pages((offset) =>
        client.request(
          readItems("measure_catalog", {
            fields: ["id", "name"],
            filter: { name: { _in: versions } },
            sort: ["id"],
            limit: 100,
            offset,
          }),
        ),
      ),
    measures: (catalogId) =>
      pages((offset) =>
        client.request(
          readItems("measures", {
            fields: ["id", "measure_id", "must_be_rated_again"],
            filter: { catalog_version: { _eq: catalogId }, status: { _eq: "published" } },
            sort: ["id"],
            limit: 100,
            offset,
          }),
        ),
      ),
    ratings: (measureId) =>
      pages((offset) =>
        client.request(
          readItems("ratings_measures", {
            fields: [...ratingFields],
            filter: { measure_id: { _eq: measureId } },
            sort: ["id"],
            limit: 100,
            offset,
          }),
        ),
      ),
    async update(snapshot, patch) {
      const conditions = Object.entries(snapshot).map(([key, value]) => ({
        [key]: value === null ? { _null: true } : { _eq: value },
      }));
      const updated = await client.request(
        updateItems(
          "ratings_measures",
          {
            filter: { _and: conditions },
          },
          patch,
          { fields: ["id"] },
        ),
      );
      if (updated.length !== 1 || updated[0]?.id !== snapshot.id) throw new Error("Rating changed during migration.");
    },
  };
}

export default async function migrateRatings(oldVersion: string | undefined, newVersion: string | undefined) {
  if (!oldVersion || !newVersion || oldVersion === newVersion)
    throw new Error("Provide two distinct catalog versions.");
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let answer: string;
  try {
    answer = await prompt.question(
      `Copy ratings from "${oldVersion}" to "${newVersion}" and draft successfully copied sources? (yes/no): `,
    );
  } finally {
    prompt.close();
  }
  if (answer.trim().toLowerCase() !== "yes") {
    console.info("Migration cancelled.");
    return;
  }
  const summary = await migrateRatingVersions(directusStore(), oldVersion, newVersion);
  console.info(
    `Migration finished: ${summary.copied} copies confirmed, ${summary.drafted} sources drafted, ${summary.skipped} skipped.`,
  );
}
