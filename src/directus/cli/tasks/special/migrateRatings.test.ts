import assert from "node:assert/strict";
import { test } from "node:test";
import { buildNewRatingUpdate, migrateRatingVersions, type RatingMigrationStore } from "./migrateRatings.ts";

type Rating = Parameters<RatingMigrationStore["update"]>[0];
const source = (): Rating => ({
  id: "source",
  localteam_id: "team",
  status: "published",
  internal_note: "Internal research",
  current_progress: "Bereits umgesetzt",
  source: "https://example.org/evidence",
  applicable: false,
  why_not_applicable: "Outside remit",
  rating: "0.5",
});
const target = (): Rating => ({
  id: "target",
  localteam_id: "team",
  status: "draft",
  internal_note: null,
  current_progress: null,
  source: null,
  applicable: true,
  why_not_applicable: null,
  rating: null,
});
function fixture(reRate = false) {
  const oldRatings = [source()];
  const newRatings = [target()];
  const writes: { id: string; patch: Parameters<RatingMigrationStore["update"]>[1] }[] = [];
  let failId = "";
  const catalogs = [
    { id: "old", name: "beta" },
    { id: "new", name: "v1" },
  ];
  const measures = {
    old: [{ id: "old-measure", measure_id: "1.1", must_be_rated_again: null }],
    new: [{ id: "new-measure", measure_id: "1.1", must_be_rated_again: reRate }],
  };
  const store: RatingMigrationStore = {
    async catalogs() {
      return catalogs;
    },
    async measures(id) {
      return id === "old" ? measures.old : measures.new;
    },
    async ratings(id) {
      return structuredClone(id === "old-measure" ? oldRatings : newRatings);
    },
    async update(snapshot, patch) {
      if (snapshot.id === failId) throw new Error("private research and credential");
      const row = [...oldRatings, ...newRatings].find((item) => item.id === snapshot.id);
      assert.deepEqual(row, snapshot, "production passes full original snapshots for concurrency checks");
      writes.push({ id: snapshot.id, patch });
      Object.assign(row!, patch);
    },
  };
  return {
    store,
    oldRatings,
    newRatings,
    writes,
    catalogs,
    measures,
    fail(id: string) {
      failId = id;
    },
  };
}

test("rerating carries research, progress and sources while preserving the destination assessment", async () => {
  const f = fixture(true);
  const evidence = buildNewRatingUpdate(source(), true);
  assert.deepEqual(evidence, {
    internal_note: "Internal research",
    current_progress: "Bereits umgesetzt",
    source: "https://example.org/evidence",
  });
  assert.deepEqual(await migrateRatingVersions(f.store, "beta", "v1"), { copied: 1, drafted: 1, skipped: 0 });
  assert.deepEqual(f.newRatings[0], { ...target(), ...evidence });
  assert.equal(f.oldRatings[0]!.status, "draft");
  assert.deepEqual(
    f.writes.map((row) => row.id),
    ["target", "source"],
  );
});

test("unchanged measures copy the complete rating and reruns preserve subsequent destination edits", async () => {
  const f = fixture();
  await migrateRatingVersions(f.store, "beta", "v1");
  assert.deepEqual(f.newRatings[0], { ...source(), id: "target" });
  f.newRatings[0]!.rating = "1";
  const count = f.writes.length;
  assert.deepEqual(await migrateRatingVersions(f.store, "beta", "v1"), { copied: 0, drafted: 0, skipped: 1 });
  assert.equal(f.newRatings[0]!.rating, "1");
  assert.equal(f.writes.length, count);
});

test("copy failure or optimistic conflict leaves the source published and reports sanitized failure", async () => {
  const f = fixture();
  f.fail("target");
  await assert.rejects(migrateRatingVersions(f.store, "beta", "v1"), /0 copies confirmed, 0 sources drafted/);
  assert.equal(f.oldRatings[0]!.status, "published");
  assert.deepEqual(f.writes, []);
});

test("a failed source retirement is recoverable without rewriting different destination content", async () => {
  const f = fixture();
  f.fail("source");
  await assert.rejects(migrateRatingVersions(f.store, "beta", "v1"), /1 copies confirmed, 0 sources drafted/);
  assert.equal(f.oldRatings[0]!.status, "published");
  assert.equal(f.newRatings[0]!.status, "published");
  f.fail("");
  await migrateRatingVersions(f.store, "beta", "v1");
  assert.equal(f.oldRatings[0]!.status, "draft");
});

test("preflight refuses missing targets, duplicate teams/measures/catalogs and populated destinations before any writes", async () => {
  for (const alter of [
    (f: ReturnType<typeof fixture>) => {
      f.newRatings.length = 0;
    },
    (f: ReturnType<typeof fixture>) => {
      f.oldRatings.push({ ...source(), id: "later-source", localteam_id: "missing-team" });
    },
    (f: ReturnType<typeof fixture>) => {
      f.newRatings.push({ ...target(), id: "duplicate" });
    },
    (f: ReturnType<typeof fixture>) => {
      f.oldRatings.push({ ...source(), id: "duplicate" });
    },
    (f: ReturnType<typeof fixture>) => {
      f.measures.new.push({ ...f.measures.new[0]!, id: "duplicate" });
    },
    (f: ReturnType<typeof fixture>) => {
      f.catalogs.push({ id: "duplicate", name: "v1" });
    },
    (f: ReturnType<typeof fixture>) => {
      f.newRatings[0]!.source = "New research";
    },
    (f: ReturnType<typeof fixture>) => {
      f.oldRatings[0]!.current_progress = 123 as unknown as string;
    },
  ]) {
    const f = fixture();
    alter(f);
    await assert.rejects(migrateRatingVersions(f.store, "beta", "v1"));
    assert.deepEqual(f.writes, []);
    assert.equal(f.oldRatings[0]!.status, "published");
  }
});

test("same or absent catalog versions never write; archived sources are retained", async () => {
  const f = fixture();
  for (const [oldVersion, newVersion] of [
    ["beta", "beta"],
    ["", "v1"],
    ["beta", "missing"],
  ]) {
    await assert.rejects(migrateRatingVersions(f.store, oldVersion!, newVersion!));
  }
  f.oldRatings[0]!.status = "archived";
  assert.deepEqual(await migrateRatingVersions(f.store, "beta", "v1"), { copied: 0, drafted: 0, skipped: 1 });
  assert.deepEqual(f.writes, []);
});
