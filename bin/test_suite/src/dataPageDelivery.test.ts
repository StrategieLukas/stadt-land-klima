import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { GeoFeatureSchema } from "../../../src/frontend/shared/contracts/geometry.js";
import type { CollectionItems } from "../../../src/frontend/utils/collectionItems.js";
import { withChartScaleZoom } from "../../../src/frontend/utils/collectionCharts.js";
import { sectorLabel } from "../../../src/frontend/utils/dataProducts.js";
import { assertEditorJson } from "../../../src/frontend/shared/editorBlocks.js";

const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
type Fetcher = (input: URL, options: RequestInit) => Promise<Response>;
function load(fetcher: Fetcher) {
  const source = readFileSync(new URL("../../../src/frontend/utils/collectionItems.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    URL,
    AbortSignal,
    fetch: fetcher,
    window: { location: { origin: "https://site.test" } },
    require: (id: string) => {
      if (id === "zod") return frontend("zod");
      if (id === "~/shared/contracts/geometry") return { GeoFeatureSchema };
      if (id === "~/shared/visualizationSafety") return { visualizationUrl: (value: string) => value };
      if (id === "~/shared/editorBlocks") return { assertEditorJson };
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return module.exports as { fetchCollectionItems(input: string, signal?: AbortSignal): Promise<CollectionItems> };
}
const feature = (id: number) => ({
  type: "Feature",
  id,
  geometry: { type: "Point", coordinates: [8, 49] },
  properties: {},
});
const input = "/api/stadtlandzahl/api/collections/solar-plants/items/?area=081110000000&no_page=1";

test("point maps follow OGC next links beyond the unpaged energy limit", async () => {
  const calls: number[] = [];
  const { fetchCollectionItems } = load(async (url, options) => {
    assert.equal(url.searchParams.has("no_page"), false);
    assert.equal(url.searchParams.get("limit"), "1000");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    const offset = Number(url.searchParams.get("offset") ?? 0);
    calls.push(offset);
    const count = Math.min(1000, 5001 - offset);
    const next = new URL(url);
    next.searchParams.set("offset", String(offset + count));
    return Response.json({
      type: "FeatureCollection",
      numberMatched: 5001,
      features: Array.from({ length: count }, (_, index) => feature(offset + index)),
      links: offset + count < 5001 ? [{ rel: "next", href: next.href }] : [],
    });
  });
  const result = await fetchCollectionItems(input);
  assert.equal(result.features.length, 5001);
  assert.equal(result.numberReturned, 5001);
  assert.deepEqual(calls, [0, 1000, 2000, 3000, 4000, 5000]);
  assert.equal(result.next, null);
});

for (const href of [
  "https://other.test/api/stadtlandzahl/api/collections/solar-plants/items/?area=081110000000",
  "/api/stadtlandzahl/api/collections/wind-turbines/items/?area=081110000000",
  "/api/stadtlandzahl/api/collections/solar-plants/items/?area=091110000000",
  "/api/stadtlandzahl/api/collections/solar-plants/items/?area=081110000000&limit=1000",
]) {
  test(`pagination refuses changed scope or loops: ${href}`, async () => {
    const { fetchCollectionItems } = load(async () =>
      Response.json({
        type: "FeatureCollection",
        features: [feature(1)],
        links: [{ rel: "next", href }],
      }),
    );
    await assert.rejects(fetchCollectionItems(input), /Invalid collection pagination link/);
  });
}

test("failed later pages reject the load instead of presenting a complete-looking partial map", async () => {
  let calls = 0;
  const { fetchCollectionItems } = load(async (url) => {
    if (++calls > 1) return new Response("unavailable", { status: 503 });
    const next = new URL(url);
    next.searchParams.set("offset", "1000");
    return Response.json({ type: "FeatureCollection", features: [feature(1)], next: next.href });
  });
  await assert.rejects(fetchCollectionItems(input), /HTTP 503/);
});

test("completed map data is reused without mixing areas or derived network modes", async () => {
  const calls: string[] = [];
  const { fetchCollectionItems } = load(async (url) => {
    calls.push(url.href);
    return Response.json({ type: "FeatureCollection", features: [feature(calls.length)] });
  });
  const network =
    "/api/stadtlandzahl/api/collections/cycleway-infrastructure/items/?area=081110000000&geojson_type=classified_network";
  const first = await fetchCollectionItems(network);
  assert.equal(await fetchCollectionItems(network), first);
  await fetchCollectionItems(network.replace("081110000000", "091620000000"));
  await fetchCollectionItems(network.replace("classified_network", "cycleway_routes"));
  assert.equal(calls.length, 3);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchCollectionItems(network, controller.signal), { name: "AbortError" });
});

test("failed map loads are retried and pagination cannot switch network modes", async () => {
  let calls = 0;
  const { fetchCollectionItems } = load(async () => {
    if (++calls === 1) return new Response("failed", { status: 503 });
    return Response.json({ type: "FeatureCollection", features: [feature(1)] });
  });
  await assert.rejects(fetchCollectionItems(input));
  await fetchCollectionItems(input);
  assert.equal(calls, 2);
  const changed = load(async () =>
    Response.json({
      type: "FeatureCollection",
      features: [feature(1)],
      links: [{ rel: "next", href: input + "&geojson_type=classified_network" }],
    }),
  );
  await assert.rejects(changed.fetchCollectionItems(input), /Invalid collection pagination link/);
});

test("cached map payloads retain JSON safety validation before reaching MapLibre workers", async () => {
  const { fetchCollectionItems } = load(
    async () =>
      new Response(
        '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":null,"properties":{"value":1e400}}]}',
        { headers: { "Content-Type": "application/json" } },
      ),
  );
  await assert.rejects(fetchCollectionItems(input), /Invalid editor content/);
});

test("layered infrastructure bars compile and zoom without duplicate selection signals", async () => {
  const vega = (await import(
    frontend.resolve("vega")
  )) as typeof import("../../../src/frontend/node_modules/vega-typings/index.js");
  const lite = (await import(
    frontend.resolve("vega-lite")
  )) as typeof import("../../../src/frontend/node_modules/vega-lite/build/index.js");
  const { expressionInterpreter } = (await import(frontend.resolve("vega-interpreter"))) as {
    expressionInterpreter: NonNullable<
      import("../../../src/frontend/node_modules/vega-embed/build/embed.js").EmbedOptions["expr"]
    >;
  };
  const encoding = { x: { field: "value", type: "quantitative" }, y: { field: "type", type: "nominal" } };
  const original = {
    data: {
      values: [
        { type: "lanes", value: 2 },
        { type: "tracks", value: 3 },
      ],
    },
    layer: [
      { name: "bars", mark: "bar", encoding },
      { name: "labels", mark: "text", encoding },
    ],
  };
  const zoomed = withChartScaleZoom(original, "infrastructure_zoom");
  assert.equal(zoomed.enabled, true);
  assert.equal("params" in original, false, "Source specs remain unchanged");
  const compiled = lite.compile(zoomed.spec as Parameters<typeof lite.compile>[0]).spec;
  const view = new vega.View(vega.parse(compiled, undefined, { ast: true }), {
    renderer: "none",
    expr: expressionInterpreter,
  });
  try {
    await view.runAsync();
    await view.signal("infrastructure_zoom_value", [0, 4]).runAsync();
    assert.deepEqual(view.scale("x").domain(), [0, 4]);
    assert.deepEqual(view.scale("y").domain(), ["lanes", "tracks"]);
  } finally {
    view.finalize();
  }
});

test("sector badges use the maintained German, English and Italian translations", () => {
  const yaml = frontend("yaml") as { parse(text: string): { key: string; value: string } };
  for (const language of ["de-DE", "en-GB", "it-IT"]) {
    const entry = yaml.parse(
      readFileSync(
        new URL(
          `../../../src/directus/translations/${language}/measure_sectors.transport.title.${language}.yaml`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const general = yaml.parse(
      readFileSync(
        new URL(`../../../src/directus/translations/${language}/data.sector.general.${language}.yaml`, import.meta.url),
        "utf8",
      ),
    );
    const messages = new Map([entry, general].map((message) => [message.key, message.value]));
    const dynamic = (key: string) => messages.get(key) ?? key;
    assert.equal(sectorLabel({ sector: "Transport", sector_display: "Stale English label" }, dynamic), entry.value);
    assert.equal(sectorLabel({ sector: "General" }, dynamic), general.value);
    assert.equal(sectorLabel({ sector: "custom", sector_display: "Custom sector" }, dynamic), "Custom sector");
  }
});
