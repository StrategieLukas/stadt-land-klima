import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  resolveMunicipalityById,
  resolveMissingMunicipalityData,
  type ResolverContext,
} from "../../../src/directus/extensions/municipality-climate-region/src/resolver.js";

type Row = {
  id: string;
  name: string | null;
  state: string | null;
  ars: string | null;
  climate_region_type: string | null;
};
const city = (extra: Partial<Row> = {}): Row => ({
  id: "city",
  name: "Münster",
  state: "Nordrhein-Westfalen",
  ars: null,
  climate_region_type: null,
  ...extra,
});
const ars = "055150000000";
const env = {
  SLZ_API_BASE_URL: "https://areas.example/",
  SLZ_NOMINATIM_URL: "https://names.example/",
  SLZ_OVERPASS_URL: "https://tags.example/api/interpreter",
  SLZ_BASIC_AUTH_USER: "service",
  SLZ_BASIC_AUTH_PASSWORD: "private-credential",
};
const climate = (value = "Mittelgebirgsvorland", code = ars) => ({
  type: "FeatureCollection",
  numberMatched: 1,
  numberReturned: 1,
  features: [{ type: "Feature", properties: { area_ars: code, klimaraumtyp_name: value } }],
});

/** Replace only Knex transport; retain production validation, matching and conditional writes. */
function fixture(initial: Row[]) {
  const rows = structuredClone(initial);
  const logs: string[] = [];
  const pages: number[] = [];
  const writes: Partial<Row>[] = [];
  const failed = new Set<string>();
  const database = (table: string) => {
    assert.equal(table, "municipalities");
    const filters: Array<(row: Row) => boolean> = [];
    let limit = Infinity;
    let ordered = false;
    const read = () => {
      if (ordered) pages.push(limit);
      return rows
        .filter((row) => filters.every((predicate) => predicate(row)))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, limit);
    };
    const query = {
      select(...fields: string[]) {
        assert.deepEqual(fields, ["id", "name", "state", "ars", "climate_region_type"]);
        return query;
      },
      where(value: Partial<Row> | string, _operator?: string, cursor?: string) {
        if (typeof value === "string") filters.push((row) => row.id > (cursor ?? ""));
        else filters.push((row) => Object.entries(value).every(([key, entry]) => row[key as keyof Row] === entry));
        return query;
      },
      orderBy(field: string) {
        assert.equal(field, "id");
        ordered = true;
        return query;
      },
      limit(value: number) {
        limit = value;
        return query;
      },
      async first() {
        return read()[0];
      },
      async update(update: Partial<Row>) {
        const found = read();
        if (found.some((row) => failed.has(row.id))) throw new Error("private-database-detail");
        for (const row of found) Object.assign(row, update);
        if (found.length) writes.push(update);
        return found.length;
      },
      then<T>(fulfilled: (value: Row[]) => T, rejected?: (reason: unknown) => T) {
        return Promise.resolve(read()).then(fulfilled, rejected);
      },
    };
    return query;
  };
  const log = (message: string) => logs.push(message);
  const context: ResolverContext = {
    // The callable query builder is the sole transport boundary replaced by this fixture.
    database: database as unknown as ResolverContext["database"],
    env,
    logger: { info: log, warn: log, error: log },
  };
  return { rows, logs, pages, writes, failed, context };
}

test("resolves an exact unique reasonable area and its checked climate region without following redirects", async (t) => {
  const f = fixture([city()]);
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(String(input));
    requests.push(url.pathname);
    assert.equal(options?.redirect, "error");
    assert.equal(
      new Headers(options?.headers).get("authorization"),
      `Basic ${Buffer.from("service:private-credential").toString("base64")}`,
    );
    if (url.pathname.includes("search/areas")) {
      assert.equal(url.searchParams.get("q"), "Münster");
      return Response.json({
        results: [
          { name: "Munster", ars, is_reasonable_for_municipal_rating: true },
          { name: "Münster", ars, is_reasonable_for_municipal_rating: true },
          { name: "Other", ars: "012345678901", is_reasonable_for_municipal_rating: true },
        ],
      });
    }
    assert.equal(url.searchParams.get("area"), ars);
    assert.equal(url.searchParams.get("limit"), "2");
    assert.equal(options?.method ?? "GET", "GET");
    assert.equal(options?.body, undefined);
    return Response.json(climate(" Mittelgebirgsvorland "));
  });
  await resolveMunicipalityById("city", f.context);
  assert.equal(f.rows[0]!.ars, ars);
  assert.equal(f.rows[0]!.climate_region_type, "Mittelgebirgsvorland");
  assert.deepEqual(requests, ["/api/search/areas/", "/api/collections/climate-region-type/items/"]);
});

test("Nominatim uses state and country; one bounded Overpass query requires matching element IDs and unique ARS", async (t) => {
  const f = fixture([city()]);
  let ambiguous = true;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === "areas.example") {
      if (url.pathname === "/api/collections/climate-region-type/items/") return Response.json(climate());
      return Response.json({ results: [] });
    }
    if (url.hostname === "names.example") {
      assert.equal(url.pathname, "/search");
      assert.equal(url.searchParams.get("accept-language"), "de");
      assert.match(url.searchParams.get("q")!, /Nordrhein-Westfalen, Deutschland$/);
      assert.equal(url.searchParams.get("countrycodes"), "de");
      return Response.json([
        { name: "Münster", osm_type: "relation", osm_id: 1, address: { state: "Nordrhein-Westfalen" } },
        { name: "Münster", osm_type: "relation", osm_id: 2, address: { state: "Nordrhein-Westfalen" } },
        { name: "Münster", osm_type: "relation", osm_id: 3, address: { state: "Hessen" } },
      ]);
    }
    const query = new URLSearchParams(String(options?.body)).get("data")!;
    assert.match(query, /relation\(1\);relation\(2\);/);
    assert.doesNotMatch(query, /relation\(3\)/);
    return Response.json({
      elements: [
        { type: "relation", id: 1, tags: { "de:regionalschluessel": ars } },
        { type: "relation", id: 2, tags: { "de:regionalschluessel": ambiguous ? "012345678901" : ars } },
        { type: "relation", id: 999, tags: { "de:regionalschluessel": "999999999999" } },
      ],
    });
  });
  await resolveMunicipalityById("city", f.context);
  assert.equal(f.rows[0]!.ars, null);
  ambiguous = false;
  await resolveMunicipalityById("city", f.context);
  assert.equal(f.rows[0]!.ars, ars);
});

test("ambiguous/non-rateable area names, invalid geometry IDs and malformed ARS never cause an assignment", async (t) => {
  const f = fixture([city()]);
  let overpass = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.hostname === "areas.example")
      return Response.json({
        results: [
          { name: "Münster", ars, is_reasonable_for_municipal_rating: true },
          { name: "Münster", ars: "012345678901", is_reasonable_for_municipal_rating: true },
          { name: "Münster", ars: "999999999999", is_reasonable_for_municipal_rating: false },
        ],
      });
    if (url.hostname === "names.example")
      return Response.json([{ name: "Münster", osm_type: "relation", osm_id: "1);out;" }]);
    overpass++;
    return Response.json({ elements: [] });
  });
  await resolveMunicipalityById("city", f.context);
  assert.equal(overpass, 0);
  assert.deepEqual(f.writes, []);
});

test("preserves existing values, rejects mismatched/oversized climate data and never logs provider secrets", async (t) => {
  const f = fixture([city({ ars })]);
  let response: unknown = climate("Wrong region", "012345678901");
  t.mock.method(globalThis, "fetch", async () => Response.json(response));
  await resolveMunicipalityById("city", f.context);
  assert.deepEqual(f.writes, []);
  response = climate("x".repeat(256));
  await resolveMunicipalityById("city", f.context);
  assert.deepEqual(f.writes, []);
  for (const invalid of [
    { ...climate(), numberMatched: 2 },
    { ...climate(), numberReturned: 0 },
    { ...climate(), features: [] },
    { ...climate(), features: [...climate().features, ...climate().features] },
  ]) {
    response = invalid;
    await resolveMunicipalityById("city", f.context);
    assert.deepEqual(f.writes, []);
  }
  response = { errors: [{ message: "private-credential provider detail" }] };
  await resolveMunicipalityById("city", f.context);
  assert.deepEqual(f.writes, []);
  assert.doesNotMatch(f.logs.join("\n"), /private-credential|provider detail/);
  f.rows[0]!.climate_region_type = "Operator value";
  await resolveMunicipalityById("city", f.context);
  assert.equal(f.rows[0]!.climate_region_type, "Operator value");
});

test("late responses cannot overwrite edits made while the request was pending", async (t) => {
  const f = fixture([city({ ars })]);
  t.mock.method(globalThis, "fetch", async () => {
    f.rows[0]!.climate_region_type = "Operator value";
    return Response.json(climate());
  });
  await resolveMunicipalityById("city", f.context);
  assert.equal(f.rows[0]!.climate_region_type, "Operator value");
  assert.deepEqual(f.writes, []);
});

test("concurrent row lookups share work; batches paginate and isolate failing records", async (t) => {
  const f = fixture([city({ ars })]);
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    await Promise.resolve();
    return Response.json(climate());
  });
  await Promise.all([resolveMunicipalityById("city", f.context), resolveMunicipalityById("city", f.context)]);
  assert.equal(requests, 1);
  assert.equal(f.writes.length, 1);
  const batch = fixture(
    Array.from({ length: 105 }, (_, index) =>
      city({ id: String(index).padStart(4, "0"), ars, climate_region_type: index < 100 ? "Existing" : null }),
    ),
  );
  batch.failed.add("0101");
  const first = resolveMissingMunicipalityData(batch.context);
  assert.equal(first, resolveMissingMunicipalityData(batch.context));
  const summary = await first;
  assert.deepEqual(summary, { processed: 5, arsResolved: 0, climateRegionResolved: 4, unresolved: 0, failed: 1 });
  assert.deepEqual(batch.pages, [100, 100]);
  assert.doesNotMatch(batch.logs.join("\n"), /private-database-detail/);
});

test("misconfigured URLs, oversized bodies and timeouts fail without writes", async (t) => {
  const f = fixture([city({ ars })]);
  for (const url of [
    "file:///etc/passwd",
    "https://user:private-credential@areas.example",
    "https://areas.example?token=secret",
    "https://user:private-credential@",
  ]) {
    await assert.rejects(resolveMunicipalityById("city", { ...f.context, env: { ...env, SLZ_API_BASE_URL: url } }));
  }
  t.mock.method(globalThis, "fetch", async () => new Response("x".repeat(1024 * 1024 + 1)));
  await resolveMunicipalityById("city", f.context);
  assert.deepEqual(f.writes, []);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("private-credential timeout")), { once: true });
      }),
  );
  const pending = resolveMunicipalityById("city", f.context);
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  t.mock.timers.tick(8_001);
  await pending;
  assert.deepEqual(f.writes, []);
  assert.doesNotMatch(f.logs.join("\n"), /private-credential/);
});

function load(path: string, dependencies: Record<string, unknown>) {
  const file = new URL(`../../../src/directus/extensions/municipality-climate-region/src/${path}`, import.meta.url);
  const module = { exports: {} as Record<string, any> };
  const require = createRequire(file);
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (name: string) => (name in dependencies ? dependencies[name] : require(name)),
    },
  );
  return module.exports.default;
}

test("manual backfill rejects anonymous and non-admin callers before reading data", async () => {
  let runs = 0;
  const operation = load("operation/api.ts", {
    "@directus/extensions-sdk": { defineOperationApi: (value: unknown) => value },
    "@directus/errors": {
      createError: (_code: string, message: string, status: number) =>
        class extends Error {
          status = status;
          constructor() {
            super(message);
          }
        },
    },
    "../resolver.js": {
      resolveMissingMunicipalityData: async () => {
        runs++;
        return { processed: 0 };
      },
    },
  });
  for (const accountability of [null, {}, { admin: false }])
    await assert.rejects(operation.handler({}, { accountability }), { status: 403 });
  assert.equal(runs, 0);
  await operation.handler({}, { accountability: { admin: true } });
  assert.equal(runs, 1);
});

test("hooks resolve creates and relevant updates, ignore unrelated writes and register the daily job", async () => {
  const actions = new Map<string, (meta: Record<string, unknown>) => Promise<void>>();
  const ids: unknown[] = [];
  let scheduled: (() => Promise<void>) | undefined;
  let runs = 0;
  const hook = load("hook.ts", {
    "@directus/extensions-sdk": { defineHook: (value: unknown) => value },
    "./resolver.js": {
      resolveMunicipalityById: async (id: unknown) => {
        ids.push(id);
      },
      resolveMissingMunicipalityData: async () => {
        runs++;
      },
    },
  });
  hook(
    {
      action: (name: string, fn: (meta: Record<string, unknown>) => Promise<void>) => actions.set(name, fn),
      schedule: (cron: string, fn: () => Promise<void>) => {
        assert.equal(cron, "0 3 * * *");
        scheduled = fn;
      },
    },
    { logger: { warn() {}, error() {} } },
  );
  await actions.get("items.create")!({ collection: "municipalities", key: "created" });
  await actions.get("items.update")!({ collection: "municipalities", keys: ["updated"], payload: { state: "Bayern" } });
  await actions.get("items.update")!({
    collection: "municipalities",
    keys: ["cleared"],
    payload: { climate_region_type: null },
  });
  await actions.get("items.update")!({
    collection: "municipalities",
    keys: ["ignored"],
    payload: { description: "Text" },
  });
  await actions.get("items.create")!({ collection: "pages", key: "ignored" });
  assert.deepEqual(ids, ["created", "updated", "cleared"]);
  await scheduled!();
  assert.equal(runs, 1);
});
