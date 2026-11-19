import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  OverviewMunicipalitiesSchema,
  type OverviewMunicipality,
} from "../../../src/frontend/shared/contracts/municipalityOverview.js";
import { checkedOverviewUrl } from "../../../src/frontend/utils/municipalityOverview.js";
import { municipalityFixture, overviewFixture } from "./fixtures/municipalityOverview.js";

type Options = {
  collection: string;
  url: string | null;
  snapshot: string;
  bin?: number;
  query: string;
  enabled: boolean;
};
type FetchOptions = { query: { cursor?: string; bin_index?: number }; signal: AbortSignal };
type State = {
  rows: { value: OverviewMunicipality[] };
  count: { value: number };
  failed: { value: boolean };
  loadMore: () => Promise<void>;
  retry: () => Promise<void>;
};
function members(fetcher: (url: string, options: FetchOptions) => Promise<unknown>) {
  let options: Options = {
    collection: "wind-turbines",
    url: overviewFixture.links.municipalities,
    snapshot: overviewFixture.snapshot_id,
    bin: 0,
    query: "",
    enabled: true,
  };
  let changed = () => {};
  let cleanup = () => {};
  let scheduled: (() => void) | undefined;
  const source = readFileSync(
    new URL("../../../src/frontend/composables/useOverviewMunicipalities.ts", import.meta.url),
    "utf8",
  ).replaceAll("import.meta.client", "true");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    AbortController,
    $fetch: fetcher,
    setTimeout: (callback: () => void) => {
      scheduled = callback;
      return 1;
    },
    clearTimeout: () => {
      scheduled = undefined;
    },
    require: (id: string) => {
      if (id === "vue")
        return {
          ref: <T>(value: T) => ({ value }),
          computed: <T>(get: () => T) => ({
            get value() {
              return get();
            },
          }),
          watch: (_source: unknown, callback: () => void, config: { immediate?: boolean }) => {
            changed = callback;
            if (config.immediate) callback();
          },
          onBeforeUnmount: (callback: () => void) => {
            cleanup = callback;
          },
        };
      if (id === "~/shared/contracts/municipalityOverview") return { OverviewMunicipalitiesSchema };
      if (id === "~/utils/municipalityOverview") return { checkedOverviewUrl };
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  const api = module.exports as { useOverviewMunicipalities: (get: () => Options) => State };
  const state = api.useOverviewMunicipalities(() => options);
  return {
    state,
    change: (next: Options) => {
      options = next;
      changed();
    },
    flush: async () => {
      const pending = scheduled;
      scheduled = undefined;
      pending?.();
      await new Promise<void>((resolve) => setImmediate(resolve));
    },
    dispose: () => {
      cleanup();
    },
  };
}
const page = (
  results: OverviewMunicipality[],
  next_cursor: string | null,
  snapshot_id = overviewFixture.snapshot_id,
) => ({ snapshot_id, count: 2, results, next_cursor });

test("member pagination retains the bin across pages, rejects cycles and can retry from page one", async () => {
  let cycle = true;
  const calls: Array<FetchOptions["query"]> = [];
  const runtime = members(async (_url, options) => {
    calls.push(options.query);
    return options.query.cursor
      ? page([{ ...municipalityFixture, ars: "081150000000" }], cycle ? "second" : null)
      : page([municipalityFixture], "second");
  });
  await runtime.flush();
  assert.equal(runtime.state.rows.value.length, 1);
  await runtime.state.loadMore();
  assert.equal(runtime.state.failed.value, true);
  assert.equal(runtime.state.rows.value.length, 1);
  cycle = false;
  await runtime.state.retry();
  assert.equal(runtime.state.failed.value, false);
  await runtime.state.loadMore();
  assert.equal(runtime.state.rows.value.length, 2);
  assert(calls.every((query) => query.bin_index === 0));
  runtime.dispose();
});

test("snapshot changes abort pending loads and refuse late results from the old context", async () => {
  const pending: Array<{ signal: AbortSignal; resolve: (value: unknown) => void }> = [];
  const runtime = members(
    (_url, options) =>
      new Promise((resolve) => {
        pending.push({ signal: options.signal, resolve });
      }),
  );
  await runtime.flush();
  const snapshot = "next-edition";
  runtime.change({
    collection: "wind-turbines",
    url: overviewFixture.links.municipalities.replace(overviewFixture.snapshot_id, snapshot),
    snapshot,
    bin: 0,
    query: "",
    enabled: true,
  });
  await runtime.flush();
  assert.equal(pending[0]?.signal.aborted, true);
  pending[1]!.resolve(page([{ ...municipalityFixture, name: "New edition" }], null, snapshot));
  await new Promise<void>((resolve) => setImmediate(resolve));
  pending[0]!.resolve(page([{ ...municipalityFixture, name: "Old edition" }], null));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(runtime.state.rows.value[0]?.name, "New edition");
  runtime.dispose();
  assert.equal(pending[1]?.signal.aborted, true);
});
