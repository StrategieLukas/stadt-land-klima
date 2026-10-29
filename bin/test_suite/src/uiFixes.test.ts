import assert from "node:assert/strict";
import { test } from "node:test";
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

test("PDF viewer opens during the click, navigates only after generation and releases its URL later", async () => {
  const events: string[] = [];
  let resolve!: (pdf: Blob) => void;
  let cleanup = () => {};
  const viewer = { opener: {}, closed: false, location: { replace: (url: string) => events.push(url) }, close() {} };
  const { openPdf } = load(
    "utils/openPdf.ts",
    {},
    {
      Blob,
      URL: { createObjectURL: () => "blob:pdf", revokeObjectURL: (url: string) => events.push(`revoke:${url}`) },
      window: {
        open: () => {
          events.push("open");
          return viewer;
        },
        setTimeout: (callback: () => void, delay: number) => {
          assert.equal(delay, 60_000);
          cleanup = callback;
        },
      },
    },
  );
  const pending = openPdf(() => {
    events.push("generate");
    return new Promise<Blob>((done) => (resolve = done));
  });
  assert.deepEqual(events, ["open", "generate"]);
  assert.equal(viewer.opener, null);
  resolve(new Blob(["%PDF-test"]));
  await pending;
  assert.deepEqual(events, ["open", "generate", "blob:pdf"]);
  cleanup();
  assert.equal(events.at(-1), "revoke:blob:pdf");
});

test("PDF uses the same tab if popups are blocked and closes an empty viewer on generation failure", async () => {
  let destination = "";
  let closed = false;
  let blocked = true;
  const { openPdf } = load(
    "utils/openPdf.ts",
    {},
    {
      Blob,
      URL: { createObjectURL: () => "blob:pdf", revokeObjectURL() {} },
      window: {
        open: () => (blocked ? null : { opener: {}, close: () => (closed = true) }),
        location: { assign: (url: string) => (destination = url) },
        setTimeout() {},
      },
    },
  );
  await openPdf(async () => new Blob(["%PDF-test"]));
  assert.equal(destination, "blob:pdf");
  blocked = false;
  await assert.rejects(
    openPdf(async () => {
      throw Error("generation failed");
    }),
    /generation failed/,
  );
  assert.equal(closed, true);
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
