import { loggingModule } from "./lib/loggingModules.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const root = new URL("../../../src/frontend/", import.meta.url);
const require = createRequire(new URL("package.json", root));
type Row = Record<string, any>;
const sdk = {
  readItems: (collection: string, query: Row) => ({ collection, query }),
  readUsers: (query: Row) => ({ collection: "directus_users", query }),
};
function load(name: string, dependencies: Row = {}, globals: Row = {}): Row {
  const module = { exports: {} };
  const source = readFileSync(new URL(name, root), "utf8");
  runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
      .outputText,
    {
      module,
      exports: module.exports,
      URL,
      Set,
      console,
      process: { env: {} },
      setInterval: () => 1,
      clearInterval() {},
      require: (id: string) => (id in dependencies ? dependencies[id] : (loggingModule(id) ?? require(id))),
      ...globals,
    },
  );
  return module.exports;
}
const extract = load("server/utils/extractContent.ts");
const parseCms = load("server/utils/parseCms.ts");
const cms = load("server/utils/cmsValue.ts", { "./parseCms": parseCms });
const snapshot = load("server/utils/searchSnapshot.ts", {
  "@directus/sdk": sdk,
  "./parseCms": parseCms,
  "./cmsValue": cms,
  "./extractContent": extract,
});
const reconciliation = load("server/utils/searchReconciliation.ts");
const visibility = load("server/utils/searchVisibility.ts", {
  "@directus/sdk": sdk,
  "./cmsValue": cms,
  "./extractContent": extract,
});

test("search reconciliation paginates all types without skipping rows while deleting, then waits for every task", async () => {
  const stored = Array.from({ length: 651 }, (_, i) => ({ id: `old_${i}` }));
  const removed: string[] = [];
  const added: Row[] = [];
  const offsets: number[] = [];
  let task = 0;
  let waited = 0;
  const index = {
    getDocuments: async ({ offset, limit }: Row) => {
      offsets.push(offset);
      return { results: stored.slice(offset, offset + limit) };
    },
    deleteDocuments: async (ids: string[]) => {
      removed.push(...ids);
      for (const id of ids)
        stored.splice(
          stored.findIndex((doc) => doc.id === id),
          1,
        );
      return { taskUid: ++task };
    },
    addDocuments: async (docs: Row[]) => {
      added.push(...docs);
      return { taskUid: ++task };
    },
  };
  await reconciliation.reconcileSearchIndex(index, async () => {
    waited++;
    return { status: "succeeded" };
  }, [{ id: "new_public" }]);
  assert.deepEqual(offsets, [0, 200, 400, 600]);
  assert.equal(removed.length, 651);
  assert.equal(new Set(removed).size, 651);
  assert.equal(added.length, 1);
  assert.equal(waited, 5);
});

test("search reconciliation rejects incomplete reads, duplicate identities and failed asynchronous writes", async () => {
  let writes = 0;
  const index = {
    getDocuments: async (): Promise<Row> => {
      throw Error("offline");
    },
    deleteDocuments: async () => {
      writes++;
    },
    addDocuments: async () => {
      writes++;
      return { taskUid: 1 };
    },
  };
  await assert.rejects(
    reconciliation.reconcileSearchIndex(index, async () => ({ status: "succeeded" }), [{ id: "public" }]),
    /offline/,
  );
  assert.equal(writes, 0);
  await assert.rejects(
    reconciliation.reconcileSearchIndex(index, async () => ({ status: "succeeded" }), [{ id: "same" }, { id: "same" }]),
    /Duplicate/,
  );
  assert.equal(writes, 0);
  index.getDocuments = async () => ({ results: [] });
  await assert.rejects(
    reconciliation.reconcileSearchIndex(index, async () => ({ status: "failed" }), [{ id: "public" }]),
    /task failed/,
  );
});

test("the full snapshot refuses orphan page/news blocks and requires publication for blocks and parents", async () => {
  const requests: Row[] = [];
  const client = {
    request: async (request: Row) => {
      requests.push(request);
      if (request.collection === "pages")
        return [{ id: "page", slug: "public", name: "Public", contents: "body", status: "published" }];
      if (request.collection === "news_items")
        return [{ id: "news", slug: "news-public", title: "News", status: "published" }];
      if (request.collection === "blocks")
        return [
          {
            uuid: request.query.filter.entity_type._eq,
            entity_uuid: request.query.filter.entity_type._eq === "pages" ? "page" : "news",
            bundle: "text",
            props: { text: "visible" },
          },
          { uuid: "orphan", entity_uuid: "unpublished-parent", bundle: "text", props: { text: "PRIVATE" } },
        ];
      return [];
    },
  };
  const { docs } = await snapshot.collectSearchSnapshot(client);
  assert.ok(!JSON.stringify(docs).includes("PRIVATE"));
  for (const request of requests.filter((row) => ["blocks", "pages"].includes(row.collection)))
    assert.equal(request.query.filter.status._eq, "published");
  const failure = {
    request: async (request: Row) => {
      if (request.collection === "directus_users") throw Error("members unavailable");
      return client.request(request);
    },
  };
  await assert.rejects(snapshot.collectSearchSnapshot(failure), /members unavailable/);
});

test("search startup stays closed on failed reconciliation and becomes ready only after completed tasks", async () => {
  let fail = true;
  let now = 0;
  let retry = () => {};
  let plugin: () => Promise<void> = async () => {};
  const state = { ready: false };
  const index = { updateSettings: async () => ({ taskUid: 1 }) };
  load(
    "server/plugins/reindex.ts",
    {
      "../utils/searchSnapshot": {
        createSearchCms: () => ({}),
        collectSearchSnapshot: async () => {
          if (fail) throw Error("partial");
          return { docs: [], counts: {} };
        },
      },
      "../utils/searchReconciliation": { searchReadiness: state, reconcileSearchIndex: async () => {} },
    },
    {
      Date: { now: () => now },
      setInterval: (callback: () => void, interval: number) => {
        assert.ok(interval <= 30_000);
        retry = callback;
        return 1;
      },
      defineNitroPlugin: (fn: () => Promise<void>) => {
        plugin = fn;
      },
      useRuntimeConfig: () => ({ directusFrontendServerToken: "private" }),
      getMeilisearch: () => ({ index: () => index, tasks: { waitForTask: async () => ({ status: "succeeded" }) } }),
    },
  );
  await plugin();
  assert.equal(state.ready, false);
  fail = false;
  now = 30_000;
  retry();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(state.ready, true);
});

test("public search checks live publication and rejects stale slugs, private members and legacy identities", async () => {
  const hits = [
    { id: "page_live", type: "page", url: "/live" },
    { id: "page_draft", type: "page", url: "/draft" },
    { id: "event_old", type: "event", url: "/events/old" },
    { id: "member_private", type: "member", url: "/organisation#member-private" },
    { id: "static_feedback", type: "static_page", url: "/obsolete-contact" },
  ];
  const client = {
    request: async ({ collection, query }: Row) => {
      if (collection === "pages") {
        assert.equal(query.filter.status._eq, "published");
        return [
          { slug: "live", status: "published" },
          { slug: "draft", status: "draft" },
        ];
      }
      if (collection === "directus_users") {
        assert.equal(query.filter.show_on_team_page._eq, true);
        return [];
      }
      return [];
    },
  };
  const visible = await visibility.publicSearchHits(client, hits);
  assert.deepEqual(
    Array.from(visible, (hit: Row) => hit.id),
    ["page_live"],
  );
  await assert.rejects(
    visibility.publicSearchHits(
      {
        request: async () => {
          throw Error("offline");
        },
      },
      hits,
    ),
    /offline/,
  );
});

test("public block search requires a live published parent and its current URL", async () => {
  const parent = "11111111-1111-4111-8111-111111111111";
  const client = {
    request: async ({ collection }: Row) =>
      collection === "blocks"
        ? [{ uuid: "block", entity_type: "pages", entity_uuid: parent, status: "published" }]
        : [{ id: parent, slug: "current", status: "published" }],
  };
  const hits = [
    { id: "block_block", type: "block", url: "/old#block-block" },
    { id: "block_block", type: "block", url: "/current#block-block" },
  ];
  const visible = await visibility.publicSearchHits(client, hits);
  assert.equal(visible.length, 1);
  assert.equal(visible[0].url, "/current#block-block");
});
