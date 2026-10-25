import { loggingModule } from "./lib/loggingModules.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import {
  BLOCK_DEFINITIONS,
  parseEditorBlocks,
  createEditorBlock,
  nestedBlocks,
} from "../../../src/frontend/shared/editorBlocks.js";
import { StoredDraftSchema, PersistenceResponseSchema } from "../../../src/frontend/shared/contracts/editor.js";
import {
  visualizationUrl,
  checkedVisualizationSpec,
  checkedMapStyle,
  safeVisualizationLoader,
} from "../../../src/frontend/shared/visualizationSafety.js";
import { requestErrorStatus } from "../../../src/frontend/shared/requestError.js";
import { firstKpiElement } from "../../../src/frontend/utils/dataProducts.js";
const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));

test("registered editor bundles and prop/nested names match every maintained block component", () => {
  const root = new URL("../../../src/frontend/components/Blokkli/", import.meta.url);
  const found = new Set<string>();
  for (const name of readdirSync(root, { recursive: true, encoding: "utf8" }).filter((name) =>
    name.endsWith("/index.vue"),
  )) {
    const source = readFileSync(new URL(name, root), "utf8");
    const bundle = /bundle:\s*['"]([^'"]+)/.exec(source)?.[1];
    assert.ok(bundle, name);
    found.add(bundle);
    assert.ok(Object.hasOwn(BLOCK_DEFINITIONS, bundle), name);
    const definition = BLOCK_DEFINITIONS[bundle as keyof typeof BLOCK_DEFINITIONS];
    const props = /defineProps<\{([\s\S]*?)\}>/.exec(source)?.[1] ?? "";
    for (const field of [...definition.text, ...definition.nested])
      assert.match(props, new RegExp("\\b" + field + "\\??:"), name + ": " + field);
    assert.doesNotMatch(source, /mockProps:\s*\(\)\s*=>\s*\(/, name);
  }
  assert.deepEqual([...found].sort(), Object.keys(BLOCK_DEFINITIONS).sort());
});

test("block JSON checks discriminants, text fields, visibility, nested shape, duplicates and unsafe keys without truncation", () => {
  const heading = { uuid: "heading", bundle: "heading", props: { text: "Existing" } };
  const valid = parseEditorBlocks([
    { uuid: "container", bundle: "container", props: { blocks: [heading], values: [{ value: 42 }] } },
  ]);
  assert.equal(nestedBlocks(valid[0]!, "blocks")?.[0]?.isVisible, true);
  assert.deepEqual(valid[0]!.props.values, [{ value: 42 }]);
  for (const input of [
    [null],
    [{ ...heading, bundle: "missing" }],
    [{ ...heading, isVisible: 0 }],
    [{ ...heading, props: { text: {} } }],
    [{ ...heading, props: [] }],
    [heading, heading],
    [{ uuid: "form", bundle: "form", props: { fields: ["invalid"] } }],
    JSON.parse('[{"uuid":"a","bundle":"text","props":{"__proto__":{"polluted":true}}}]'),
  ])
    assert.throws(() => parseEditorBlocks(input));
  assert.throws(() => parseEditorBlocks([{ ...heading, options: { weight: Infinity } }]));
  assert.throws(() => parseEditorBlocks(Array.from({ length: 501 }, (_, i) => ({ ...heading, uuid: String(i) }))));
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.throws(() => parseEditorBlocks([{ ...heading, props: cycle }]));
  assert.equal(createEditorBlock("form_field").props.label?.length, 0);
});

test("draft and persistence contracts reject malformed history and revision data", () => {
  const draft = { blocks: [], mutations: [{ pluginId: "edit" }], currentIndex: 0, ownerId: "editor" };
  assert.equal(StoredDraftSchema.safeParse(draft).success, true);
  for (const extra of [
    { mutations: ["bad"] },
    { currentIndex: 1 },
    { currentIndex: -2 },
    { baseRevision: 123 },
    { ownerId: {} },
  ])
    assert.equal(StoredDraftSchema.safeParse({ ...draft, ...extra }).success, false);
  assert.equal(PersistenceResponseSchema.safeParse({ blocks: [], revision: "revision" }).success, true);
  for (const response of [{ blocks: [], revision: "" }, { blocks: "bad", revision: "revision" }, { blocks: [] }])
    assert.equal(PersistenceResponseSchema.safeParse(response).success, false);
});

test("visualization URLs reject executable/file schemes, credentials and private application endpoints", () => {
  const origin = "https://site.example";
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///etc/passwd",
    "//evil.example/test",
    "https://user:pass@example.org/data",
    " https://example.org",
    "/api/candidate/token",
    "/api/%63andidate/token",
    "/%61pi/candidate/token",
    "/api/%",
    "/api/submit-feedback",
    "/api/register-municipality",
    "/api/newsletter-subscribe",
    "/elections/thesen/token",
    "/api/public/../../api/candidate/token",
  ])
    assert.throws(() => visualizationUrl(value, origin), value);
  for (const value of [
    "/api/public/chart-data/id",
    "/api/stadtlandzahl/api/collections/data/",
    "/api/carto-basemap?asset=tile",
    "https://data.example.org/data.json",
    "/projects/example",
  ])
    assert.equal(visualizationUrl(value, origin), value);
});

test("Vega configurations retain native expressions/composition but cannot replace application embed options", () => {
  const input = {
    width: { step: 20 },
    title: ["First", "Second"],
    layer: [{ mark: "bar", data: { values: [{ url: "arbitrary user data" }] } }],
    usermeta: {
      description: "Keep",
      embedOptions: { ast: false, actions: true, loader: { http: { credentials: "include" } } },
    },
  };
  const result = checkedVisualizationSpec(input);
  assert.deepEqual("width" in result ? result.width : undefined, { step: 20 });
  assert.deepEqual(result.title, ["First", "Second"]);
  assert.deepEqual(result.usermeta, { description: "Keep" });
  assert.ok(input.usermeta.embedOptions);
  for (const input of [
    [],
    { notASpec: true },
    { mark: "bar", data: { url: "javascript:alert(1)" } },
    { marks: [], data: [{ url: "file:///etc/passwd" }] },
  ])
    assert.throws(() => checkedVisualizationSpec(input));
});

test("the real Vega loader retains URL checks for dynamic loads, drops credentials and refuses redirects/files", async () => {
  const vega = (await import(
    frontend.resolve("vega")
  )) as typeof import("../../../src/frontend/node_modules/vega-typings/index.js");
  const requests: RequestInit[] = [];
  const original = vega.loader();
  original.http = async (_url, options) => {
    requests.push(options);
    return "[]";
  };
  const loader = safeVisualizationLoader(original, "https://site.example");
  assert.equal(await loader.load("https://data.example.org/data.json"), "[]");
  assert.equal(requests[0]?.credentials, "omit");
  assert.equal(requests[0]?.redirect, "error");
  await assert.rejects(loader.load("/api/candidate/token"));
  await assert.rejects(loader.sanitize("javascript:alert(1)", { context: "href" }));
  await assert.rejects(loader.file("/etc/passwd"));
  assert.equal(requests.length, 1);
});

test("installed Vega interpreter runs native and compiled Vega-Lite specifications with normal expressions", async () => {
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
  const compiled = lite.compile({
    mark: "bar",
    data: { values: [{ value: 2 }] },
    encoding: { x: { field: "value", type: "quantitative" } },
  }).spec;
  const native = { signals: [{ name: "result", update: "2 + 3" }], marks: [] };
  for (const spec of [native, compiled]) {
    const checked = checkedVisualizationSpec(spec);
    const runtime = vega.parse(
      checked as import("../../../src/frontend/node_modules/vega-typings/index.js").Spec,
      undefined,
      { ast: true },
    );
    const view = new vega.View(runtime, { renderer: "none", expr: expressionInterpreter });
    try {
      await view.runAsync();
      if (spec === native) assert.equal(view.signal("result"), 5);
    } finally {
      view.finalize();
    }
  }
});

test("the installed MapLibre validator rejects malformed layers, unsafe source URLs and invalid geometry", () => {
  const valid = {
    version: 8,
    sources: { features: { type: "geojson", data: { type: "FeatureCollection", features: [] } } },
    layers: [{ id: "points", type: "circle", source: "features", paint: { "circle-radius": 5 } }],
  };
  assert.equal(checkedMapStyle(valid).version, 8);
  for (const input of [
    { ...valid, version: 1 },
    { ...valid, layers: [{ id: "bad", type: "not-a-layer" }] },
    { ...valid, glyphs: "javascript:alert(1)" },
    { ...valid, sources: { features: { type: "geojson", data: "file:///etc/passwd" } } },
    { ...valid, sources: { features: { type: "geojson", data: { type: "Point", coordinates: ["bad", 2] } } } },
  ])
    assert.throws(() => checkedMapStyle(input));
});

test("legacy KPI aliases retain valid configuration and reject malformed field/threshold payloads", () => {
  const collection = {
    render_config: { primary_kpi: { field: "total", title: { "de-DE": "Total" }, thresholds: { good: 1 } } },
  };
  assert.equal(firstKpiElement(collection)?.field, "total");
  assert.equal(firstKpiElement({ render_config: { primary_kpi: { field: { bad: true } } } }), null);
});

test("publish conflict detection narrows standard SDK/ofetch failures without reflecting their data", () => {
  for (const error of [{ status: 409 }, { statusCode: 409 }, { response: { status: 409 } }])
    assert.equal(requestErrorStatus(error), 409);
  for (const error of [null, {}, { status: "409" }, { response: {} }])
    assert.equal(requestErrorStatus(error), undefined);
});

test("remote image envelopes accept supported base64 images and reject malformed media metadata", async () => {
  const { ImagePayloadSchema } = await import("../../../src/frontend/shared/contracts/slz.js");
  assert.deepEqual(ImagePayloadSchema.parse({ data: " aGVsbG8=\n", encoding: "base64" }), {
    data: "aGVsbG8=",
    encoding: "base64",
    content_type: "image/png",
  });
  for (const input of [
    { data: {} },
    { data: "aGVsbG8=", content_type: "text/html" },
    { data: "aGVsbG8=", encoding: "binary" },
    { data: "" },
  ])
    assert.equal(ImagePayloadSchema.safeParse(input).success, false);
});

test("the actual MapLibre component validates its constructed style before creating a map", async () => {
  const ts = frontend("typescript") as typeof import("typescript");
  const { runInNewContext } = await import("node:vm");
  const vue = frontend("vue") as typeof import("../../../src/frontend/node_modules/vue/dist/vue.js");
  const compiler = frontend(
    "@vue/compiler-sfc",
  ) as typeof import("../../../src/frontend/node_modules/@vue/compiler-sfc/dist/compiler-sfc.js");
  const { descriptor } = compiler.parse(
    readFileSync(new URL("../../../src/frontend/components/MapLibreRenderElement.vue", import.meta.url), "utf8"),
  );
  const source = compiler
    .compileScript(descriptor, { id: "map-boundary" })
    .content.replaceAll("import.meta.client", "true");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  type State = Record<string, any>;
  const geometry = await import("../../../src/frontend/shared/contracts/geometry.js");
  const helpers = await import("../../../src/frontend/shared/visualization.js");
  const safety = await import("../../../src/frontend/shared/visualizationSafety.js");
  for (const invalid of [false, true]) {
    const created: State[] = [];
    const module = { exports: {} as State };
    const mapModule = {
      Map: class {
        constructor(options: State) {
          created.push(options);
        }
        addControl() {}
        once() {}
        on() {}
        remove() {}
      },
      NavigationControl: class {},
      Popup: class {
        remove() {}
      },
    };
    const dependencies: State = {
      vue: { ...vue, onMounted() {}, onBeforeUnmount() {} },
      "~/shared/visualizationSafety": safety,
      "~/shared/visualization": helpers,
      "~/shared/contracts/geometry": geometry,
      "~/composables/useCartoBasemap": { cartoBasemapProxyUrl: (url: string) => url },
      "~/assets/images/Stadt-Land-Klima-Logo.svg": "logo",
      "@iconify/vue": { Icon: {} },
      "maplibre-gl": mapModule,
    };
    runInNewContext(compiled, {
      module,
      exports: module.exports,
      require: (id: string) => {
        const logging = loggingModule(id);
        if (logging && !(id in dependencies)) return logging;
        assert.ok(id in dependencies, "Unexpected import: " + id);
        return dependencies[id];
      },
      console: { warn() {} },
      useTheme: () => ({ isDark: vue.ref(false) }),
      requestAnimationFrame() {},
      window: { location: { origin: "https://site.example" } },
      URL,
      URLSearchParams,
      AbortController,
    });
    const component = module.exports.default;
    const exposed = component.setup(
      {
        element: {
          plot_id: "map",
          type: "map",
          vegalite_spec: null,
          maplibre_spec: {
            renderer: "maplibre",
            version: 1,
            layers: invalid ? [{ id: "invalid", type: "not-supported" }] : [],
          },
        },
      },
      { expose() {} },
    ) as State;
    exposed.containerRef.value = {};
    await exposed.renderMap();
    assert.equal(created.length, invalid ? 0 : 1);
    assert.equal(exposed.error.value, invalid);
    if (invalid) assert.equal(exposed.loading.value, false);
    else assert.equal(created[0]?.style.version, 8);
    exposed.destroyMap();
  }
});
