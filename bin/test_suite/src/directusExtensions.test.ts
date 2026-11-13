import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const extensions = new URL("../../../src/directus/extensions/", import.meta.url);
const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
const vue = frontend("vue") as typeof import("../../../src/frontend/node_modules/vue/dist/vue.js");
const compiler = frontend(
  "@vue/compiler-sfc",
) as typeof import("../../../src/frontend/node_modules/@vue/compiler-sfc/dist/compiler-sfc.js");
const ssr = frontend(
  "@vue/server-renderer",
) as typeof import("../../../src/frontend/node_modules/@vue/server-renderer/dist/server-renderer.js");

function load<T>(name: string, globals: Record<string, unknown> = {}, dependencies: Record<string, unknown> = {}): T {
  const file = new URL(name, extensions);
  const source = readFileSync(file, "utf8");
  const module = { exports: {} };
  const require = createRequire(file);
  runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
      .outputText,
    {
      module,
      exports: module.exports,
      console,
      process: { env: {} },
      URL,
      URLSearchParams,
      AbortSignal,
      require: (id: string) => (id in dependencies ? dependencies[id] : require(id)),
      ...globals,
    },
  );
  return module.exports as T;
}

type Handler = (request: Record<string, unknown>, reply: ReturnType<typeof response>) => Promise<unknown>;
function response() {
  return {
    code: 200,
    body: undefined as unknown,
    status(code: number) {
      this.code = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

test("every maintained Directus extension has a strict source-complete compiler gate before bundling", () => {
  let packages = 0;
  let sources = 0;
  for (const name of readdirSync(extensions)) {
    const directory = new URL(`${name}/`, extensions);
    if (!existsSync(new URL("package.json", directory))) continue;
    packages++;
    const files = readdirSync(new URL("src/", directory), { recursive: true, encoding: "utf8" });
    const hasVue = files.some((file) => file.endsWith(".vue"));
    const pkg = JSON.parse(readFileSync(new URL("package.json", directory), "utf8"));
    assert.equal(pkg.scripts.typecheck, `${hasVue ? "vue-tsc" : "tsc"} --noEmit -p tsconfig.json`, name);
    assert.equal(pkg.scripts.prebuild, "npm run typecheck", name);
    assert.ok(pkg.devDependencies["@directus/types"], name);
    if (hasVue) assert.ok(pkg.devDependencies["vue-tsc"], name);
    const configFile = fileURLToPath(new URL("tsconfig.json", directory));
    const raw = ts.readConfigFile(configFile, ts.sys.readFile);
    assert.equal(raw.error, undefined, name);
    const config = ts.parseJsonConfigFileContent(
      raw.config,
      ts.sys,
      fileURLToPath(directory),
      undefined,
      configFile,
      undefined,
      [{ extension: ".vue", isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }],
    );
    assert.deepEqual(config.errors, [], name);
    assert.equal(config.options.strict, true, name);
    assert.equal(config.options.noEmit, true, name);
    assert.equal(config.options.allowJs, false, name);
    for (const file of files) {
      if (!/\.(?:ts|tsx|vue|js|jsx|mjs|cjs)$/.test(file)) continue;
      assert.ok(!/\.(?:js|jsx|mjs|cjs)$/.test(file), `Unchecked extension source: ${name}/${file}`);
      assert.ok(
        config.fileNames.includes(fileURLToPath(new URL(`src/${file}`, directory))),
        `Omitted extension source: ${name}/${file}`,
      );
      if (file.endsWith(".vue")) {
        const { descriptor, errors } = compiler.parse(readFileSync(new URL(`src/${file}`, directory), "utf8"));
        assert.deepEqual(errors, [], `${name}/${file}`);
        for (const script of [descriptor.script, descriptor.scriptSetup])
          if (script) assert.equal(script.lang, "ts", `${name}/${file}`);
      }
      sources++;
    }
  }
  assert.equal(packages, 16);
  assert.ok(sources >= 62);
});

test("consent endpoints reject anonymous callers and resolve a missing request schema before service reads", async () => {
  const routes = new Map<string, Handler>();
  const schema = { collections: {} };
  const serviceOptions: Record<string, unknown>[] = [];
  let schemaReads = 0;
  class ItemsService {
    constructor(
      readonly collection: string,
      options: Record<string, unknown>,
    ) {
      serviceOptions.push(options);
    }
    async readByQuery() {
      return this.collection === "agreement_versions"
        ? [
            { id: "terms", type: "terms_of_service", version: "1" },
            { id: "privacy", type: "data_protection", version: "2" },
          ]
        : [{ consent_target: "terms" }, { consent_target: "privacy" }];
    }
  }
  const extension = load<{ default: (router: unknown, context: unknown) => void }>(
    "consent-management/src/consent/endpoint/index.ts",
  );
  extension.default(
    {
      get: (path: string, handler: Handler) => routes.set(path, handler),
      post: (path: string, handler: Handler) => routes.set(path, handler),
      delete: (path: string, handler: Handler) => routes.set(path, handler),
    },
    {
      services: { ItemsService },
      getSchema: async () => {
        schemaReads++;
        return schema;
      },
    },
  );
  assert.equal(routes.size, 4);
  for (const handler of routes.values()) {
    const reply = response();
    await handler({}, reply);
    assert.equal(reply.code, 401);
  }
  assert.equal(schemaReads, 0);
  assert.equal(serviceOptions.length, 0);
  const reply = response();
  await routes.get("/consent/status")!({ accountability: { user: "fixture-user" } }, reply);
  assert.equal(schemaReads, 1);
  assert.equal(reply.code, 200);
  assert.equal((reply.body as { hasAccepted: boolean }).hasAccepted, true);
  for (const options of serviceOptions) {
    assert.equal(options.schema, schema);
    assert.equal(options.accountability, null);
  }
  await routes.get("/consent/status")!({ accountability: { user: "fixture-user" }, schema }, response());
  assert.equal(schemaReads, 1, "reuse the request schema when Directus provides it");
});

test("weekly rating report uses the extension database through the supported knex option", async () => {
  let run: (() => Promise<void>) | undefined;
  let options: Record<string, unknown> | undefined;
  const database = {};
  const schema = {};
  const extension = load<{ default: (registrar: unknown, context: unknown) => void }>(
    "hook-measure-rating-reports/src/index.ts",
    {
      console: {
        warn() {},
        error(message: unknown) {
          assert.fail(String(message));
        },
      },
    },
    {
      "./reportCsv": {
        stringifyRatingReport() {
          assert.fail("empty results must not create a report");
        },
      },
    },
  );
  extension.default(
    {
      schedule: (_cron: string, handler: () => Promise<void>) => {
        run = handler;
      },
    },
    {
      database,
      getSchema: async () => schema,
      services: {
        ItemsService: class {
          constructor(_collection: string, value: Record<string, unknown>) {
            options = value;
          }
          async readByQuery() {
            return [];
          }
        },
      },
    },
  );
  assert.ok(run);
  await run();
  assert.equal(options?.knex, database);
  assert.equal(options?.schema, schema);
  assert.equal(options?.database, undefined);
});

test("consent hook retains service-role exemptions and requires both current legal agreements", async () => {
  type Filter = (items: unknown, meta: { collection: string }, context: unknown) => Promise<unknown>;
  const filters = new Map<string, Filter>();
  let role = "ordinary-role";
  let accepted: string[] = [];
  let configured = true;
  class ItemsService {
    constructor(readonly collection: string) {}
    async readOne() {
      return { role };
    }
    async readByQuery(query: { filter?: { name?: { _in: string[] } } }) {
      if (this.collection === "directus_roles") {
        for (const name of ["Frontend-Public", "Frontend-Server", "Frontend-Preview"])
          assert.ok(query.filter?.name?._in.includes(name));
        return [{ id: "frontend-role" }];
      }
      if (this.collection === "agreement_versions")
        return configured
          ? [
              { id: "terms", type: "terms_of_service" },
              { id: "privacy", type: "data_protection" },
            ]
          : [];
      return accepted.map((consent_target) => ({ consent_target }));
    }
  }
  const extension = load<{ default: (registrar: unknown, context: unknown) => void }>(
    "consent-management/src/consent/hook/index.ts",
  );
  extension.default(
    { filter: (event: string, handler: Filter) => filters.set(event, handler) },
    { services: { ItemsService } },
  );
  assert.equal(filters.size, 3);
  const items = { fixture: true };
  const context = { accountability: { user: "fixture-user" }, schema: {} };
  for (const handler of filters.values()) {
    assert.equal(await handler(items, { collection: "user_consent" }, context), items);
    assert.equal(await handler(items, { collection: "ratings_measures" }, { accountability: null }), items);
    role = "frontend-role";
    assert.equal(await handler(items, { collection: "ratings_measures" }, context), items);
    role = "ordinary-role";
    accepted = ["terms"];
    await assert.rejects(handler(items, { collection: "ratings_measures" }, context), { code: "CONSENT_NOT_ACCEPTED" });
    accepted = ["terms", "privacy"];
    assert.equal(await handler(items, { collection: "ratings_measures" }, context), items);
    configured = false;
    await assert.rejects(handler(items, { collection: "ratings_measures" }, context), {
      code: "CONSENT_CONFIGURATION_ERROR",
    });
    configured = true;
  }
});

test("Unsplash search handles query-bearing requests and rejects missing or malformed accountability", async () => {
  let handler: Handler | undefined;
  const extension = load<{ default: { handler: (router: unknown, context: unknown) => void } }>(
    "endpoint-unsplash/src/index.ts",
  );
  extension.default.handler(
    {
      get: (_path: string, value: Handler) => {
        handler = value;
      },
      post() {},
    },
    { env: { UNSPLASH_ACCESS_KEY: "fixture-key" }, logger: {} },
  );
  assert.ok(handler);
  for (const accountability of [undefined, null, {}, { user: 42 }, { user: "" }]) {
    const reply = response();
    await handler({ query: { q: ["forest"] }, accountability }, reply);
    assert.equal(reply.code, 401);
  }
  const reply = response();
  await handler({ query: { q: "  " }, accountability: { user: "fixture-user" } }, reply);
  assert.equal(reply.code, 400);
});

test("rating radio choices render without an undefined block property and preserve native button states", async () => {
  const source = readFileSync(
    new URL("custom-slk-interfaces/src/images-as-radio-buttons/interface.vue", extensions),
    "utf8",
  );
  const { descriptor } = compiler.parse(source);
  const script = compiler.compileScript(descriptor, { id: "rating-radio", inlineTemplate: true });
  const module = { exports: { default: {} as import("../../../src/frontend/node_modules/vue/dist/vue.js").Component } };
  runInNewContext(
    ts.transpileModule(script.content, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id: string) =>
        id === "vue"
          ? vue
          : id === "../directus-url"
            ? { directusUrl: () => "/assets" }
            : { default: () => ({ addTokenToURL: (url: string) => url }) },
    },
  );
  const app = vue.createSSRApp(module.exports.default, {
    field: "rating",
    value: "0",
    disabled: true,
    choices: [
      { value: "0", text: "Zero" },
      { value: "1", text: "One" },
    ],
  });
  app.provide("api", {});
  const warnings: string[] = [];
  app.config.warnHandler = (message) => warnings.push(message);
  const html = await ssr.renderToString(app);
  assert.match(html, /v-icon-radio block checked rating-0/);
  assert.match(html, /aria-pressed="true" disabled/);
  assert.match(html, /aria-pressed="false" disabled/);
  assert.deepEqual(warnings, []);
});

test("REST Insights panels preserve query permissions, variables, refresh and explicit failures without GraphQL", async () => {
  const mounted: Array<() => void> = [];
  const updated: Array<() => void> = [];
  const unmounted: Array<() => void> = [];
  const requests: Array<{ path: string; params: unknown; signal: AbortSignal }> = [];
  type Action = { name: string; args: unknown[]; after: (callback: () => void) => void };
  let onAction: (action: Action) => void = () => undefined;
  let deny = false;
  let unsubscribed = false;
  const native = {
    id: "metric",
    component: "native-metric",
    options: [{ field: "collection" }],
    query: (attrs: Record<string, unknown>) => ({
      collection: attrs.collection,
      query: { aggregate: { countDistinct: ["id"] }, filter: attrs.filter, limit: 1 },
    }),
  };
  const { createRestPanel } = load<{
    createRestPanel: (type: string) => {
      component: {
        setup: (
          props: object,
          context: { attrs: Record<string, unknown> },
        ) => () => { children: Array<{ type: string; props: { data: unknown } }> };
      };
    };
  }>(
    "community-activity/src/rest-panels/createRestPanel.ts",
    {
      AbortController,
      setTimeout: (callback: () => void) => {
        queueMicrotask(callback);
        return 0;
      },
    },
    {
      "@directus/extensions-sdk": {
        definePanel: (config: unknown) => config,
        useExtensions: () => ({ panels: vue.ref([native]) }),
        useStores: () => ({
          useInsightsStore: () => ({
            $onAction: (handler: typeof onAction) => {
              onAction = handler;
              return () => {
                unsubscribed = true;
              };
            },
          }),
        }),
        useApi: () => ({
          get: async (path: string, options: { params: unknown; signal: AbortSignal }) => {
            requests.push({ path, ...options });
            if (deny) throw new Error("Forbidden");
            return { data: { data: [{ countDistinct: { id: 7 } }] } };
          },
        }),
      },
      vue: {
        ...vue,
        onMounted: (callback: () => void) => mounted.push(callback),
        onUpdated: (callback: () => void) => updated.push(callback),
        onBeforeUnmount: (callback: () => void) => unmounted.push(callback),
        resolveComponent: (name: string) => name,
      },
    },
  );
  const attrs = { collection: "directus_users", dashboard: "dashboard-1", filter: { status: { _eq: "active" } } };
  const render = createRestPanel("metric").component.setup({}, { attrs });
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  mounted.forEach((callback) => callback());
  await tick();
  assert.equal(requests[0]?.path, "/users");
  assert.deepEqual(requests[0]?.params, { aggregate: { countDistinct: ["id"] }, filter: attrs.filter, limit: 1 });
  assert.equal(render().children[0]?.type, "native-metric");
  assert.deepEqual(render().children[0]?.props.data, [{ countDistinct: { id: 7 } }]);
  // A resolved dashboard variable changes the REST filter, not a GraphQL batch.
  attrs.filter = { status: { _eq: "draft" } };
  updated.forEach((callback) => callback());
  await tick();
  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.signal.aborted, true);
  deny = true;
  onAction({ name: "refresh", args: ["dashboard-1"], after: (callback) => callback() });
  await tick();
  assert.equal(render().children[0]?.type, "v-notice", "Denied reads cannot render a metric zero");
  deny = false;
  onAction({ name: "refresh", args: ["dashboard-1"], after: (callback) => callback() });
  await tick();
  assert.equal(render().children[0]?.type, "native-metric", "Native refresh retries a failed read");
  unmounted.forEach((callback) => callback());
  assert.equal(unsubscribed, true);
  assert.equal(requests.at(-1)?.signal.aborted, true);
});
