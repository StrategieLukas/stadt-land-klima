import { loggingModule } from "./lib/loggingModules.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createHash, createHmac } from "node:crypto";
import ts from "typescript";
import { singleRouteValue, routeSlug, routeText } from "../../../src/frontend/shared/routeValues.js";
import {
  ClimateToolSchema,
  ContentPageSchema,
  TeamMemberSchema,
} from "../../../src/frontend/shared/contracts/content.js";
import {
  FeedbackRequestSchema,
  RegistrationRequestSchema,
  NewsletterRequestSchema,
  GenericFormRequestSchema,
  NewsletterListsSchema,
  MunicipalityPdfRequestSchema,
  ElectionPdfRequestSchema,
} from "../../../src/frontend/shared/contracts/submissions.js";
import { checkedWahlcheckState, ElectionTeamSchema } from "../../../src/frontend/shared/contracts/elections.js";
import { StatisticsSchema } from "../../../src/frontend/shared/contracts/municipality.js";
import { SummarySchema, CollectionsResponseSchema } from "../../../src/frontend/shared/contracts/slz.js";
import { kMeans, pairwiseDominance, statisticsDatum } from "../../../src/frontend/shared/statistics.js";
import { formatProjectDate } from "../../../src/frontend/shared/projectDate.js";
const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
type Row = Record<string, any>;
const h3 = {
  defineEventHandler: (fn: unknown) => fn,
  getQuery: (event: Row) => event.query ?? {},
  getRouterParam: (event: Row, key: string) => event.params?.[key],
  setResponseHeader() {},
  readBody: async (event: Row) => event.body,
  createError: (options: Row) => Object.assign(new Error(options.statusMessage ?? options.message), options),
};
function load(path: string, dependencies: Row = {}, globals: Row = {}): Row {
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL("../../../src/frontend/" + path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const requireModule = (id: string): unknown => {
    if (id in dependencies) return dependencies[id];
    const logging = loggingModule(id);
    if (logging) return logging;
    if (id === "h3") return h3;
    if (id.endsWith("/rateLimit")) return { rateLimit: async () => true };
    if (["zod", "sanitize-html", "node:crypto"].includes(id)) return frontend(id);
    if (id.startsWith("~/shared/")) return frontend("./" + id.slice(2) + ".ts");
    if (id.endsWith("/cmsValue")) return load("server/utils/cmsValue.ts");
    if (id.endsWith("/parseCms")) return load("server/utils/parseCms.ts");
    if (id.endsWith("/publicQuery")) return load("server/utils/publicQuery.ts");
    throw new Error("Unexpected import in " + path + ": " + id);
  };
  runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    require: requireModule,
    ...h3,
    Buffer,
    URL,
    URLSearchParams,
    Date,
    process,
    console: { warn() {}, error() {} },
    ...globals,
  });
  return module.exports;
}
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test("all pages parse and their scripts use TypeScript", () => {
  const compiler = frontend(
    "@vue/compiler-sfc",
  ) as typeof import("../../../src/frontend/node_modules/@vue/compiler-sfc/dist/compiler-sfc.js");
  const root = new URL("../../../src/frontend/pages/", import.meta.url);
  let count = 0;
  for (const name of readdirSync(root, { recursive: true, encoding: "utf8" }).filter((name) => name.endsWith(".vue"))) {
    const { descriptor, errors } = compiler.parse(readFileSync(new URL(name, root), "utf8"));
    assert.deepEqual(errors, [], name);
    for (const script of [descriptor.script, descriptor.scriptSetup]) if (script) assert.equal(script.lang, "ts", name);
    count++;
  }
  assert.ok(count >= 35);
  const components = new URL("../../../src/frontend/components/", import.meta.url);
  for (const name of readdirSync(components, { recursive: true, encoding: "utf8" }).filter((name) =>
    name.endsWith(".vue"),
  )) {
    const { descriptor } = compiler.parse(readFileSync(new URL(name, components), "utf8"));
    assert.equal(descriptor.template?.lang, undefined, "Template checks require native HTML: " + name);
  }
});

test("route values distinguish absent, repeated, invalid and supported input", () => {
  for (const value of [undefined, null, ["a"], ["a", "b"], {}, 1]) {
    assert.equal(singleRouteValue(value), undefined);
    assert.equal(routeSlug(value), undefined);
    assert.equal(routeText(value, 200), "");
  }
  for (const value of ["../secret", "a/b", "", "a".repeat(161)]) assert.equal(routeSlug(value), undefined);
  assert.equal(routeSlug("some-page-2"), "some-page-2");
  assert.equal(routeText("äöü", 3), "äöü");
  assert.equal(routeText("long", 3), "");
});

test("content contracts project private fields and reject unsafe links and malformed records", () => {
  const page = { id: "id", slug: "index", name: "Home", contents: null, status: "published", secret: "hidden" };
  assert.equal("secret" in ContentPageSchema.parse(page), false);
  assert.equal(ContentPageSchema.safeParse({ ...page, status: "draft" }).success, false);
  assert.equal(ContentPageSchema.safeParse({ ...page, contents: { bad: true } }).success, false);
  const tool = {
    id: "tool",
    title: "Tool",
    description: "Description",
    link: "https://example.org",
    image: null,
    sort: null,
  };
  assert.equal(ClimateToolSchema.safeParse(tool).success, true);
  for (const link of ["javascript:alert(1)", "data:text/html,test", "//example.org"])
    assert.equal(ClimateToolSchema.safeParse({ ...tool, link }).success, false);
  assert.deepEqual(TeamMemberSchema.parse({ id: "user", avatar: null, password: "hidden" }), {
    id: "user",
    first_name: null,
    last_name: null,
    bio: null,
    avatar: null,
    slk_team: [],
  });
});

test("public query contracts reject repetition, injection, bad limits and invalid IDs", () => {
  const { queryText, queryChoice, queryLimit, queryIds } = load("server/utils/publicQuery.ts");
  for (const value of [null, ["name"], { bad: true }]) assert.throws(() => queryText(value), { statusCode: 400 });
  for (const value of ["0", "-2", "NaN", "1.5", "201"])
    assert.throws(() => queryLimit(value, 20, 200), { statusCode: 400 });
  assert.equal(queryLimit("-1", 20, 200, true), -1);
  assert.equal(queryLimit(undefined, 20, 200), 20);
  assert.throws(() => queryChoice("name] OR secret=true", ["name"]), { statusCode: 400 });
  assert.throws(() => queryIds("../secret"), { statusCode: 400 });
  assert.deepEqual(plain(queryIds("id,id,other")), ["id", "other"]);
});

test("contact and registration reject malformed JSON, limits, invalid coordinates and unknown fields", () => {
  const feedback = {
    title: " Subject ",
    type: "cooperation",
    content: "Message",
    name: "Name",
    contact: "person@example.org",
    altcha: "proof",
    mathChallenge: { token: "signed", answer: "20" },
  };
  assert.equal(FeedbackRequestSchema.parse(feedback).title, "Subject");
  for (const body of [
    null,
    [],
    1,
    { title: 1 },
    { ...feedback, title: {} },
    { ...feedback, sendCopy: "yes" },
    { ...feedback, content: "a".repeat(5001) },
    { ...feedback, unexpected: true },
  ])
    assert.equal(FeedbackRequestSchema.safeParse(body).success, false);
  const registration = {
    firstName: "Ada",
    lastName: "Example",
    email: "person@example.org",
    ars: "08",
    municipalityName: "City",
    altcha: "proof",
    mathChallenge: { token: "signed", answer: "20" },
  };
  assert.equal(RegistrationRequestSchema.safeParse(registration).success, true);
  for (const extra of [
    { ars: "../secret" },
    { population: Infinity },
    { organisation: {} },
    { firstName: "a".repeat(201) },
    { geolocation: { type: "Point", coordinates: [200, 95] } },
  ])
    assert.equal(RegistrationRequestSchema.safeParse({ ...registration, ...extra }).success, false);
});

test("newsletter and generic forms reject malformed list IDs, nested values and excessive field counts", () => {
  assert.equal(NewsletterRequestSchema.safeParse({ email: "person@example.org", listIds: [1, 2] }).success, true);
  for (const listIds of [[1, "2"], [0], [], [Infinity], [1.2]])
    assert.equal(NewsletterRequestSchema.safeParse({ email: "person@example.org", listIds }).success, false);
  const form = {
    formUuid: "form-uuid",
    entityType: "pages",
    entityUuid: "page-uuid",
    fields: [{ name: "name", label: "Name", type: "text", required: true }],
    values: { name: "Ada" },
    altcha: "proof",
    mathChallenge: { token: "signed", answer: "20" },
  };
  assert.equal(GenericFormRequestSchema.safeParse(form).success, true);
  assert.equal(GenericFormRequestSchema.safeParse({ ...form, values: { name: { nested: true } } }).success, false);
  assert.equal(
    GenericFormRequestSchema.safeParse({ ...form, fields: Array.from({ length: 51 }, () => form.fields[0]) }).success,
    false,
  );
});

test("candidate aliases and shared answers preserve election/question ownership, exact values and null clearing", () => {
  const municipality = { id: "city", slug: "city", name: "City", state: "Berlin" };
  assert.deepEqual(
    ElectionTeamSchema.parse({ id: "team", municipality_id: [municipality] }).municipality_id,
    municipality,
  );
  const question = "22222222-2222-4222-8222-222222222222";
  const state = { electionId: "election", answers: { [question]: 0 }, doubleWeighted: [question] };
  assert.ok(checkedWahlcheckState(state, "election", [question]));
  assert.equal(checkedWahlcheckState(state, "other-election", [question]), null);
  assert.equal(checkedWahlcheckState(state, "election", []), null);
  for (const answer of [-1, 5, 1.5, "4", true, {}])
    assert.equal(checkedWahlcheckState({ ...state, answers: { [question]: answer } }, "election", [question]), null);
  assert.ok(checkedWahlcheckState({ ...state, answers: { [question]: null } }, "election", [question]));
});

test("statistics normalize decimals and relations, preserve null and strip private fields", () => {
  const municipality = {
    id: "city",
    name: "City",
    slug: "city",
    status: "published",
    localteam_id: "team",
    privateToken: "secret",
  };
  const score = {
    id: "score",
    published: true,
    percentage_rated: "100",
    score_total: null,
    score_max: "100",
    score_points: "0",
    rank: null,
    score_agriculture: null,
    score_buildings: null,
    score_energy: null,
    score_industry: null,
    score_management: null,
    score_transport: null,
    municipality,
    catalog_version: { id: "catalog", name: "v1.0" },
  };
  const result = StatisticsSchema.parse({
    catalogVersion: score.catalog_version,
    municipalities: [municipality],
    scores: [score],
    measures: [],
    ratings: [],
  });
  assert.equal(result.scores[0].score_total, null);
  assert.equal(result.scores[0].score_points, 0);
  assert.equal(result.scores[0].percentage_rated, 100);
  assert.deepEqual(result.scores[0].municipality.localteam_id, { id: "team" });
  assert.doesNotMatch(JSON.stringify(result), /secret|privateToken/);
  assert.equal(
    StatisticsSchema.safeParse({ ...result, scores: [{ ...score, score_total: "invalid" }] }).success,
    false,
  );
});

test("collection summaries retain metadata and native chart vocabulary, rejecting unsupported shapes", () => {
  const summary = SummarySchema.parse({
    aggregate: { custom_metric: 12, metadata: { effective_date: "2026-10-01", license_name: "CC BY" } },
  });
  assert.equal(summary.aggregate.metadata?.license_name, "CC BY");
  assert.equal(summary.aggregate.custom_metric, 12);
  const collection = {
    id: "data",
    title: { "de-DE": "Daten" },
    description: {},
    render_elements: [{ plot_id: "plot", type: "altair", vegalite_spec: { width: { step: 20 }, title: ["A", "B"] } }],
  };
  assert.deepEqual(
    CollectionsResponseSchema.parse({ collections: [collection] }).collections[0].render_elements?.[0].vegalite_spec
      ?.width,
    { step: 20 },
  );
  assert.equal(
    CollectionsResponseSchema.safeParse({
      collections: [{ ...collection, render_elements: [{ plot_id: "plot", type: "unsupported" }] }],
    }).success,
    false,
  );
  assert.equal(SummarySchema.safeParse({ aggregate: { metadata: "invalid" } }).success, false);
});

test("chart calculations compare common ratings and guard malformed payloads and PCA points", () => {
  const { wins, compared } = pairwiseDominance(
    [
      [0, 1, null],
      [1, 0, 0.5],
    ],
    3,
  );
  assert.equal(wins[0][1], 1);
  assert.equal(wins[1][0], 1);
  assert.equal(compared[0][2], 1);
  assert.equal(compared[1][2], 1);
  assert.equal(statisticsDatum({ datum: { sectorKey: "secret", bin_start: NaN } }), null);
  assert.equal(statisticsDatum({ datum: { sectorKey: "energy", bin_start: 0, bin_end: 5 } })?.bin_start, 0);
  assert.deepEqual(kMeans([], 2), []);
  assert.deepEqual(kMeans([{ x: Infinity, y: 0 }], 1), []);
  assert.deepEqual(
    kMeans(
      [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ],
      1,
    ),
    [0, 0],
  );
  assert.equal(
    kMeans(
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
      2,
    ).length,
    2,
  );
});

test("JSON project dates render correctly and malformed dates never render Invalid Date", () => {
  assert.equal(
    formatProjectDate("2026-10-01T12:00:00Z", "de-DE"),
    formatProjectDate(new Date("2026-10-01T12:00:00Z"), "de-DE"),
  );
  for (const value of [null, undefined, "", "invalid"]) assert.equal(formatProjectDate(value, "de-DE"), "");
});

test("search rejects filter injection before transport and strips HTML except highlight marks", async () => {
  let options: Row = {};
  let calls = 0;
  const readiness = { ready: true };
  const liveVisibility = load("server/utils/searchVisibility.ts", {
    "@directus/sdk": { readItems: (collection: string, query: Row) => ({ collection, query }) },
    "./extractContent": frontend("./server/utils/extractContent.ts"),
  });
  const route = load(
    "server/api/content-search.get.ts",
    {
      "../utils/searchVisibility": liveVisibility,
      "../utils/searchReconciliation": { searchReadiness: readiness },
      "../utils/directusServerClient": {
        createDirectusServerClient: () => ({ request: async () => [{ slug: "example", status: "published" }] }),
      },
    },
    {
      getMeilisearch: () => ({
        index: () => ({
          search: async (_q: string, opts: Row) => {
            options = opts;
            calls++;
            return {
              hits: [
                {
                  id: "article_example",
                  type: "article",
                  title: "Title",
                  url: "/projects/example",
                  _formatted: {
                    title: "<mark>Safe</mark><img src=x onerror=alert(1)>",
                    text: "<script>alert(1)</script>Text",
                  },
                },
              ],
            };
          },
        }),
      }),
    },
  ).default;
  for (const query of [
    { q: "test", types: 'article" OR id != 0' },
    { q: ["a", "b"] },
    { q: "test", limit: "-1" },
    { q: "test", types: ["article", "page"] },
  ])
    await assert.rejects(() => route({ query }), { statusCode: 400 });
  assert.equal(calls, 0);
  const result = await route({ query: { q: "test", types: "article,page", limit: "10" } });
  assert.equal(options.filter, 'type IN ["article", "page"]');
  assert.equal(result.hits[0].title, "<mark>Safe</mark>");
  assert.equal(result.hits[0].excerpt, "Text");
  readiness.ready = false;
  await assert.rejects(() => route({ query: { q: "test" } }), { statusCode: 503 });
  assert.equal(calls, 1);
});

test("news detail enforces publication and projects private metadata", async () => {
  const commands: Row[] = [];
  const client = {
    request: async (cmd: Row) => {
      commands.push(cmd);
      return [
        {
          id: "news",
          slug: "news",
          title: "News",
          status: "published",
          is_tour_redirect: false,
          image: null,
          tour_stop: null,
          report_event: null,
          access_token: "hidden",
        },
      ];
    },
  };
  const route = load("server/api/public/news/[slug].get.ts", {
    "@directus/sdk": { readItems: (collection: string, query: Row) => ({ collection, query }) },
    "../../../utils/directusServerClient": { createDirectusServerClient: () => client },
  }).default;
  const response = await route({ params: { slug: "news" } });
  assert.equal(commands[0].query.filter.status._eq, "published");
  assert.doesNotMatch(JSON.stringify(response), /hidden|access_token/);
});

test("CAPTCHA signs expiry/purpose, accepts native widget payloads and blocks replay variants", async () => {
  const used = new Set<string>();
  const { verifyAltcha } = load("server/utils/verifyAltcha.ts", {
    "./protectionRedis": {
      withProtectionRedis: async (operation: (redis: Row) => Promise<unknown>) =>
        operation({
          set: async (key: string) => {
            if (used.has(key)) return null;
            used.add(key);
            return "OK";
          },
        }),
    },
  });
  const secret = "unit-test-secret";
  const expiresAt = Date.now() + 600000;
  const salt = "0123456789abcdef01234567?expires=" + expiresAt + "&purpose=contact";
  const challenge = createHash("sha256")
    .update(salt + "7")
    .digest("hex");
  const signature = createHmac("sha256", secret).update(challenge).digest("hex");
  const proof = { algorithm: "SHA-256", challenge, signature, salt, number: 7 };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");
  assert.equal(await verifyAltcha(encode(proof), secret, { purpose: "contact" }), true);
  assert.equal(await verifyAltcha(encode(proof), secret, { purpose: "contact" }), false);
  for (const changed of [
    { algorithm: "SHA-512" },
    { algorithm: "replay" },
    { salt: salt.replace("contact", "register") },
    { salt: salt.replace(String(expiresAt), String(expiresAt + 600000)) },
    { expires_at: expiresAt + 1 },
    { purpose: "register" },
  ])
    assert.equal(await verifyAltcha(encode({ ...proof, ...changed }), secret, { purpose: "contact" }), false);
  assert.equal(await verifyAltcha(encode(proof), secret, { purpose: "register" }), false);
  assert.equal(await verifyAltcha(encode({ dev: true }), secret), false);
  assert.equal(await verifyAltcha(encode({ dev: true }), secret, { devMode: true }), false);
  assert.equal(await verifyAltcha(encode({ dev: true }), "dev-secret-change-in-production", { devMode: true }), true);
  const expiredSalt = "0123456789abcdef01234567?expires=" + (Date.now() - 1) + "&purpose=contact";
  const expiredChallenge = createHash("sha256")
    .update(expiredSalt + "7")
    .digest("hex");
  const expired = {
    ...proof,
    salt: expiredSalt,
    challenge: expiredChallenge,
    signature: createHmac("sha256", secret).update(expiredChallenge).digest("hex"),
  };
  assert.equal(
    await verifyAltcha(encode({ ...expired, expires_at: expiresAt }), secret, { purpose: "contact" }),
    false,
  );
});

test("municipality projects apply publication, municipality, sort and bounded limit at the CMS boundary", async () => {
  const commands: Row[] = [];
  const handler = load("server/api/public/articles.get.ts", {
    "@directus/sdk": { readItems: (collection: string, query: Row) => ({ collection, query }) },
    "../../utils/directusServerClient": {
      createDirectusServerClient: () => ({
        request: async (command: Row) => {
          commands.push(plain(command));
          return [];
        },
      }),
    },
  }).default;
  assert.deepEqual(plain(await handler({ query: { municipality: "City", limit: "5", sort: "-date_created" } })), {
    articles: [],
  });
  assert.deepEqual(commands[0].query.filter, { status: { _eq: "published" }, municipality_name: { _eq: "City" } });
  assert.equal(commands[0].query.limit, 5);
  assert.deepEqual(commands[0].query.sort, ["-date_created"]);
  for (const query of [{ municipality: ["City"] }, { limit: "0" }, { limit: "501" }, { sort: "secret" }])
    await assert.rejects(handler({ query }), { statusCode: 400 });
  assert.equal(commands.length, 1);
});

test("newsletter responses and PDF requests validate nested records and bound input", () => {
  const list = { id: 1, name: "News", description: null, type: "public" };
  assert.equal(NewsletterListsSchema.safeParse({ data: { results: [list] } }).success, true);
  for (const value of [null, { data: { results: {} } }, { data: { results: [{ ...list, id: "1" }] } }])
    assert.equal(NewsletterListsSchema.safeParse(value).success, false);
  assert.equal(MunicipalityPdfRequestSchema.safeParse({ catalogVersion: "v2026" }).success, true);
  assert.equal(MunicipalityPdfRequestSchema.safeParse({ catalogVersion: "v2026", slug: "city" }).success, true);
  assert.equal(MunicipalityPdfRequestSchema.safeParse({ catalogVersion: "v2026", slug: {} }).success, false);
  for (const value of [null, { catalogVersion: {} }, { catalogVersion: "../secret" }])
    assert.equal(MunicipalityPdfRequestSchema.safeParse(value).success, false);
  assert.equal(
    ElectionPdfRequestSchema.safeParse({ catalogVersion: "v2026", municipalitySlug: "city", measures: [] }).success,
    true,
  );
  for (const measures of [[{}], Array.from({ length: 101 }, () => ({})), "bad"])
    assert.equal(
      ElectionPdfRequestSchema.safeParse({ catalogVersion: "v2026", municipalitySlug: "city", measures }).success,
      false,
    );
});

test("administrative proxies reject repeated queries and malformed upstream areas without exposing arbitrary fields", async () => {
  const area = {
    ars: "08000",
    name: "City",
    prefix: "City",
    level: 6,
    geo_center: { type: "Point", coordinates: [8, 48] },
    secret: "private",
  };
  const children = load(
    "server/api/area-children.get.ts",
    {},
    { fetchStadtlandzahl: async () => ({ results: [area] }) },
  ).default;
  const result = plain(await children({ query: { level: "6", arsPrefix: "08" } }));
  assert.equal(result.length, 1);
  assert.equal("secret" in result[0], false);
  assert.equal("geoArea" in result[0], false);
  await assert.rejects(children({ query: { level: ["6"] } }), { statusCode: 400 });
  await assert.rejects(children({ query: { level: "6", arsPrefix: "08x" } }), { statusCode: 400 });
  const invalid = load(
    "server/api/area-children.get.ts",
    {},
    { fetchStadtlandzahl: async () => ({ results: [{ ...area, name: {} }] }) },
  ).default;
  assert.deepEqual(plain(await invalid({ query: { level: "6" } })), []);
  for (const route of ["area-nearby", "area-ancestors"]) {
    const handler = load(
      "server/api/" + route + ".get.ts",
      {},
      { fetchStadtlandzahl: async () => ({ areas: [], ancestors: [] }) },
    ).default;
    await assert.rejects(handler({ query: { ars: ["08"] } }), { statusCode: 400 });
    await assert.rejects(handler({ query: { ars: "../secret" } }), { statusCode: 400 });
  }
});

test("newsletter selection never permits client-requested private lists, including the configured default", async () => {
  let writes = 0;
  const handler = load(
    "server/api/newsletter-subscribe.post.ts",
    {},
    {
      useRuntimeConfig: () => ({
        listmonkEndpoint: "https://newsletter.example",
        listmonkApiUsername: "user",
        listmonkApiToken: "secret",
        listmonkListId: "2",
      }),
      readRequestBody: async (event: Row) => event.body,
      $fetch: async (url: string) => {
        if (url.endsWith("/api/lists"))
          return {
            data: {
              results: [
                { id: 1, uuid: "public-id", type: "public" },
                { id: 2, uuid: "private-id", type: "private" },
              ],
            },
          };
        writes++;
        return { data: true };
      },
    },
  ).default;
  for (const listIds of [[2], [1, 2], [3]])
    await assert.rejects(handler({ body: { email: "person@example.org", listIds } }), { statusCode: 400 });
  assert.equal(writes, 0);
  assert.equal((await handler({ body: { email: "person@example.org", listIds: [1] } })).success, true);
  assert.equal((await handler({ body: { email: "person@example.org" } })).success, true);
  assert.equal(writes, 2);
});

test("newsletter normalizes provider URLs, validates acknowledgement and hides provider failures", async () => {
  let response: unknown = { data: true };
  let defaultListId = "1";
  const requests: Row[] = [];
  const handler = load(
    "server/api/newsletter-subscribe.post.ts",
    {},
    {
      useRuntimeConfig: () => ({
        listmonkEndpoint: "https://newsletter.example/",
        listmonkApiUsername: "user",
        listmonkApiToken: "secret",
        listmonkListId: defaultListId,
      }),
      readRequestBody: async (event: Row) => event.body,
      $fetch: async (url: string, options: Row) => {
        assert.ok(!url.includes("example//"));
        assert.equal(options.timeout, 10_000);
        if (url.endsWith("/api/lists")) return { data: { results: [{ id: 1, uuid: "public-id", type: "public" }] } };
        requests.push(options);
        if (response instanceof Error) throw response;
        return response;
      },
    },
  ).default;
  const event = { body: { email: "person@example.org" } };
  assert.equal((await handler(event)).success, true);
  assert.deepEqual(plain(requests[0]!.body.list_uuids), ["public-id"]);
  assert.ok(!requests[0]!.headers.Authorization, "Public subscription never receives provider credentials");
  for (const value of [{ data: false }, {}, Object.assign(new Error("private-provider-detail"), { status: 500 })]) {
    response = value;
    await assert.rejects(
      handler(event),
      (error: Row) => error.statusCode === 502 && !error.message.includes("private-provider-detail"),
    );
  }
  response = Object.assign(new Error("already subscribed"), { status: 409 });
  assert.equal((await handler(event)).alreadySubscribed, true);
  defaultListId = "invalid";
  await assert.rejects(handler(event), { statusCode: 503 });
});

test("local-team inverse municipality relations retain their array shape and strip private records", async () => {
  const make = (municipality: unknown) =>
    load("server/api/public/localteams.get.ts", {
      "@directus/sdk": { readItems: () => ({}) },
      "../../utils/directusServerClient": {
        createDirectusServerClient: () => ({
          request: async () => [{ id: "team", municipality_id: municipality, access_token: "private" }],
        }),
      },
    }).default;
  const response = await make(["city"])({ query: {} });
  assert.deepEqual(plain(response.localteams[0].municipality_id), ["city"]);
  assert.doesNotMatch(JSON.stringify(response), /access_token|private/);
  await assert.rejects(make([{}])({ query: {} }), { statusCode: 502 });
});

test("PDF proxy accepts legacy redundant slug, rejects mismatches and never reflects upstream errors", async () => {
  let writes = 0;
  let upstreamOk = true;
  const handler = load(
    "server/api/pdf/municipality/[slug].post.ts",
    {
      "#imports": {
        useRuntimeConfig: () => ({ directusServerUrl: "https://cms.example", directusFrontendServerToken: "secret" }),
      },
    },
    {
      fetch: async () => {
        writes++;
        return {
          ok: upstreamOk,
          status: 502,
          text: async () => "private-upstream-body",
          arrayBuffer: async () => new TextEncoder().encode("%PDF").buffer,
        };
      },
      TextEncoder,
    },
  ).default;
  const response = await handler({ params: { slug: "city" }, body: { slug: "city", catalogVersion: "v2026" } });
  assert.equal(response.toString(), "%PDF");
  await assert.rejects(handler({ params: { slug: "city" }, body: { slug: "other", catalogVersion: "v2026" } }), {
    statusCode: 400,
  });
  assert.equal(writes, 1);
  upstreamOk = false;
  await assert.rejects(
    handler({ params: { slug: "city" }, body: { catalogVersion: "v2026" } }),
    (error: Error) => !error.message.includes("private-upstream-body") && error.message === "PDF generation failed",
  );
});

test("news metadata uses the authenticated editor client and checked draft reads rather than an anonymous write route", async () => {
  const commands: Row[] = [];
  let authenticated = true;
  const client = {
    request: async (command: Row) => {
      commands.push(plain(command));
      if (command.operation === "read")
        return [
          {
            id: "news",
            slug: "draft",
            title: "Draft",
            status: "draft",
            is_tour_redirect: false,
            image: null,
            tour_stop: null,
            report_event: null,
            access_token: "private",
          },
        ];
      return {};
    },
  };
  const { useNewsEditor } = load("composables/useNewsEditor.ts", {
    "@directus/sdk": {
      readItems: (collection: string, query: Row) => ({ operation: "read", collection, query }),
      createItem: (collection: string, body: Row) => ({ operation: "create", collection, body }),
      updateItem: (collection: string, id: string, body: Row) => ({ operation: "update", collection, id, body }),
    },
    "~/composables/useAuth": {
      useAuth: () => ({
        getAuthenticatedClient: () => {
          if (!authenticated) throw new Error("Not authenticated");
          return client;
        },
      }),
    },
  });
  const editor = useNewsEditor();
  const draft = await editor.detail("draft");
  assert.equal(draft.status, "draft");
  assert.equal("access_token" in draft, false);
  const metadata = { title: "Edited", teaser: null, author: null, date_published: null, status: "draft", image: null };
  await editor.save("news", metadata);
  assert.deepEqual(commands[1], { operation: "update", collection: "news_items", id: "news", body: metadata });
  authenticated = false;
  await assert.rejects(editor.save("news", metadata), /Not authenticated/);
  assert.equal(commands.length, 2);
});
