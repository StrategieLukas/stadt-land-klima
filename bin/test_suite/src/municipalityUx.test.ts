import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  reportFilename,
  inlinePdfDisposition,
} from "../../../src/directus/extensions/endpoint-pdf-service/src/filename.ts";
import { municipalityRanks } from "../../../src/directus/extensions/hook-calc-score-and-ranks/src/ranks.ts";
import {
  historyFingerprint,
  recordRatingHistory,
} from "../../../src/directus/extensions/hook-calc-score-and-ranks/src/history.ts";
import { sectorPreviewSvg } from "../../../src/frontend/server/utils/sectorPreview.ts";

const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));

test("report names preserve Unicode, use the latest assessment date in Berlin and cannot inject headers or paths", () => {
  const name = reportFilename("München / Süd\r\n\u202e", ["2026-01-01T23:30:00Z", "2025-01-01", null], "Bewertung");
  assert.equal(name, "StadtLandKlima-Bewertung_München_Süd_vom-2026-01-02.pdf");
  const disposition = inlinePdfDisposition(name);
  assert.match(disposition, /^inline; filename="StadtLandKlima-Bewertung_Munchen_Sud_/);
  assert.match(disposition, /filename\*=UTF-8''StadtLandKlima-Bewertung_M%C3%BCnchen_S%C3%BCd/);
  assert.doesNotMatch(disposition, /[\r\n]/);
  assert.match(reportFilename("", ["invalid"], "Wahlcheck"), /Wahlcheck_Kommune_vom-unbekannt.pdf$/);
});

test("canonical ranks exclude drafts and incomplete assessments, compare numeric ties and preserve competition gaps", () => {
  const make = (id: string, score_total: number | string, name: string, extra = {}) => ({
    id,
    score_total,
    rank: -1,
    published: true,
    percentage_rated: 100,
    municipality: { status: "published", name },
    ...extra,
  });
  const ranked = municipalityRanks([
    make("b", 80, "Beta"),
    make("a", "80.00000", "Alpha"),
    make("c", 70, "Gamma"),
    make("d", 100, "Draft", { published: false }),
    make("e", 100, "Incomplete", { percentage_rated: 99 }),
    make("f", 100, "Private parent", { municipality: { status: "draft", name: "Private" } }),
  ]);
  assert.deepEqual(
    [...ranked],
    [
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ],
  );
});

test("assessment history seeds once, retains future changes and ignores metadata and unpublished assessments", async () => {
  const score = {
    id: "score",
    published: true,
    percentage_rated: 100,
    score_total: 50,
    date_updated: "2026-01-01T12:00:00Z",
    date_created: "2025-01-01T12:00:00Z",
    municipality: { status: "published", localteam_id: "team" },
    catalog_version: { id: "catalog", hidden: false },
  };
  const rating = {
    id: "rating",
    rating: "0.5",
    applicable: true,
    current_progress: "Published text",
    source: null,
    why_not_applicable: null,
    date_updated: "2026-01-02T12:00:00Z",
    date_created: null,
    measure_id: { id: "measure", sector: "energy", weight: "1" },
  };
  const entries: Record<string, any>[] = [];
  class ItemsService {
    constructor(readonly collection: string) {}
    async readByQuery(query: Record<string, any>) {
      if (this.collection === "municipality_scores") return [score];
      if (this.collection === "ratings_measures") return [rating];
      if (query.filter.event_key) return entries.filter((entry) => entry.event_key === query.filter.event_key._eq);
      return entries.slice(-1);
    }
    async createOne(entry: Record<string, any>) {
      entries.push({ ...entry, id: String(entries.length + 1) });
    }
  }
  type Context = Parameters<typeof recordRatingHistory>[0];
  const context = {
    services: { ItemsService },
    getSchema: async () => ({ collections: { municipality_rating_updates: {} } }),
  } as unknown as Context;
  await recordRatingHistory(context, {}, "initial");
  await recordRatingHistory(context, {}, "initial");
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.kind, "initial");
  assert.equal(entries[0]?.occurred_at, "2026-01-02T12:00:00.000Z");
  assert.equal(entries[0]?.previous_total, null);
  const fingerprint = historyFingerprint(score, [rating]);
  rating.date_updated = "2026-01-03T12:00:00Z";
  score.date_updated = "2026-01-03T12:00:00Z";
  assert.equal(historyFingerprint(score, [rating]), fingerprint);
  await recordRatingHistory(context);
  assert.equal(entries.length, 1);
  rating.current_progress = "Revised published text";
  await recordRatingHistory(context);
  assert.equal(entries.length, 2);
  assert.equal(entries[1]?.previous_total, 50);
  score.score_total = 60;
  rating.rating = "0.6";
  rating.date_updated = "2026-01-04T12:00:00Z";
  await recordRatingHistory(context);
  score.score_total = 50;
  rating.rating = "0.5";
  rating.date_updated = "2026-01-05T12:00:00Z";
  await recordRatingHistory(context);
  assert.deepEqual(
    entries.map((entry) => entry.score_total),
    [50, 50, 60, 50],
  );
  score.published = false;
  rating.current_progress = "Secret";
  await recordRatingHistory(context);
  assert.equal(entries.length, 4);
  score.published = true;
  await recordRatingHistory(context, {}, "published");
  assert.equal(entries[4]?.kind, "published");
  assert.equal(entries[0]?.score_total, 50);
  assert.ok(entries.every((entry) => !JSON.stringify(entry).includes("Secret")));
});

function publicHistory(rows: unknown[]) {
  const module = { exports: {} as { default: (event: unknown) => Promise<any> } };
  const source = readFileSync(
    new URL("../../../src/frontend/server/api/public/municipality-updates.get.ts", import.meta.url),
    "utf8",
  );
  const commands: Record<string, any>[] = [];
  const h3 = {
    defineEventHandler: (fn: unknown) => fn,
    getQuery: (event: { query?: unknown }) => event.query ?? {},
    setResponseHeader() {},
    createError: (value: object) => Object.assign(new Error("invalid"), value),
  };
  const dependencies: Record<string, unknown> = {
    h3,
    zod: frontend("zod"),
    "@directus/sdk": {
      readItems: (collection: string, query: object) => {
        commands.push({ collection, query });
        return query;
      },
    },
    "~/shared/contracts/municipality": frontend("./shared/contracts/municipality.ts"),
    "~/shared/contracts/municipalityUpdates": frontend("./shared/contracts/municipalityUpdates.ts"),
    "~/server/utils/directusServerClient": { createDirectusServerClient: () => ({ request: async () => rows }) },
    "~/server/utils/cmsValue": { cmsRows: (value: unknown) => value },
    "~/server/utils/parseCms": {
      parseCms: (schema: { parse(value: unknown): unknown }, value: unknown) => schema.parse(value),
    },
    "~/server/utils/publicQuery": { queryText: (value: unknown) => value, queryLimit: () => 1 },
    "~/server/utils/rateLimit": { rateLimit: async () => {} },
  };
  runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
      .outputText,
    {
      module,
      exports: module.exports,
      Buffer,
      require: (id: string) => {
        assert.ok(id in dependencies, id);
        return dependencies[id];
      },
    },
  );
  return { handler: module.exports.default, commands };
}

test("history API checks current publication, strips internal fields, and paginates deterministically", async () => {
  const entry = {
    id: "11111111-1111-4111-8111-111111111111",
    occurred_at: "2026-01-01T12:00:00Z",
    kind: "initial",
    score_total: "50",
    previous_total: null,
    source_hash: "private",
    score: {
      published: true,
      percentage_rated: "100",
      municipality: { name: "Town", slug: "town", status: "published" },
      catalog_version: { name: "v2026", hidden: false },
    },
  };
  const second = { ...entry, id: "22222222-2222-4222-8222-222222222222" };
  const f = publicHistory([entry, second]);
  const result = await f.handler({ query: {} });
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].catalog, "v2026");
  assert.ok(result.nextCursor);
  assert.doesNotMatch(JSON.stringify(result), /source_hash|private|localteam/);
  await f.handler({ query: { cursor: result.nextCursor } });
  assert.equal(f.commands[1]?.query.filter._or[1].id._lt, entry.id);
  await assert.rejects(f.handler({ query: { cursor: "bad" } }), { statusCode: 400 });
  for (const score of [
    { ...entry.score, published: false },
    { ...entry.score, percentage_rated: 99 },
    { ...entry.score, municipality: { ...entry.score.municipality, status: "draft" } },
    { ...entry.score, catalog_version: { ...entry.score.catalog_version, hidden: true } },
  ]) {
    const hidden = publicHistory([{ ...entry, score }]);
    assert.equal((await hidden.handler({ query: {} })).updates.length, 0);
  }
});

test("sector social preview is a real 1200×630 PNG with bounded scores and escaped names", () => {
  const svg = sectorPreviewSvg(
    "Town <script>alert(1)</script>",
    "v2026 & next",
    150,
    [
      { label: "<Energy>", score: -4 },
      { label: "Buildings", score: 75 },
    ],
    "Assessment",
  );
  assert.doesNotMatch(svg, /<script|<Energy>|href=|NaN/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /100.0%/);
  const { Resvg } = frontend("@resvg/resvg-js");
  const png = new Resvg(svg).render().asPng() as Buffer;
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
