import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadRegionMunicipalities,
  regionMapBounds,
  regionSelection,
} from "../../../src/frontend/utils/regionMunicipalities.js";
import { municipalityFixture, overviewFixture } from "./fixtures/municipalityOverview.js";

const municipality = (ars: string) => ({ ...municipalityFixture, ars, data_status: "excluded" as const, value: null });
const page = (results: ReturnType<typeof municipality>[], next_cursor: string | null, count = 3) => ({
  snapshot_id: overviewFixture.snapshot_id,
  results,
  count,
  next_cursor,
});

test("region selection preserves ARS zeroes and maps Regierungsbezirke to their parent state", () => {
  assert.deepEqual(regionSelection("000000000000", 1), { prefix: "", scope: "DE" });
  assert.deepEqual(regionSelection("080000000000", 2), { prefix: "08", scope: "080000000000" });
  assert.deepEqual(regionSelection("082000000000", 3), { prefix: "082", scope: "080000000000" });
  assert.deepEqual(regionSelection("082150000000", 4), { prefix: "08215", scope: "082150000000" });
  assert.deepEqual(regionSelection("100000000000", 3), { prefix: "100", scope: "100000000000" });
  assert.throws(() => regionSelection("08", 3));
  assert.throws(() => regionSelection("//evil", 2));
  assert.throws(() => regionSelection("082150000000", 6));
});

test("region members span every snapshot page, include unrated areas and exclude neighbouring regions", async () => {
  const cursors: Array<string | number | undefined> = [];
  const rows = await loadRegionMunicipalities(overviewFixture, "082", async (url, query) => {
    assert.match(url, /snapshot=fixture-edition-1/);
    assert.equal(query.limit, 100);
    cursors.push(query.cursor);
    return query.cursor
      ? page([municipality("082120000000"), municipality("083120000000")], null)
      : page([municipality("082155001000")], "page-two");
  });
  assert.deepEqual(cursors, [undefined, "page-two"]);
  assert.deepEqual(
    rows.map((row) => row.ars),
    ["082155001000", "082120000000"],
  );
  assert(rows.every((row) => row.value === null && row.data_status === "excluded"));
});

test("failed, truncated, duplicate, cycling or changed snapshot pages refuse partial region results", async () => {
  for (const invalid of [
    page([], null),
    page([municipality("082120000000")], null, 2),
    page([municipality("082120000000")], "next", 2),
    { ...page([municipality("082155001000")], null, 2), snapshot_id: "new-snapshot" },
  ]) {
    let calls = 0;
    await assert.rejects(
      loadRegionMunicipalities(overviewFixture, "082", async () =>
        calls++ === 0 ? page([municipality("082120000000")], "next", 3) : invalid,
      ),
    );
  }
  let calls = 0;
  await assert.rejects(
    loadRegionMunicipalities(overviewFixture, "082", async () => {
      if (calls++) throw new Error("upstream unavailable");
      return page([municipality("082120000000")], "next");
    }),
  );
});

test("Regierungsbezirk map bounds combine only its districts from the same snapshot", async () => {
  const context = { ...overviewFixture, scope: { ars: "080000000000", name: "BW", state_ars: "080000000000" } };
  const fetcher = async (_url: string, query: Record<string, string | number | undefined>) => {
    assert.equal(query.parent_ars, "080000000000");
    return {
      snapshot_id: context.snapshot_id,
      results: [
        { ars: "082110000000", name: "A", level: "district", parent_ars: "080000000000", bounds: [8, 48, 9, 49] },
        { ars: "082150000000", name: "B", level: "district", parent_ars: "080000000000", bounds: [7, 48.5, 9.5, 50] },
        { ars: "081110000000", name: "C", level: "district", parent_ars: "080000000000", bounds: [10, 48, 11, 49] },
      ],
    };
  };
  assert.deepEqual(await regionMapBounds(context, "082", fetcher), [7, 48, 9.5, 50]);
  await assert.rejects(regionMapBounds(context, "083", fetcher));
  await assert.rejects(
    regionMapBounds(context, "082", async () => ({
      ...(await fetcher("", { parent_ars: "080000000000" })),
      snapshot_id: "different",
    })),
  );
});

test("the regional aggregate is one protected server read and never returns partial results", async () => {
  const { readFileSync } = await import("node:fs");
  const { runInNewContext } = await import("node:vm");
  const { default: ts } = await import("typescript");
  const { AreaSchema } = await import("../../../src/frontend/shared/contracts/search.js");
  const { MunicipalityOverviewSchema } = await import("../../../src/frontend/shared/contracts/municipalityOverview.js");
  const { RegionMunicipalitiesResponseSchema } =
    await import("../../../src/frontend/shared/contracts/regionMunicipalities.js");
  const { checkedOverviewUrl, overviewEndpoint } = await import("../../../src/frontend/utils/municipalityOverview.js");
  let allowed = true;
  let broken = false;
  const calls: string[] = [];
  const context = {
    ...overviewFixture,
    scope: { ars: "080000000000", name: "BW", state_ars: "080000000000" },
  };
  const source = readFileSync(
    new URL("../../../src/frontend/server/api/public/regions/[ars].get.ts", import.meta.url),
    "utf8",
  );
  const module = { exports: {} };
  const headers = new Map<string, string>();
  runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
      .outputText,
    {
      module,
      exports: module.exports,
      defineEventHandler: (handler: unknown) => handler,
      getRouterParam: (event: { ars: string }) => event.ars,
      getQuery: () => ({}),
      setResponseHeader: (_event: unknown, name: string, value: string) => headers.set(name, value),
      createError: (error: { statusCode: number; statusMessage: string }) =>
        Object.assign(new Error(error.statusMessage), error),
      require: (id: string) => {
        if (id.endsWith("/contracts/search")) return { AreaSchema };
        if (id.endsWith("/contracts/municipalityOverview")) return { MunicipalityOverviewSchema };
        if (id.endsWith("/contracts/regionMunicipalities")) return { RegionMunicipalitiesResponseSchema };
        if (id.endsWith("/utils/municipalityOverview")) return { checkedOverviewUrl, overviewEndpoint };
        if (id.endsWith("/utils/regionMunicipalities"))
          return { loadRegionMunicipalities, regionMapBounds, regionSelection };
        if (id.endsWith("/utils/publicQuery")) return { queryChoice: () => "de-DE" };
        if (id.endsWith("/utils/rateLimit"))
          return {
            rateLimit: async (_event: unknown, key: string) => {
              assert.equal(key, "region-municipalities");
              return allowed;
            },
          };
        if (id.endsWith("/utils/stadtlandzahl"))
          return {
            fetchStadtlandzahl: async (path: string) => {
              calls.push(path);
              assert(!path.startsWith("/api/stadtlandzahl"));
              if (path.startsWith("/api/areas/")) return { ars: "080000000000", name: "BW", prefix: "Land", level: 2 };
              if (path.includes("/municipalities/")) {
                if (broken) throw new Error("unavailable");
                return page([municipality("082120000000")], null, 1);
              }
              return context;
            },
          };
        throw new Error(`Unexpected dependency ${id}`);
      },
    },
  );
  const handler = (module.exports as { default: (event: { ars: string }) => Promise<{ municipalities: unknown[] }> })
    .default;
  // Context identity is checked before accepting either list or tile links.
  await assert.rejects(handler({ ars: "080000000000" }));
  context.collection = "stadtlandklima";
  context.map = { ...context.map, tile_url: context.map.tile_url.replaceAll("wind-turbines", "stadtlandklima") };
  context.links = {
    ...context.links,
    municipalities: context.links.municipalities.replaceAll("wind-turbines", "stadtlandklima"),
  };
  const result = await handler({ ars: "080000000000" });
  assert.equal(result.municipalities.length, 1);
  assert.equal(headers.get("Cache-Control"), "no-store");
  broken = true;
  await assert.rejects(handler({ ars: "080000000000" }));
  allowed = false;
  const previous = calls.length;
  await assert.rejects(handler({ ars: "080000000000" }), { statusCode: 429 });
  assert.equal(calls.length, previous);
  allowed = true;
  await assert.rejects(handler({ ars: "../secret" }), { statusCode: 400 });
  assert.equal(calls.length, previous);
});
