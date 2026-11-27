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
      process: {
        env: {
          SLK_ENV: "production",
          SLK_DEPLOYMENT_TARGET: "production",
          PUBLIC_URL: "https://www.stadt-land-klima.de/backend",
        },
      },
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

test("weekly rating reports never schedule or access services outside real production", () => {
  const production = {
    SLK_ENV: "production",
    SLK_DEPLOYMENT_TARGET: "production",
    PUBLIC_URL: "https://www.stadt-land-klima.de/backend",
  };
  const cases = [
    {},
    { ...production, SLK_ENV: "development" },
    { ...production, SLK_DEPLOYMENT_TARGET: "staging" },
    { ...production, SLK_DEPLOYMENT_TARGET: "future" },
    { ...production, SLK_DEPLOYMENT_TARGET: undefined },
    { ...production, PUBLIC_URL: "https://staging.stadt-land-klima.de/backend" },
    { ...production, SLK_DEPLOYMENT_TARGET: undefined, PUBLIC_URL: "https://staging.stadt-land-klima.de/backend" },
    { ...production, PUBLIC_URL: "https://stadt-land-klima.de.evil.example/backend" },
    { ...production, PUBLIC_URL: "http://stadt-land-klima.de/backend" },
    { ...production, PUBLIC_URL: "https://user@stadt-land-klima.de/backend" },
    { ...production, PUBLIC_URL: "https://stadt-land-klima.de:8443/backend" },
    { ...production, PUBLIC_URL: "invalid" },
    { ...production, REPORT_ENABLED: "false" },
    { ...production, REPORT_ENABLED: "true", SLK_DEPLOYMENT_TARGET: "staging" },
  ];
  for (const env of cases) {
    const extension = load<{ default: (registrar: unknown, context: unknown) => void }>(
      "hook-measure-rating-reports/src/index.ts",
      { process: { env } },
      { "./reportCsv": {} },
    );
    extension.default(
      {
        schedule() {
          assert.fail("A non-production report must not be scheduled");
        },
      },
      {
        get services() {
          return assert.fail("Disabled reporting must not access mail/data services");
        },
      },
    );
  }
});

test("weekly rating reports support both production hostnames and recheck before scheduled work", async () => {
  for (const hostname of ["stadt-land-klima.de", "www.stadt-land-klima.de"]) {
    const env = {
      SLK_ENV: "production",
      SLK_DEPLOYMENT_TARGET: "production",
      PUBLIC_URL: `https://${hostname}/backend`,
      REPORT_ENABLED: "true",
    };
    let run: (() => Promise<void>) | undefined;
    const extension = load<{ default: (registrar: unknown, context: unknown) => void }>(
      "hook-measure-rating-reports/src/index.ts",
      { process: { env } },
      { "./reportCsv": {} },
    );
    extension.default(
      {
        schedule(cron: string, handler: () => Promise<void>) {
          assert.equal(cron, "0 0 * * 0");
          run = handler;
        },
      },
      {
        services: {},
        getSchema() {
          assert.fail("Disabling a scheduled report must prevent data access and email");
        },
      },
    );
    assert.ok(run);
    env.REPORT_ENABLED = "false";
    await run();
  }
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

test("Wahlcheck categories constrain reads, mutations and profile escalation in checked YAML", () => {
  const yaml = frontend("yaml");
  const read = (path: string) => yaml.parse(readFileSync(new URL(`../${path}`, extensions), "utf8"));
  const policy = read("policies/WahlcheckAdmin.yaml");
  const permission = (collection: string, action: string) =>
    policy.permissions.find((entry: any) => entry.collection === collection && entry.action === action);
  const category = { is_localzero: { _eq: "$CURRENT_USER.is_localzero" } };
  for (const collection of ["elections", "questions", "candidate"]) {
    const scope = collection === "elections" ? category : { election: category };
    for (const action of ["read", "update"]) assert.deepEqual(permission(collection, action).permissions, scope);
  }
  assert.deepEqual(permission("answers", "read").permissions, {
    _and: [{ question: { election: category } }, { candidate: { election: category } }],
  });
  assert.deepEqual(permission("candidate", "delete").permissions._and, [
    { has_answered: { _eq: false } },
    { election: category },
  ]);
  assert.deepEqual(permission("questions", "delete").permissions._and, [
    { election: { response_cutoff_date: { _eq: null } } },
    { election: category },
  ]);
  for (const action of ["create", "update"]) {
    assert.deepEqual(permission("elections", action).validation, category);
    assert.ok(permission("elections", action).fields.includes("is_localzero"));
  }
  assert.deepEqual(permission("elections", "create").presets, { is_localzero: "$CURRENT_USER.is_localzero" });
  for (const collection of ["elections", "directus_users"]) {
    const field = read(`schema/fields/${collection}/is_localzero.yaml`);
    assert.equal(field.schema.default_value, false);
    assert.equal(field.schema.is_nullable, false);
    assert.equal(field.meta.translations.length, 3);
  }
  const own = read("policies/App-Zugriff-Minimum.yaml").permissions;
  assert.ok(
    own
      .find((entry: any) => entry.collection === "directus_users" && entry.action === "read")
      .fields.includes("is_localzero"),
  );
  for (const file of readdirSync(new URL("../policies/", extensions))) {
    const policy = read(`policies/${file}`);
    for (const entry of policy.permissions ?? []) {
      if (entry.collection !== "directus_users" || !["update", "create"].includes(entry.action)) continue;
      assert.ok(
        !entry.fields?.includes("is_localzero") && !entry.fields?.includes("*"),
        `${file}: category escalation`,
      );
    }
  }
});

test("Wahlcheck relation guards reject foreign and nested election writes and scope comments by readable questions", async () => {
  type Row = Record<string, any>;
  type Filter = (payload: Row, meta: Row, context: Row) => Promise<Row>;
  const filters = new Map<string, Filter>();
  let roleName = "WahlcheckAdmin";
  let questionIds = ["owned-question"];
  const database: any = () => ({
    whereIn() {
      return this;
    },
    where() {
      return this;
    },
    first: async () => (roleName === "WahlcheckAdmin" ? { id: "role" } : undefined),
  });
  const accountability = { user: "editor", role: "role", roles: ["role"], admin: false };
  const context = { database, schema: null, accountability };
  let reads = 0;
  class ItemsService {
    constructor(
      readonly collection: string,
      options: Row,
    ) {
      assert.equal(options.accountability, accountability);
      assert.equal(options.knex, database);
      assert.ok(options.schema);
    }
    async readOne(id: string) {
      reads++;
      if (id !== "owned-election") throw Object.assign(new Error("Forbidden"), { status: 403 });
      return { id };
    }
    async readByQuery(query: Row) {
      assert.equal(this.collection, "questions");
      assert.equal(query.limit, -1);
      return questionIds.map((id) => ({ id }));
    }
  }
  const hook = load<{ default: (register: Row, context: Row) => void }>(
    "election-check/src/category-access/index.ts",
    {},
    { "@directus/extensions-sdk": { defineHook: (handler: unknown) => handler } },
  );
  hook.default(
    { filter: (name: string, handler: Filter) => filters.set(name, handler) },
    {
      services: { ItemsService },
      getSchema: async () => ({ collections: {} }),
    },
  );
  for (const collection of ["candidate", "questions"]) {
    const create = filters.get("items.create")!;
    const update = filters.get("items.update")!;
    for (const handler of [create, update]) {
      await handler({ election: "owned-election" }, { collection }, context);
      for (const election of ["foreign-election", null, { id: "owned-election" }, { is_localzero: false }])
        await assert.rejects(handler({ election }, { collection }, context), { status: 403 });
    }
    await assert.rejects(create({}, { collection }, context), { status: 403 });
    const before = reads;
    await update({ title: "Unrelated edit" }, { collection }, context);
    await create({ election: "foreign-election" }, { collection }, { ...context, accountability: { admin: true } });
    await create({ election: "foreign-election" }, { collection }, { ...context, accountability: null });
    assert.equal(reads, before);
  }
  const query = { filter: { item: { _eq: "foreign-question" } }, limit: 10 };
  const comments = filters.get("comments.query")!;
  const scoped = await comments(query, {}, context);
  assert.deepEqual(JSON.parse(JSON.stringify(scoped)), {
    limit: 10,
    filter: { _and: [query.filter, { collection: { _eq: "questions" } }, { item: { _in: questionIds } }] },
  });
  questionIds = [];
  assert.deepEqual(JSON.parse(JSON.stringify((await comments({}, {}, context)).filter._and.at(-1))), {
    item: { _in: [] },
  });
  roleName = "LokalteamMitglied";
  assert.equal(await comments(query, {}, context), query);
});

test("contact notifications route every category to a fixed department and escape user HTML", async () => {
  const yaml = frontend("yaml");
  const flow = yaml.parse(readFileSync(new URL("../flows/notifyNewFeedback.yaml", extensions), "utf8"));
  const prepare = flow.operations.find((operation: { key: string }) => operation.key === flow.operation_key);
  const notification = flow.operations.find((operation: { key: string }) => operation.key === prepare.resolve_key);
  const copy = flow.operations.find((operation: { key: string }) => operation.key === "send_feedback_copy");
  const module = { exports: undefined as unknown as (data: unknown) => Promise<Record<string, string>> };
  runInNewContext(prepare.options.code, { module }, { timeout: 1000 });
  const expected = {
    legal: "legal",
    inaccuracy: "legal",
    bug: "info",
    suggestion: "info",
    other: "info",
    cooperation: "kooperationen",
    press: "presse",
    onboarding: "onboarding",
  };
  const field = yaml.parse(readFileSync(new URL("../schema/fields/feedback/type.yaml", extensions), "utf8"));
  assert.deepEqual(
    field.meta.options.choices.map((choice: { value: string }) => choice.value).sort(),
    Object.keys(expected).sort(),
  );
  assert.deepEqual(
    field.meta.display_options.choices.map((choice: { value: string }) => choice.value).sort(),
    Object.keys(expected).sort(),
  );
  for (const [type, mailbox] of [
    ...Object.entries(expected),
    ["unknown", "info"],
    ["__proto__", "info"],
    ["constructor", "info"],
  ]) {
    const prepared = await module.exports({
      $trigger: {
        payload: {
          type,
          recipient: "attacker@example.org",
          sender_name: '<img src=x onerror="alert(1)">',
          sender_contact: "person@example.org",
          title: "<b>Subject</b>",
          content: "<script>bad()</script>&",
        },
      },
    });
    assert.equal(prepared.recipient, `${mailbox}@stadt-land-klima.de`, type);
    assert.equal(prepared.content, "&lt;script&gt;bad()&lt;/script&gt;&amp;");
    assert.ok(!prepared.sender_name.includes("<"));
  }
  assert.deepEqual(notification.options.to, ["{{prepare_feedback_email.recipient}}"]);
  assert.equal(notification.resolve_key, "condition_send_copy");
  const condition = flow.operations.find((operation: { key: string }) => operation.key === notification.resolve_key);
  assert.equal(condition.options.filter.$trigger.payload.send_copy._eq, true);
  assert.equal(condition.resolve_key, copy.key);
  assert.deepEqual(copy.options.to, ["{{$trigger.payload.sender_contact}}"]);
  for (const mail of [notification, copy]) {
    assert.ok(mail.options.body.includes("{{prepare_feedback_email.content}}"));
    assert.ok(!mail.options.body.includes("{{$trigger.payload."));
  }
});
