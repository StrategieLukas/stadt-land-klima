import assert from "node:assert/strict";
import { test } from "node:test";
import { areaSearchPresentation } from "../../../src/frontend/shared/areaSearchPresentation.js";
import { municipalityAssessmentHref } from "../../../src/frontend/shared/municipalityLinks.js";
import { municipalityType } from "../../../src/frontend/shared/municipalityClassification.js";
import { createHeaderScrollTracker } from "../../../src/frontend/utils/headerScroll.js";

test("header reveal accumulates tiny trackpad movement and ignores brief direction reversals", () => {
  const track = createHeaderScrollTracker(0);
  for (let y = 2; y <= 100; y += 2) track(y);
  assert.equal(track(100), false);
  for (const y of [98, 100, 99, 102, 101, 100]) assert.equal(track(y), false);
  for (const y of [100, 98, 96, 94, 92]) assert.equal(track(y), false);
  assert.equal(track(90), true);
  for (const y of [92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112]) assert.equal(track(y), true);
  assert.equal(track(114), false);
  assert.equal(track(0), true);
  assert.equal(track(-6), true);
  assert.equal(track(12), true);
});

test("header reveal handles restored scroll positions and reverses an in-progress collapse", () => {
  const track = createHeaderScrollTracker(500);
  assert.equal(track(520), true);
  assert.equal(track(524), false);
  assert.equal(track(516), false);
  assert.equal(track(512), true);
  assert.equal(track(518), true);
  assert.equal(track(536), false);
  assert.equal(track(8), true);
});

test("municipality links preserve catalogues and prefer measure anchors over sector anchors", () => {
  assert.equal(
    municipalityAssessmentHref("koeln", "v1.0", { sector: "energy" }),
    "/municipalities/koeln?v=v1.0#sector-energy",
  );
  assert.equal(
    municipalityAssessmentHref("koeln", "beta", { sector: "energy", measureCode: "EN_01" }),
    "/municipalities/koeln?v=beta#measure-EN_01",
  );
  assert.equal(municipalityAssessmentHref("koeln", "v1.0"), "/municipalities/koeln?v=v1.0");
});

test("population determines PDF and website municipality categories, including Cologne and the 100000 boundary", () => {
  assert.equal(municipalityType({ population: 1080000, municipality_type: null }), "big_city");
  assert.equal(municipalityType({ population: 100000, municipality_type: "small_city" }), "big_city");
  assert.equal(municipalityType({ population: "99999", municipality_type: "big_city" }), "small_city");
  assert.equal(municipalityType({ population: null, municipality_type: "big_city" }), "big_city");
  for (const population of [undefined, null, "", "invalid", 0, -1])
    assert.equal(municipalityType({ population }), null);
});
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = new URL("../../../src/frontend/", import.meta.url);
const require = createRequire(new URL("package.json", root));

test("municipality type masks render transparent backgrounds and visible building silhouettes", () => {
  const { Resvg } =
    require("@resvg/resvg-js") as typeof import("../../../src/frontend/node_modules/@resvg/resvg-js/index.js");
  for (const type of ["minor", "major"]) {
    const icon = readFileSync(new URL(`public/icons/${type}-city-mask.svg`, root));
    const rendered = new Resvg(icon, { fitTo: { mode: "width", value: 64 } }).render();
    const alpha = rendered.pixels.filter((_channel, index) => index % 4 === 3);
    const coverage = alpha.filter((value) => value > 0).length / alpha.length;
    assert(coverage > 0.1 && coverage < 0.8, `${type} city must show a silhouette, not an empty or solid square`);
    assert.equal(alpha[0], 0, "The icon background must remain transparent");
  }
});
function load(name: string, dependencies: Record<string, unknown> = {}, globals: Record<string, unknown> = {}) {
  const module = { exports: {} as Record<string, any> };
  const source = readFileSync(new URL(name, root), "utf8");
  runInNewContext(
    ts.transpileModule(source.replaceAll("import.meta.client", "true"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id: string) => (id in dependencies ? dependencies[id] : require(id)),
      AbortController,
      ...globals,
    },
  );
  return module.exports;
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("PDF forms preserve the native response and only accept checked JSON or a single form payload", () => {
  const { pdfRequestBody, pdfResponseDisposition } = load("server/utils/pdfResponse.ts");
  assert.equal(pdfRequestBody({ request: '{"slug":"berlin"}' }).slug, "berlin");
  assert.equal(pdfRequestBody({ slug: "berlin" }).slug, "berlin");
  assert.throws(() => pdfRequestBody({ request: "{", slug: "hidden" }));
  assert.throws(() => pdfRequestBody({ request: "{" }));
  const header = `inline; filename="StadtLandKlima-Bewertung_Munchen.pdf"; filename*=UTF-8''StadtLandKlima-Bewertung_M%C3%BCnchen.pdf`;
  assert.equal(pdfResponseDisposition(header), header);
  assert.equal(pdfResponseDisposition('attachment; filename="bad.pdf"'), 'inline; filename="StadtLandKlima.pdf"');
  assert.equal(
    pdfResponseDisposition('inline; filename="bad.pdf"\r\nX-Injected: true'),
    'inline; filename="StadtLandKlima.pdf"',
  );
});

test("unified search shows content before slow areas, aborts replaced queries and refuses stale responses", async () => {
  const requests: Array<{
    url: string;
    signal: AbortSignal;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  const fetch = (url: string, options: { signal: AbortSignal }) =>
    new Promise((resolve, reject) => {
      requests.push({ url, signal: options.signal, resolve, reject });
    });
  const contracts = load("shared/contracts/search.ts", { "./geometry": { parseGeoCenter: () => null } });
  const immediate = (fn: (...args: any[]) => unknown) => Object.assign(fn, { cancel() {} });
  const { useUnifiedSearch } = load(
    "composables/useUnifiedSearch.ts",
    {
      lodash: { debounce: immediate },
      "~/shared/contracts/search": contracts,
      "~/shared/areaSearchPresentation": { areaSearchPresentation },
      "~/shared/utils": { getStateFromArs: () => null, getScorePercentageColor: () => "" },
      "~/shared/municipality-score-publishing": { isMunicipalityScoreComplete: () => false },
    },
    { useContentFetch: () => fetch, useNuxtApp: () => ({ $t: (key: string) => key }), $fetch: fetch },
  );
  const search = useUnifiedSearch();
  search.search("first");
  const hit = { id: "page_first", type: "page", title: "First", url: "/first" };
  requests[0]!.resolve({ hits: [hit] });
  await tick();
  assert.equal(search.flatResults.value[0]?.id, "page_first");
  assert.equal(search.isLoading.value, true);
  search.search("second");
  assert.ok(requests.slice(0, 3).every((request) => request.signal.aborted));
  assert.equal(search.flatResults.value.length, 0);
  requests[1]!.resolve({ municipalities: [] });
  requests[2]!.resolve([{ name: "Stale", ars: "1", prefix: "", stadtlandklimaDataAll: [] }]);
  requests[3]!.resolve({ hits: [{ ...hit, id: "page_second", title: "Second", url: "/second" }] });
  requests[4]!.reject(Error("CMS unavailable"));
  requests[5]!.reject(Error("Areas unavailable"));
  await tick();
  assert.equal(search.flatResults.value.length, 1);
  assert.equal(search.flatResults.value[0]?.id, "page_second");
  assert.equal(search.isLoading.value, false);
  search.clear();
  assert.equal(search.flatResults.value.length, 0);
});

test("search area eligibility separates regions, rateable city-states and unsuitable administrative areas", () => {
  const area = { ars: "110000000000", name: "Berlin", prefix: "Land", stadtlandklimaDataAll: [] };
  assert.equal(areaSearchPresentation({ ...area, level: 2 }, "current").areaKind, "region");
  const cityState = areaSearchPresentation({ ...area, level: 2, isReasonableForMunicipalRating: true }, "current");
  assert.equal(cityState.areaKind, "municipality");
  assert.equal(cityState.ctaType, "none");
  for (const level of [4, 5, 6, undefined]) {
    const unsuitable = areaSearchPresentation({ ...area, level, isReasonableForMunicipalRating: false }, "current");
    assert.equal(unsuitable.areaKind, "administrative-area");
    assert.equal(unsuitable.ctaType, "area", "Unsuitable areas never invite a rating or local-team registration");
    assert.equal(unsuitable.scoreDisplay, null);
  }
});

test("search rating states use only complete published scores and preserve CMS-only scores and old catalogues", () => {
  const score = (name: string, score_total: number, published = true, percentage_rated = 100) => ({
    catalog_version: { id: name, name },
    score_total,
    published,
    percentage_rated,
  });
  const area = {
    ars: "040110000000",
    name: "Bremen",
    prefix: "Stadt",
    level: 4,
    isReasonableForMunicipalRating: true,
    stadtlandklimaDataAll: [],
    directusCatalogStatus: {
      id: "city",
      name: "Bremen",
      slug: "bremen",
      localteam_id: "team",
      scores: [score("current", 72)],
    },
  };
  const complete = areaSearchPresentation(area, "current");
  assert.equal(complete.ctaType, "complete");
  assert.equal(complete.scoreDisplay, "72%");
  assert.equal(complete.scoreTotalColorClass, "rating-3");
  const old = areaSearchPresentation(
    {
      ...area,
      directusCatalogStatus: { ...area.directusCatalogStatus, scores: [score("old", 40), score("current", 90, false)] },
    },
    "current",
  );
  assert.equal(old.ctaType, "outdated");
  assert.equal(old.scoreDisplay, "40%");
  assert.equal(old._oldCatalogName, "old");
  for (const scores of [[score("current", 90, false)], [score("current", 90, true, 99)], []]) {
    const progressing = areaSearchPresentation(
      { ...area, directusCatalogStatus: { ...area.directusCatalogStatus, scores } },
      "current",
    );
    assert.equal(progressing.ctaType, "in-progress");
    assert.equal(progressing.scoreDisplay, null, "Draft or partial ratings never expose a complete score chip");
  }
  assert.equal(areaSearchPresentation({ ...area, directusCatalogStatus: null }, "current").ctaType, "none");
  assert.equal(areaSearchPresentation(area, null).ctaType, "in-progress", "Wait for the current catalogue");
  const unsuitable = areaSearchPresentation({ ...area, isReasonableForMunicipalRating: false }, "current");
  assert.equal(unsuitable.ctaType, "area", "CMS data cannot override explicit area ineligibility");
});

test("search lifecycle preserves dismissed queries and makes activation idempotent", () => {
  const vue = require("vue") as typeof import("../../../src/frontend/node_modules/vue/dist/vue.js");
  const state = new Map<string, import("../../../src/frontend/node_modules/vue/dist/vue.js").Ref>();
  const { useSearchPalette } = load(
    "composables/useSearchPalette.ts",
    {},
    {
      computed: vue.computed,
      useState: (key: string, initial: () => unknown) => {
        if (!state.has(key)) state.set(key, vue.ref(initial()));
        return state.get(key);
      },
    },
  );
  const palette = useSearchPalette();
  palette.openEmbedded();
  palette.query.value = "Berlin";
  palette.navigationDropdownOpen.value = true;
  palette.openEmbedded();
  assert.equal(palette.query.value, "Berlin");
  assert.equal(palette.isVisible.value, true);
  palette.close();
  assert.equal(palette.query.value, "Berlin");
  assert.equal(palette.isVisible.value, false);
  palette.open();
  assert.equal(palette.embeddedInput.value, false);
  assert.equal(palette.query.value, "Berlin");
  palette.toggle();
  assert.equal(palette.isOpen.value, false);
  palette.toggle();
  assert.equal(palette.isOpen.value, true);
  palette.clearQuery();
  assert.equal(palette.query.value, "");
});

test("search bridge cleanup cannot remove a newer owner and reports unavailable inputs", () => {
  const { useEmbeddedSearchBridge } = load(
    "composables/useEmbeddedSearchBridge.ts",
    {},
    {
      useNuxtApp: () => ({ $t: (key: string) => key }),
    },
  );
  const bridge = useEmbeddedSearchBridge();
  let moves = 0;
  let navigations = 0;
  const oldFocus = bridge.registerFocusInput(() => false);
  const oldNavigation = bridge.register(
    () => {
      moves = -100;
    },
    () => {
      navigations = -100;
    },
  );
  const focus = bridge.registerFocusInput(() => true);
  const navigation = bridge.register(
    (direction: number) => {
      moves += direction;
    },
    () => {
      navigations++;
    },
  );
  oldFocus();
  oldNavigation();
  assert.equal(bridge.hasHeaderInput, true);
  assert.equal(bridge.focusHeaderInput(), true);
  bridge.moveFocusEmbedded(1);
  bridge.navigateFocusedEmbedded();
  assert.equal(moves, 1);
  assert.equal(navigations, 1);
  focus();
  navigation();
  assert.equal(bridge.hasHeaderInput, false);
  assert.equal(bridge.focusHeaderInput(), false);
  bridge.moveFocusEmbedded(1);
  bridge.navigateFocusedEmbedded();
  assert.equal(moves, 1);
  assert.equal(navigations, 1);
});

test("search selection follows identity across provider insertion and resets on removal", () => {
  const vue = require("vue") as typeof import("../../../src/frontend/node_modules/vue/dist/vue.js");
  const { useSearchSelection } = load("composables/useSearchSelection.ts");
  const results = vue.ref([{ id: "content:1" }, { id: "content:2" }]);
  const scope = vue.effectScope();
  const selection = scope.run(() => useSearchSelection(results, (result: { id: string }) => result.id));
  assert.equal(selection.selected.value, undefined);
  selection.move(1);
  assert.equal(selection.selected.value.id, "content:1");
  results.value = [{ id: "area:1" }, ...results.value];
  assert.equal(selection.index.value, 1);
  assert.equal(selection.selected.value.id, "content:1");
  results.value = [{ id: "area:1" }, { id: "content:2" }];
  assert.equal(selection.selected.value, undefined);
  results.value = [{ id: "content:1" }];
  assert.equal(selection.selected.value, undefined, "A removed selection must not silently return");
  selection.move(1);
  selection.clear();
  assert.equal(selection.selected.value, undefined);
  scope.stop();
});

test("area search immediately retires old suggestions and invalidates responses on disposal", async () => {
  const vue = require("vue") as typeof import("../../../src/frontend/node_modules/vue/dist/vue.js");
  const pending: Array<(result: unknown[]) => void> = [];
  let cancellations = 0;
  const immediate = (fn: (...args: any[]) => unknown) =>
    Object.assign(fn, {
      cancel() {
        cancellations++;
      },
    });
  const { useAreaSearch } = load(
    "composables/useAreaSearch.ts",
    {
      lodash: { debounce: immediate },
      "~/shared/contracts/search": {},
      "~/shared/utils": { getStateFromArs: () => null },
      "~/shared/municipality-score-publishing": {},
    },
    {
      useNuxtApp: () => ({
        $stadtlandzahlAPI: { searchAdministrativeAreas: () => new Promise((resolve) => pending.push(resolve)) },
      }),
    },
  );
  const scope = vue.effectScope();
  const search = scope.run(() => useAreaSearch());
  const area = { name: "Berlin", ars: "", prefix: "Land", level: 2, stadtlandklimaDataAll: [] };
  search.search("Berlin");
  pending[0]!([area]);
  await tick();
  assert.equal(search.results.value[0].name, "Berlin");
  search.search("Munich");
  assert.equal(search.results.value.length, 0);
  assert.equal(search.isLoading.value, true);
  search.clear();
  pending[1]!([{ ...area, name: "Munich" }]);
  await tick();
  assert.equal(search.results.value.length, 0);
  search.search("Late");
  scope.stop();
  pending[2]!([{ ...area, name: "Late" }]);
  await tick();
  assert.equal(search.results.value.length, 0);
  assert.equal(search.isLoading.value, false);
  assert.equal(cancellations, 2);
});
