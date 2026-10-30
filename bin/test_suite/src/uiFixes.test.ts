import assert from "node:assert/strict";
import { test } from "node:test";
import { municipalityAssessmentHref } from "../../../src/frontend/shared/municipalityLinks.js";
import { municipalityType } from "../../../src/frontend/shared/municipalityClassification.js";

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
function load(name: string, dependencies: Record<string, unknown> = {}, globals: Record<string, unknown> = {}) {
  const module = { exports: {} as Record<string, any> };
  const source = readFileSync(new URL(name, root), "utf8");
  runInNewContext(
    ts.transpileModule(source, {
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
