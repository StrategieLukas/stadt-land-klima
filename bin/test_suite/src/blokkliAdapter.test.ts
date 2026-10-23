import { webcrypto } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));

type Block = {
  uuid: string;
  bundle: string;
  isVisible?: boolean;
  props?: Record<string, any>;
  options?: Record<string, any>;
};
type Command = {
  operation: string;
  collection?: string;
  id?: string | number;
  data?: any;
  query?: any;
  path?: string;
  body?: string;
};
type PermissionMap = Record<string, Record<string, { access: string }>>;

// Exercise the actual adapter in isolation from Nuxt and Directus. Only the
// session, SDK transport and browser storage are replaced; mutations, state
// mapping, draft recovery and publication all run the production implementation.
function loadModule(path: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const module = { exports: {} as Record<string, any> };
  const source = readFileSync(new URL(path, import.meta.url), "utf8").replaceAll("import.meta.client", "true");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  runInNewContext(
    compiled.outputText,
    {
      module,
      exports: module.exports,
      require: (id: string) => {
        assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
        return dependencies[id];
      },
      ...globals,
    },
    { filename: path },
  );
  return module.exports;
}

const domain = loadModule("../../../src/frontend/shared/domain.ts", {});
const editorBlocks = loadModule("../../../src/frontend/shared/editorBlocks.ts", {}, { crypto: webcrypto });
const editorContracts = loadModule("../../../src/frontend/shared/contracts/editor.ts", {
  zod: frontend("zod"),
  "../editorBlocks": editorBlocks,
});
const requestErrors = loadModule("../../../src/frontend/shared/requestError.ts", {});
const persistence = loadModule("../../../src/frontend/shared/blokkliPersistence.ts", {
  "./editorBlocks": editorBlocks,
});
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function createHarness(
  options: { blocks?: Block[]; authenticated?: boolean; permissions?: PermissionMap; draft?: Record<string, any> } = {},
) {
  const authenticated = options.authenticated !== false;
  let permissions =
    options.permissions ??
    Object.fromEntries(
      ["blocks", "edit_states", "library_items"].map((collection) => [
        collection,
        Object.fromEntries(["create", "read", "update", "delete"].map((action) => [action, { access: "full" }])),
      ]),
    );
  const authState = { value: authenticated };
  const currentUser = { value: authenticated ? { id: "editor-id", first_name: "Test", last_name: "Editor" } : null };
  const requests: Command[] = [];
  const storage = new Map<string, string>();
  const pageData = { data: { value: [] as Block[] } };
  let liveBlocks = plain(options.blocks ?? []);
  let draft = options.draft;
  let publishError: { status: number } | undefined;
  let libraryItems: Record<string, any>[] = [];
  const client = {
    async request(command: Command) {
      requests.push(plain(command));
      if (command.path === "/permissions/me") return permissions;
      if (command.path?.startsWith("/blokkli-persistence/state"))
        return { blocks: liveBlocks, revision: "initial-revision" };
      if (command.path === "/blokkli-persistence/publish") {
        if (publishError) throw publishError;
        liveBlocks = JSON.parse(command.body!).blocks;
        return { blocks: plain(liveBlocks), revision: "published-revision" };
      }
      if (command.collection === "edit_states") {
        if (command.operation === "readItems") return draft ? [plain(draft)] : [];
        if (command.operation === "createItem") return (draft = { id: 1, ...command.data });
        if (command.operation === "updateItem") return (draft = { ...draft, ...command.data });
        if (command.operation === "deleteItem") {
          draft = undefined;
          return;
        }
      }
      if (command.collection === "library_items") {
        if (command.operation === "createItem") {
          libraryItems.push(command.data);
          return command.data;
        }
        return libraryItems;
      }
      if (command.operation === "readFiles")
        return Array.from({ length: 25 }, (_, index) => ({ id: `image-${index}`, title: `Image ${index}` }));
      throw new Error(`Unexpected command: ${JSON.stringify(command)}`);
    },
  };
  const sdk = Object.fromEntries(
    ["readItems", "readFiles", "createItem", "updateItem", "deleteItem"].map((operation) => [
      operation,
      (...args: any[]) =>
        operation === "readFiles"
          ? { operation, query: args[0] }
          : {
              operation,
              collection: args[0],
              ...(operation === "readItems"
                ? { query: args[1] }
                : operation === "createItem"
                  ? { data: args[1] }
                  : { id: args[1], data: args[2] }),
            },
    ]),
  );
  const adapterModule = loadModule(
    "../../../src/frontend/app/blokkli.editAdapter.ts",
    {
      zod: frontend("zod"),
      "~/shared/domain": domain,
      "~/shared/editorBlocks": editorBlocks,
      "~/shared/contracts/editor": editorContracts,
      "~/shared/requestError": requestErrors,
      "#blokkli/editor/adapter": { defineBlokkliEditAdapter: (factory: unknown) => factory },
      "#blokkli/editor/events": { emitMessage() {} },
      "@directus/sdk": { ...sdk, customEndpoint: (command: Command) => ({ ...command, operation: "custom" }) },
      "~/composables/useAuth": {
        useAuth: () => ({
          isAuthenticated: authState,
          user: currentUser,
          initialize: async () => {},
          getAuthenticatedClient: () => client,
        }),
      },
      "~/stores/auth": { useAuthStore: () => ({ _accessToken: { value: "test-session" } }) },
      "~/shared/blokkliPersistence": persistence,
    },
    {
      crypto: { randomUUID },
      URLSearchParams,
      console: { error() {}, warn() {} },
      useNuxtApp: () => ({ $directus: client, $t: (key: string) => key }),
      useRuntimeConfig: () => ({ public: { clientDirectusUrl: "http://directus.test" } }),
      useNuxtData: () => pageData,
      window: {
        setTimeout: () => 1,
        clearTimeout() {},
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
          removeItem: (key: string) => storage.delete(key),
        },
      },
    },
  );
  const adapter = adapterModule.default({
    value: { entityType: "pages", entityUuid: "page-id", entityBundle: "page", language: "de" },
  });
  return {
    adapter,
    requests,
    storage,
    pageData,
    setSession(id?: string, nextPermissions?: PermissionMap) {
      authState.value = Boolean(id);
      currentUser.value = id ? { id, first_name: "Test", last_name: "Editor" } : null;
      if (nextPermissions) permissions = nextPermissions;
    },
    liveBlocks: () => plain(liveBlocks),
    draft: () => plain(draft ?? null),
    failPublish: (status?: number) => {
      publishError = status ? { status } : undefined;
    },
    setLibraryItems: (items: Record<string, any>[]) => {
      libraryItems = items;
    },
  };
}

test("legacy root and nested content remains visible without changing IDs, options or non-block data", () => {
  const blocks = [
    {
      uuid: "container",
      bundle: "container",
      options: { layout: "columns-2" },
      props: {
        blocks: [{ uuid: "heading", bundle: "heading", props: { text: "<strong>Existing content</strong>" } }],
        values: [{ key: "unrelated", value: 42 }],
      },
    },
    { uuid: "hidden", bundle: "text", isVisible: false },
  ];
  const result = plain(persistence.mapBlokkliBlocks(blocks));
  assert.equal(result[0].isVisible, true);
  assert.equal(result[0].props.blocks[0].isVisible, true);
  assert.equal(result[0].props.blocks[0].uuid, "heading");
  assert.equal(result[0].props.blocks[0].props.text, "<strong>Existing content</strong>");
  assert.deepEqual(result[0].props.values, blocks[0].props!.values);
  assert.deepEqual(result[0].options, blocks[0].options);
  assert.equal(result[1].isVisible, false);
  assert.equal(blocks[0].isVisible, undefined);
});

test("V2 user and bundle permissions follow the authenticated Directus permissions", async () => {
  const editor = createHarness();
  assert.deepEqual(plain(await editor.adapter.getCurrentUser()), { id: "editor-id", name: "Test Editor" });
  assert.deepEqual(plain(await editor.adapter.getUserPermissions()), ["use_blokkli", "create_library_item"]);
  const bundles = await editor.adapter.getAllBundles();
  assert.equal(bundles.length, 28);
  assert.ok(bundles.every((bundle: any) => bundle.permissions.join() === "add,edit,delete"));
  assert.equal(editor.requests.filter((request) => request.path === "/permissions/me").length, 1);
  const reader = createHarness({ permissions: { blocks: { read: { access: "full" } } } });
  assert.deepEqual(plain(await reader.adapter.getUserPermissions()), []);
  assert.ok((await reader.adapter.getAllBundles()).every((bundle: any) => !bundle.permissions.length));
  const anonymous = createHarness({ authenticated: false });
  await assert.rejects(() => anonymous.adapter.getCurrentUser(), /authenticated/);
  assert.deepEqual(plain(await anonymous.adapter.getUserPermissions()), []);
  assert.equal(anonymous.requests.length, 0);
});

test("nested additions, duplication, option and text edits retain V2 state and isolated snapshots", async () => {
  const h = createHarness({ blocks: [{ uuid: "container", bundle: "container", props: { blocks: [] } }] });
  const state = await h.adapter.loadState();
  await h.adapter.addNewBlock({
    bundle: "heading",
    blockUuid: "new-heading",
    host: { type: "block", uuid: "container", fieldName: "blocks" },
    afterUuid: null,
  });
  const before = h.adapter.mapState(state);
  await h.adapter.updateFieldValue({
    uuid: "new-heading",
    fieldName: "text",
    fieldValue: "<div>First</div><div>Second</div>",
  });
  await h.adapter.updateOptions([{ uuid: "new-heading", key: "color", value: "blue" }]);
  const mapped = h.adapter.mapState(state);
  const nested = mapped.mutatedState.fields.find((field: any) => field.entityUuid === "container").list;
  assert.equal(nested[0].uuid, "new-heading");
  assert.equal(nested[0].isVisible, true);
  assert.deepEqual(plain(nested[0].editContext), { isPublished: false, isNew: true });
  assert.deepEqual(plain(mapped.mutatedState.fields[0].list[0].editContext), { isPublished: true, isNew: false });
  assert.equal(state.blocks[0].editContext, undefined);
  assert.equal(nested[0].props.text, "First<br>Second");
  assert.equal(mapped.mutatedState.mutatedOptions["new-heading"].color, "blue");
  assert.notEqual(before.mutatedState.fields[1].list[0].props.text, nested[0].props.text);
  assert.equal(mapped.publishOptions.canSchedule, false);
  await h.adapter.duplicateBlocks(["container"]);
  assert.equal(state.blocks.length, 2);
  assert.notEqual(state.blocks[1].props.blocks[0].uuid, "new-heading");
  assert.equal(state.blocks[1].props.blocks[0].isVisible, true);
  assert.ok(h.storage.size);
});

test("failed and conflicting publication retain drafts and revision; success updates public data", async () => {
  const h = createHarness({ blocks: [{ uuid: "heading", bundle: "heading", props: { text: "Live" } }] });
  const state = await h.adapter.loadState();
  await h.adapter.updateFieldValue({ uuid: "heading", fieldName: "text", fieldValue: "Draft" });
  for (const status of [500, 409]) {
    h.failPublish(status);
    const result = await h.adapter.publish({ closeAfterPublish: true });
    assert.equal(result.success, false);
    assert.equal(h.liveBlocks()[0].props!.text, "Live");
    assert.equal(h.draft()?.draft_blocks[0].props.text, "Draft");
    assert.equal(state.blocks[0].props.text, "Draft");
    assert.equal(h.storage.size, 1);
  }
  h.failPublish();
  assert.equal((await h.adapter.publish({ closeAfterPublish: false })).success, true);
  assert.equal(h.pageData.data.value[0].props!.text, "Draft");
  assert.equal(h.storage.size, 0);
  assert.equal(h.draft()?.base_revision, "published-revision");
  assert.equal(h.draft()?.draft_blocks, null);
  const publications = h.requests.filter((request) => request.path === "/blokkli-persistence/publish");
  assert.ok(publications.every((request) => JSON.parse(request.body!).baseRevision === "initial-revision"));
});

test("V2 drag events and multi-selection preserve order across different nested fields", async () => {
  const h = createHarness({
    blocks: [
      { uuid: "first", bundle: "heading" },
      { uuid: "second", bundle: "heading" },
      { uuid: "container", bundle: "container", props: { blocks: [] } },
      { uuid: "timeline", bundle: "timeline", props: { items: [] } },
    ],
  });
  const state = await h.adapter.loadState();
  assert.equal(
    (
      await h.adapter.moveBlock({
        item: { itemType: "existing", block: { uuid: "first", bundle: "heading" } },
        host: { type: "block", uuid: "container", fieldName: "blocks" },
        afterUuid: null,
      })
    ).success,
    true,
  );
  assert.equal(state.blocks[1].props.blocks[0].uuid, "first");
  assert.equal(
    (
      await h.adapter.moveMultipleBlocks({
        uuids: ["second", "first"],
        host: { type: "block", uuid: "timeline", fieldName: "items" },
        afterUuid: null,
      })
    ).success,
    true,
  );
  assert.deepEqual(
    plain(state.blocks.find((block: Block) => block.uuid === "timeline").props.items.map((block: Block) => block.uuid)),
    ["second", "first"],
  );
  assert.equal(state.blocks.find((block: Block) => block.uuid === "container").props.blocks.length, 0);
});

test("a recovered server draft retains the revision it was based on", async () => {
  const h = createHarness({
    blocks: [],
    draft: {
      id: 1,
      owner: "editor-id",
      owner_name: "Test Editor",
      draft_blocks: [{ uuid: "recovered", bundle: "text", props: { content: "Recovered" } }],
      current_index: 0,
      mutations: [{ pluginId: "edit" }],
      base_revision: "older-revision",
      date_updated: new Date().toISOString(),
    },
  });
  const state = await h.adapter.loadState();
  assert.equal(state.blocks[0].isVisible, true);
  await h.adapter.publish();
  const request = h.requests.find((command) => command.path === "/blokkli-persistence/publish")!;
  assert.equal(JSON.parse(request.body!).baseRevision, "older-revision");
});

test("V2 media and reusable libraries expose searchable paginated filters and reference fields", async () => {
  const h = createHarness();
  const media = await h.adapter.mediaLibraryGetResults({ page: 1, filters: { search: " climate " } });
  assert.equal(media.items.length, 24);
  assert.equal(media.total, 49);
  assert.equal(media.filters[0].name, "search");
  assert.equal(media.filters[0].required, false);
  const request = h.requests.find((command) => command.operation === "readFiles")!;
  assert.equal(request.query.offset, 24);
  assert.equal(request.query.filter._or[0].title._icontains, "climate");
  assert.ok(
    (await h.adapter.getDroppableFieldConfig()).every(
      (field: any) => field.type === "reference" && field.allowed[0].type === "media",
    ),
  );
  h.setLibraryItems(
    Array.from({ length: 21 }, (_, index) => ({
      uuid: `library-${index}`,
      bundle: "heading",
      props: { text: `Heading ${index}` },
    })),
  );
  const library = await h.adapter.getLibraryItems({ page: 1, bundles: ["heading"], filters: { search: " Heading " } });
  assert.equal(library.items.length, 20);
  assert.equal(library.total, 41);
  assert.equal(library.filters[0].name, "search");
  assert.equal(library.items[0].item.isVisible, true);
  const libraryRequest = h.requests.find((command) => command.collection === "library_items")!;
  assert.equal(libraryRequest.query.offset, 20);
  assert.equal(libraryRequest.query.filter.label._contains, "Heading");
  h.setLibraryItems([
    {
      uuid: "reusable-container",
      bundle: "container",
      props: {
        blocks: [{ uuid: "legacy-child", bundle: "heading", props: { text: "Nested preview" } }],
      },
    },
  ]);
  const nestedLibrary = await h.adapter.getLibraryItems({ page: 0, bundles: [], filters: {} });
  assert.equal(nestedLibrary.items[0].item.props.blocks[0].isVisible, true);
});

test("cyclic/invalid moves and duplicate IDs cannot discard a subtree or partially move multiple blocks", async () => {
  const h = createHarness({
    blocks: [
      {
        uuid: "outer",
        bundle: "container",
        props: {
          blocks: [
            {
              uuid: "inner",
              bundle: "container",
              props: { blocks: [{ uuid: "heading", bundle: "heading", props: { text: "Keep" } }] },
            },
          ],
        },
      },
      { uuid: "other", bundle: "text", props: { content: "Other" } },
    ],
  });
  const state = await h.adapter.loadState();
  const before = plain(state.blocks);
  for (const host of [
    { uuid: "inner", fieldName: "blocks" },
    { uuid: "outer", fieldName: "blocks" },
    { uuid: "inner", fieldName: "not-a-field" },
    { uuid: "other", fieldName: "blocks" },
  ]) {
    const result = await h.adapter.moveBlock({
      item: { block: { uuid: "outer", bundle: "container" } },
      host: { type: "block", ...host },
      afterUuid: null,
    });
    assert.equal(result.success, false);
    assert.deepEqual(plain(state.blocks), before);
  }
  const multiple = await h.adapter.moveMultipleBlocks({
    uuids: ["other", "missing"],
    host: { type: "block", uuid: "inner", fieldName: "blocks" },
    afterUuid: null,
  });
  assert.equal(multiple.success, false);
  assert.deepEqual(plain(state.blocks), before);
  assert.equal(
    (
      await h.adapter.addNewBlock({
        bundle: "text",
        blockUuid: "other",
        host: { type: "entity", uuid: "page-id" },
        afterUuid: null,
      })
    ).success,
    false,
  );
  assert.deepEqual(plain(state.blocks), before);
});

test("malformed stored drafts and history are rejected before recovery or persistence", async () => {
  for (const data of [
    { draft_blocks: [{ uuid: "bad", bundle: "heading", props: { text: [] } }], mutations: [] },
    { draft_blocks: [], mutations: ["bad"] },
    { draft_blocks: [], mutations: [], current_index: 10 },
  ]) {
    const h = createHarness({ draft: { id: 1, owner: "editor-id", current_index: -1, ...data } });
    await assert.rejects(h.adapter.loadState(), /Invalid recoverable editor draft/);
    assert.equal(
      h.requests.filter((command) => command.operation === "updateItem" || command.operation === "deleteItem").length,
      0,
    );
  }
  const local = createHarness();
  const key = "slk:blokkli-draft:pages:page-id";
  const saved = JSON.stringify({
    ownerId: "editor-id",
    blocks: [{ uuid: "bad", bundle: "heading", props: { text: {} } }],
  });
  local.storage.set(key, saved);
  await assert.rejects(local.adapter.loadState(), /Invalid recoverable editor draft/);
  assert.equal(local.storage.get(key), saved);
});

test("field and option events validate values before modifying live editor state", async () => {
  const h = createHarness({ blocks: [{ uuid: "heading", bundle: "heading", props: { text: "Keep" } }] });
  const state = await h.adapter.loadState();
  const before = plain(state.blocks);
  assert.throws(() => h.adapter.updateFieldValue({ uuid: "heading", fieldName: "text", fieldValue: { bad: true } }));
  assert.throws(() =>
    h.adapter.updateOptions([
      { uuid: "heading", key: "color", value: "blue" },
      { uuid: "heading", key: "__proto__", value: { polluted: true } },
    ]),
  );
  assert.deepEqual(plain(state.blocks), before);
});

test("editor permission caches are isolated between authenticated identities and logout", async () => {
  const h = createHarness();
  assert.ok((await h.adapter.getUserPermissions()).includes("use_blokkli"));
  h.setSession("another-editor", { blocks: { read: { access: "full" } } });
  assert.deepEqual(plain(await h.adapter.getUserPermissions()), []);
  assert.equal(h.requests.filter((command) => command.path === "/permissions/me").length, 2);
  h.setSession();
  assert.deepEqual(plain(await h.adapter.getUserPermissions()), []);
  assert.equal(h.requests.filter((command) => command.path === "/permissions/me").length, 2);
});

test("every registered bundle has checked defaults and unsupported additions leave state intact", async () => {
  const h = createHarness();
  const state = await h.adapter.loadState();
  for (const bundle of Object.keys(editorBlocks.BLOCK_DEFINITIONS)) {
    const result = await h.adapter.addNewBlock({
      bundle,
      blockUuid: `default-${bundle}`,
      host: { type: "entity", uuid: "page-id" },
      afterUuid: null,
    });
    assert.equal(result.success, true, bundle);
  }
  assert.doesNotThrow(() => editorBlocks.parseEditorBlocks(plain(state.blocks)));
  const before = plain(state.blocks);
  const result = await h.adapter.addNewBlock({
    bundle: "unsupported",
    blockUuid: "bad",
    host: { type: "entity", uuid: "page-id" },
    afterUuid: null,
  });
  assert.equal(result.success, false);
  assert.deepEqual(plain(state.blocks), before);
});
