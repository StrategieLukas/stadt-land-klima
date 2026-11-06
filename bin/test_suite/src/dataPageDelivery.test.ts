import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { GeoFeatureSchema } from "../../../src/frontend/shared/contracts/geometry.js";
import type { CollectionItems } from "../../../src/frontend/utils/collectionItems.js";
import { withNativeScaleZoom } from "../../../src/frontend/utils/chartZoom.js";
import { visualizationUrl } from "../../../src/frontend/shared/visualizationSafety.js";
import { fileURLToPath } from "node:url";

const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
type Fetcher = (input: URL, options: RequestInit) => Promise<Response>;
function load(fetcher: Fetcher, abortSignals: Pick<typeof AbortSignal, "timeout" | "any"> = AbortSignal) {
  const source = readFileSync(new URL("../../../src/frontend/utils/collectionItems.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    URL,
    AbortSignal: abortSignals,
    fetch: fetcher,
    window: { location: { origin: "https://site.test" } },
    require: (id: string) => {
      if (id === "zod") return frontend("zod");
      if (id === "~/shared/contracts/geometry") return { GeoFeatureSchema };
      if (id === "~/shared/visualizationSafety") return { visualizationUrl };
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

test("large road networks survive a 17-second upstream response and retain a finite deadline", async () => {
  let elapsed = 0;
  const deadlines: { controller: AbortController; time: number }[] = [];
  const advance = (milliseconds: number) => {
    elapsed += milliseconds;
    deadlines
      .filter((deadline) => deadline.time <= elapsed)
      .forEach(({ controller }) => {
        controller.abort(new DOMException("Timed out", "TimeoutError"));
      });
  };
  const { fetchCollectionItems } = load(
    async (url, options) => {
      assert.equal(url.searchParams.get("geojson_type"), "classified_network");
      advance(17000);
      options.signal?.throwIfAborted();
      return Response.json({ type: "FeatureCollection", features: [feature(1)] });
    },
    {
      timeout(milliseconds) {
        assert.ok(milliseconds <= 60000, "Geometry requests must remain bounded");
        const controller = new AbortController();
        deadlines.push({ controller, time: elapsed + milliseconds });
        return controller.signal;
      },
      any: AbortSignal.any,
    },
  );
  const result = await fetchCollectionItems(input + "&geojson_type=classified_network");
  assert.equal(result.features.length, 1);
  advance(60000);
  assert.equal(deadlines[0]?.controller.signal.aborted, true);
});

test("navigation cancellation aborts a pending collection load", async () => {
  const controller = new AbortController();
  const { fetchCollectionItems } = load(
    async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
      }),
  );
  const pending = fetchCollectionItems(input, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("the production worker import emits a standalone JavaScript asset", async () => {
  const vite = (await import(
    frontend.resolve("vite")
  )) as typeof import("../../../src/frontend/node_modules/vite/dist/node/index.js");
  const component = readFileSync(
    new URL("../../../src/frontend/components/MapLibreRenderElement.vue", import.meta.url),
    "utf8",
  );
  const workerImport = /import mapLibreWorkerUrl from "([^"]+)"/.exec(component)?.[1];
  assert.ok(workerImport && workerImport.endsWith("?url"));
  const workerPath = frontend.resolve(workerImport.slice(0, -4));
  const entry = "\0map-worker-regression";
  const result = await vite.build({
    configFile: false,
    root: fileURLToPath(new URL("../../../src/frontend", import.meta.url)),
    logLevel: "silent",
    plugins: [
      {
        name: "worker-regression",
        resolveId: (id) => (id === entry ? entry : undefined),
        load: (id) =>
          id === entry
            ? `import worker from ${JSON.stringify(workerPath + "?url")}; export default worker;`
            : undefined,
      },
    ],
    build: { write: false, assetsInlineLimit: 0, rollupOptions: { input: entry } },
  });
  assert.ok(!Array.isArray(result) && "output" in result);
  const worker = result.output.find(
    (item) => item.type === "asset" && /maplibre-gl-worker.*\.mjs$/.test(item.fileName),
  );
  assert.ok(worker?.type === "asset", "Worker must be emitted, not inferred beside the library chunk");
  assert.equal(String(worker.source), readFileSync(workerPath, "utf8"));
});

test("the deployed cycling layers compile and run with a single working zoom binding", async () => {
  const lite = (await import(
    frontend.resolve("vega-lite")
  )) as typeof import("../../../src/frontend/node_modules/vega-lite/build/index.js");
  const vega = (await import(
    frontend.resolve("vega")
  )) as typeof import("../../../src/frontend/node_modules/vega-typings/index.js");
  const { expressionInterpreter } = (await import(frontend.resolve("vega-interpreter"))) as {
    expressionInterpreter: NonNullable<
      import("../../../src/frontend/node_modules/vega-embed/build/embed.js").EmbedOptions["expr"]
    >;
  };
  const fixture: unknown = JSON.parse(
    readFileSync(new URL("./fixtures/cycling-infrastructure-chart.json", import.meta.url), "utf8"),
  );
  const before = JSON.stringify(fixture);
  const { spec, enabled } = withNativeScaleZoom(fixture, "regression_zoom");
  assert.equal(enabled, true);
  assert.equal(JSON.stringify(fixture), before, "Keep the source specification immutable");
  const compiled = lite.compile(spec as Parameters<typeof lite.compile>[0]).spec;
  const view = new vega.View(vega.parse(compiled, undefined, { ast: true }), {
    renderer: "none",
    expr: expressionInterpreter,
  });
  try {
    await view.runAsync();
    assert.ok(view.scale("x").domain()[1] >= 90);
    await view.signal("regression_zoom_value", [0, 20]).runAsync();
    assert.deepEqual(view.scale("x").domain(), [0, 20]);
  } finally {
    view.finalize();
  }
});

test("authored scale interactions are preserved and non-Cartesian charts receive no automatic zoom", () => {
  const authored = { mark: "bar", params: [{ name: "author", select: "interval", bind: "scales" }] };
  assert.equal(withNativeScaleZoom(authored, "automatic").spec, authored);
  for (const spec of [
    { marks: [] },
    { mark: "arc", encoding: { theta: { field: "value", type: "quantitative" } } },
    { vconcat: [{ mark: "bar" }] },
    { mark: "bar", encoding: { x: { field: "label", type: "nominal" } } },
  ]) {
    assert.deepEqual(withNativeScaleZoom(spec, "automatic"), { spec, enabled: false });
  }
});
