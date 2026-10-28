import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createServer } from "node:http";
import { once } from "node:events";
import ts from "typescript";
import {
  createContentTranslator,
  contentTranslationKey,
  noopContentTranslationProvider,
  prepareContentTranslations,
  planContentTranslations,
  noopContentTranslationReader,
  type ContentTranslationProvider,
  type ContentTranslationStore,
  type TranslationSegment,
} from "../../../src/frontend/server/utils/contentTranslation.js";
import {
  CONTENT_TRANSLATION_POLICIES,
  contentTranslationPolicy,
} from "../../../src/frontend/shared/contentTranslation.js";
import { parseContentSnapshots } from "./contentTranslationPlan.js";

const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
const source = (path: string) => readFileSync(new URL(`../../../src/frontend/${path}`, import.meta.url), "utf8");
const resolveFullLocaleCode = load("shared/resolveFullLocaleCode.ts", {}).default as (
  value: unknown,
) => "de-DE" | "en-GB" | "it-IT";
const policy = (path: string) => {
  const result = contentTranslationPolicy(path);
  assert.ok(result, path);
  return result;
};
const calls: TranslationSegment[][] = [];
const provider: ContentTranslationProvider = {
  namespace: "test-glossary-v1",
  enabled: true,
  async translate({ sourceLocale, targetLocale, segments }) {
    assert.equal(sourceLocale, "de-DE");
    calls.push([...segments]);
    return segments.map((segment) => `${targetLocale}:${segment.text}`);
  },
};

function memoryStore(): ContentTranslationStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    namespace: provider.namespace,
    enabled: true,
    values,
    getMany: async (keys) =>
      new Map(keys.flatMap((key) => (values.has(key) ? [[key, values.get(key)!] as const] : []))),
    setMany: async (entries) => {
      for (const [key, value] of entries) values.set(key, value);
    },
  };
}
function preparedTranslator(generationProvider: ContentTranslationProvider = provider) {
  const store = memoryStore();
  return async <T>(original: T, locale: "de-DE" | "en-GB" | "it-IT", selection: ReturnType<typeof policy>) => {
    await prepareContentTranslations(original, locale, selection, generationProvider, store);
    return createContentTranslator(store)(original, locale, selection);
  };
}

test("offline backfill plan deduplicates list/detail fields, counts both targets and Unicode without exposing source", () => {
  const data = { title: "Grüße 🌍", article_text: "**Hallo**", slug: "never-translate", author: "Private Name" };
  const snapshots = [
    { path: "/api/public/articles", data: { articles: [data, data] } },
    { path: "/api/public/articles/example", data: { article: data } },
    { path: "/api/public/pages/example", data: { page: { contents: "<p>Hallo</p>" } } },
  ];
  const before = structuredClone(snapshots);
  const report = planContentTranslations(snapshots);
  assert.deepEqual(report, {
    sourceLocale: "de-DE",
    targetLocales: ["en-GB", "it-IT"],
    snapshotCount: 3,
    uniqueFieldsPerTarget: 3,
    sourceCodePointsPerTarget: 28,
    sourceCodePointsBothTargets: 56,
    formats: {
      text: { uniqueFields: 1, occurrences: 3, sourceCodePoints: 7 },
      html: { uniqueFields: 1, occurrences: 1, sourceCodePoints: 12 },
      markdown: { uniqueFields: 1, occurrences: 3, sourceCodePoints: 9 },
    },
  });
  assert.deepEqual(snapshots, before);
  assert.doesNotMatch(JSON.stringify(report), /Grüße|Hallo|Private Name|never-translate|content-translation:v1/);
  assert.equal(planContentTranslations([]).sourceCodePointsBothTargets, 0);
  assert.throws(() => planContentTranslations([{ path: "/api/editor/cms", data: {} }]));
  assert.throws(() => planContentTranslations(Array.from({ length: 1001 }, () => snapshots[0]!)));
  for (const value of [null, {}, [null], [{ path: "/api/public/articles" }]])
    assert.throws(() => parseContentSnapshots(value));
});

test("offline planning CLI reports counts and rejects malformed input without echoing its contents", () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-translation-plan-"));
  const input = join(directory, "snapshots.json");
  const run = () =>
    spawnSync(
      process.execPath,
      [
        "--import",
        import.meta.resolve("tsx"),
        fileURLToPath(new URL("./contentTranslationPlan.ts", import.meta.url)),
        input,
      ],
      { encoding: "utf8" },
    );
  try {
    writeFileSync(input, JSON.stringify([{ path: "/api/public/articles", data: { articles: [{ title: "Hallo" }] } }]));
    const valid = run();
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).sourceCodePointsBothTargets, 10);
    assert.doesNotMatch(valid.stdout + valid.stderr, /Hallo/);
    writeFileSync(input, "PRIVATE malformed source");
    const invalid = run();
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, "");
    assert.match(invalid.stderr, /Cannot assess snapshots/);
    assert.doesNotMatch(invalid.stderr, /PRIVATE/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("no-op and German preserve exact source identity without store/provider work", async () => {
  const original = { article: { title: "Überschrift", article_text: "**Inhalt**", abstract: null } };
  const forbidden = () => {
    throw new Error("Should not run");
  };
  const reader = { ...noopContentTranslationReader, getMany: forbidden };
  const noop = createContentTranslator(reader);
  for (const locale of ["de-DE", "en-GB", "it-IT"] as const) {
    assert.equal((await noop(original, locale, policy("/api/public/articles/a"))).data, original);
  }
  assert.equal(
    (await createContentTranslator({ ...reader, enabled: true })(original, "de-DE", policy("/api/public/articles/a")))
      .data,
    original,
  );
  assert.deepEqual(
    await noopContentTranslationProvider.translate({
      sourceLocale: "de-DE",
      targetLocale: "it-IT",
      segments: [{ text: "Grüße", format: "text", context: "title" }],
      signal: new AbortController().signal,
    }),
    ["Grüße"],
  );
  assert.deepEqual(
    await prepareContentTranslations(
      original,
      "en-GB",
      policy("/api/public/articles/a"),
      noopContentTranslationProvider,
      { ...memoryStore(), getMany: forbidden },
    ),
    { translated: 0, reused: 0 },
  );
});

test("English/Italian translate only selected display fields, retain DTO shape and do not mutate German sources", async () => {
  const original = {
    article: {
      id: "id",
      slug: "slug",
      title: "Titel",
      subtitle: "",
      abstract: null,
      article_text: "**Text** [Link](https://example.org)",
      author: "Erika Muster",
      image_credits: "© Name",
      organisation: { name: "Organisation", link: "https://example.org" },
      measures: [{ measures_id: { id: "measure", name: "Maßnahme", slug: "massnahme" } }],
    },
  };
  for (const locale of ["en-GB", "it-IT"] as const) {
    const result = await preparedTranslator(provider)(original, locale, policy("/api/public/articles/slug"));
    assert.equal(result.degraded, false);
    assert.equal(result.data.article.title, `${locale}:Titel`);
    assert.equal(result.data.article.measures[0]?.measures_id.name, `${locale}:Maßnahme`);
    assert.equal(result.data.article.slug, "slug");
    assert.deepEqual(result.data.article.organisation, original.article.organisation);
    assert.equal(result.data.article.author, "Erika Muster");
    assert.equal(result.data.article.abstract, null);
    assert.equal(result.data.article.subtitle, "");
    assert.equal(original.article.title, "Titel");
    assert.ok(calls.at(-1)?.some((segment) => segment.format === "markdown"));
  }
});

test("nested block props and display options translate while source specifications and form values stay intact", async () => {
  const original: Record<string, any> = {
    blocks: [
      {
        uuid: "parent",
        bundle: "container",
        props: {
          blocks: [
            { uuid: "text", bundle: "text", props: { content: "<p>Hallo</p>" }, options: {} },
            { uuid: "richtext", bundle: "richtext", props: { content: "**Hallo**" }, options: {} },
            {
              uuid: "image",
              bundle: "image",
              props: { imageId: "asset-id", alt: "Ein Bild", caption: "Unterschrift" },
              options: { link: "/ziel" },
            },
            { uuid: "chart", bundle: "vega_chart", props: { spec: "{}", query: "{}" } },
            {
              uuid: "form",
              bundle: "form_field",
              props: { label: [{ uuid: "label", bundle: "form_label", props: { text: "Name" } }] },
              options: { placeholder: "Dein Name", choices: "Ja\nNein", fieldName: "name" },
            },
            {
              uuid: "nav",
              bundle: "page_nav",
              props: {},
              options: { items: '[{"label":"Zur Seite","href":"/seite"}]' },
            },
          ],
        },
        options: { layout: "grid" },
      },
    ],
  };
  const result = await preparedTranslator(provider)(original, "it-IT", policy("/api/public/blocks"));
  const children = result.data.blocks[0]!.props.blocks;
  assert.equal(children[0]?.props.content, "it-IT:<p>Hallo</p>");
  assert.equal(children[1]?.props.content, "it-IT:**Hallo**");
  assert.equal(children[2]?.props.imageId, "asset-id");
  assert.equal(children[2]?.options?.link, "/ziel");
  assert.deepEqual(children[3]?.props, { spec: "{}", query: "{}" });
  assert.equal(children[4]?.options?.choices, "Ja\nNein");
  assert.equal(children[4]?.options?.placeholder, "it-IT:Dein Name");
  assert.equal(children[4]?.props.label?.[0]?.props.text, "it-IT:Name");
  assert.deepEqual(JSON.parse(children[5]?.options?.items ?? "null"), [{ label: "it-IT:Zur Seite", href: "/seite" }]);
  assert.equal(original.blocks[0]?.props.blocks[0]?.props.content, "<p>Hallo</p>");
  const missingNavigation = {
    blocks: [{ bundle: "page_nav", options: { items: '[ { "label": "Unübersetzt", "href": "/ziel" } ]' } }],
  };
  const untranslated = await createContentTranslator(memoryStore())(
    missingNavigation,
    "en-GB",
    policy("/api/public/blocks"),
  );
  assert.deepEqual(untranslated.data, missingNavigation);
  assert.equal(untranslated.pending, true);
  const segments = calls.at(-1)!;
  assert.equal(segments.find((segment) => segment.context === "block.richtext.content")?.format, "markdown");
});

test("navigation respects translation keys and recursively translates fallback labels without changing destinations", async () => {
  const original = {
    pages: [],
    navigationConfig: {
      header_items: [
        {
          label: "Über uns",
          external_url: "https://example.org",
          children: [{ label: "Kontakt", page_slug: "kontakt" }],
          links: [{ title: "Mitmachen", slug: "mitmachen" }],
        },
        { label: "Unchanged", translation_key: "contact.title" },
      ],
      footer_columns: [],
    },
  };
  const result = await preparedTranslator(provider)(original, "en-GB", policy("/api/public/site-layout"));
  assert.equal(result.data.navigationConfig.header_items[0]?.label, "en-GB:Über uns");
  assert.equal(result.data.navigationConfig.header_items[0]?.children?.[0]?.label, "en-GB:Kontakt");
  assert.equal(result.data.navigationConfig.header_items[0]?.children?.[0]?.page_slug, "kontakt");
  assert.equal(result.data.navigationConfig.header_items[1]?.label, "Unchanged");
});

test("all registered public response families select their actual DTO shape", async () => {
  const fixtures: Record<string, unknown> = {
    "/api/public/pages/slug": { page: { name: "Text", contents: "Text" } },
    "/api/public/blocks": { blocks: [{ bundle: "heading", props: { text: "Text" } }] },
    "/api/public/site-layout": { pages: [{ name: "Text" }] },
    "/api/public/articles": { articles: [{ title: "Text" }] },
    "/api/public/articles/slug": { article: { title: "Text" } },
    "/api/public/climate-tools": { tools: [{ description: "Text" }] },
    "/api/public/jobs": { jobs: [{ role_title: "Text" }] },
    "/api/public/jobs/slug": { job: { tasks: "Text" } },
    "/api/public/events": { events: [{ title: "Text" }] },
    "/api/public/events/slug": { eventProjects: [{ title: "Text" }] },
    "/api/public/event-series/slug": { series: { introduction: "Text" }, events: [{ description: "Text" }] },
    "/api/public/news": { news: [{ teaser: "Text" }], visitReports: [{ report_title: "Text" }] },
    "/api/public/news/slug": { item: { title: "Text" } },
    "/api/public/measures": { measures: [{ name: "Text" }] },
    "/api/public/measures/slug": { measure: { description: "Text" } },
    "/api/public/stats/2026": { measures: [{ name: "Text" }] },
    "/api/public/municipalities/slug": {
      directusData: { ratingsBySector: { energy: [{ current_progress: "Text", measure: { name: "Text" } }] } },
    },
    "/api/public/ratings": { ratings: [{ measure_id: { name: "Text" }, measure: { name: "Text" } }] },
    "/api/public/organisation-teams": [{ label: "Text", tasks: ["Text"] }],
    "/api/org-members": [{ bio: "Text" }],
    "/api/public/data-page-config": { config: { under_construction_explanation: "Text" } },
    "/api/public/tours": { tours: [{ title: "Text" }] },
    "/api/public/tours/slug": { tour: { introduction: "Text" }, stops: [{ visit_details: "Text" }] },
    "/api/public/tour-detail": { series: { title: "Text" } },
    "/api/public/tour-stops-by-tour": { stops: [{ teaser: "Text" }] },
    "/api/public/tour-stop-articles": [{ articles_id: { title: "Text" } }],
    "/api/public/projects-tours": { series: [{ title: "Text" }] },
    "/api/public/article-tour-visits": {
      visits: [{ stop: { title: "Text", tour: { title: "Text" } }, tour: { title: "Text" } }],
    },
    "/api/public/wahlcheck": [{ descriptor: "Text" }],
    "/api/public/wahlcheck/slug": {
      questions: [{ thesis: "Text" }],
      candidates: [{ answers: [{ explanation: "Text" }] }],
    },
    "/api/public/elections": { elections: [{ descriptor: "Text" }] },
    "/api/content-search": { hits: [{ excerpt: "Text" }] },
  };
  assert.equal(Object.keys(fixtures).length, Object.keys(CONTENT_TRANSLATION_POLICIES).length);
  for (const [path, fixture] of Object.entries(fixtures)) {
    const result = await preparedTranslator(provider)(fixture, "en-GB", policy(path));
    assert.equal(result.degraded, false, path);
    assert.notDeepEqual(result.data, fixture, path);
  }
});

test("background preparation persists only changed fields; requests cannot trigger generation", async () => {
  const store = memoryStore();
  const data = { tools: [{ title: "Titel", description: "Beschreibung" }, { title: "Titel" }] };
  const selection = policy("/api/public/climate-tools");
  let count = 0;
  const generationProvider = {
    ...provider,
    translate: async (request: Parameters<ContentTranslationProvider["translate"]>[0]) => {
      count++;
      return provider.translate(request);
    },
  };
  assert.deepEqual(await prepareContentTranslations(data, "en-GB", selection, generationProvider, store), {
    translated: 2,
    reused: 0,
  });
  assert.deepEqual(await prepareContentTranslations(data, "en-GB", selection, generationProvider, store), {
    translated: 0,
    reused: 2,
  });
  assert.equal(count, 1);
  // List/detail envelopes share the same field context and prepared memory.
  assert.deepEqual(
    await prepareContentTranslations(
      { article: { title: "Titel" } },
      "en-GB",
      policy("/api/public/articles/slug"),
      generationProvider,
      store,
    ),
    { translated: 0, reused: 1 },
  );
  assert.equal(count, 1);
  const edited = { tools: [{ title: "Titel mit Tippfehlerkorrektur", description: "Beschreibung" }] };
  assert.deepEqual(await prepareContentTranslations(edited, "en-GB", selection, generationProvider, store), {
    translated: 1,
    reused: 1,
  });
  assert.equal(calls.at(-1)?.length, 1);
  const read = createContentTranslator(store);
  for (let i = 0; i < 5; i++) assert.equal((await read(edited, "en-GB", selection)).pending, false);
  assert.equal(count, 2);
  const italian = await read(edited, "it-IT", selection);
  assert.equal(italian.pending, true);
  assert.deepEqual(italian.data, edited);
  assert.equal(count, 2, "page misses must never generate a translation");
  const stale = await read({ tools: [{ title: "Neue Version", description: "Beschreibung" }] }, "en-GB", selection);
  assert.equal(stale.data.tools[0]?.title, "Neue Version");
  assert.equal(stale.data.tools[0]?.description, "en-GB:Beschreibung");
  assert.equal(stale.pending, true);
  const segment: TranslationSegment = { text: "Titel", format: "text", context: "title" };
  const key = contentTranslationKey("v1", "en-GB", segment);
  assert.notEqual(key, contentTranslationKey("v2", "en-GB", segment));
  assert.notEqual(key, contentTranslationKey("v1", "it-IT", segment));
  assert.notEqual(key, contentTranslationKey("v1", "en-GB", { ...segment, format: "html" }));
  assert.doesNotMatch(key, /Titel/);
});

test("background failures never persist partial output; lookup errors, invalid stored values and timeouts fall back safely", async () => {
  const original = { page: { name: "Titel", contents: null } };
  const selection = policy("/api/public/pages/slug");
  const scenarios: ContentTranslationProvider["translate"][] = [
    async () => {
      throw new Error("secret provider response");
    },
    async () => [],
    async () => [null],
    async () => [""],
  ];
  for (const translate of scenarios) {
    const store = memoryStore();
    await assert.rejects(() =>
      prepareContentTranslations(original, "it-IT", selection, { ...provider, translate }, store),
    );
    assert.equal(store.values.size, 0);
  }
  const store = memoryStore();
  await assert.rejects(() =>
    prepareContentTranslations(
      original,
      "it-IT",
      selection,
      {
        ...provider,
        translate: ({ signal }) =>
          new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
      },
      store,
      10,
    ),
  );
  const readers = [
    {
      ...store,
      getMany: async () => {
        throw new Error("Database offline");
      },
    },
    { ...store, getMany: async (keys: readonly string[]) => new Map([[keys[0]!, ""]]) },
    {
      ...store,
      getMany: async (_keys: readonly string[], signal: AbortSignal) =>
        new Promise<ReadonlyMap<string, string>>((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    },
  ];
  for (const reader of readers) {
    const result = await createContentTranslator(reader, 10)(original, "it-IT", selection);
    assert.equal(result.data, original);
    assert.equal(result.degraded, true);
  }
  assert.equal(original.page.name, "Titel");
});

function load(path: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}): any {
  const module = { exports: {} };
  const compiled = ts.transpileModule(source(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: false },
  });
  runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    ...globals,
    require: (id: string) => {
      assert.ok(id in dependencies, `${path}: ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("typed frontend fetch captures SSR/client locale, preserves query/options and excludes external/private requests", () => {
  for (const locale of ["de-DE", "en-GB", "it-IT"]) {
    let hook: any;
    const { useContentFetch } = load(
      "composables/useContentFetch.ts",
      {
        "#app": { useNuxtApp: () => ({ $locale: locale }) },
        "~/shared/contentTranslation": { CONTENT_LOCALE_QUERY: "contentLocale", contentTranslationPolicy },
      },
      {
        $fetch: {
          create: (options: any) => {
            hook = options.onRequest;
            return "fetch-instance";
          },
        },
      },
    );
    assert.equal(useContentFetch(), "fetch-instance");
    const options = { query: { v: "2026", contentLocale: "de-DE" }, headers: { custom: "value" }, timeout: 500 };
    hook({ request: "/api/public/articles?limit=5", options });
    assert.equal(options.query.contentLocale, locale);
    assert.equal(options.query.v, "2026");
    assert.equal(options.timeout, 500);
    assert.equal(options.headers.custom, "value");
    for (const path of [
      "https://example.org/api/public/articles",
      "/api/editor/cms",
      "/api/candidate/session",
      "/api/previews/municipality/a",
      "/api/public/translations",
    ]) {
      const privateOptions = { query: { v: "2026" } };
      hook({ request: path, options: privateOptions });
      assert.deepEqual(privateOptions, { query: { v: "2026" } });
      assert.equal(contentTranslationPolicy(path), undefined);
    }
  }
  assert.equal(resolveFullLocaleCode(["it-IT", "en-GB"]), "de-DE");
  assert.equal(resolveFullLocaleCode("unsupported"), "de-DE");
});

test("actual H3 response hook translates objects before serialization, isolates language URLs and marks fallback no-store", async () => {
  const h3 = frontend("h3");
  let beforeResponse: any;
  let unavailable = false;
  const store = memoryStore();
  const original = { page: { name: "Titel", contents: null } };
  for (const locale of ["en-GB", "it-IT"] as const)
    await prepareContentTranslations(original, locale, policy("/api/public/pages/slug"), provider, store);
  const preparedCalls = calls.length;
  const reader = {
    ...store,
    getMany: async (keys: readonly string[], signal: AbortSignal) => {
      if (unavailable) throw new Error("Unavailable");
      return store.getMany(keys, signal);
    },
  };
  const diagnostics: string[] = [];
  const plugin = load(
    "server/plugins/content-translation.ts",
    {
      h3,
      "~/shared/contentTranslation": { contentTranslationPolicy },
      "~/shared/resolveFullLocaleCode": { default: resolveFullLocaleCode },
      "../utils/contentTranslation": { translatePublicContent: createContentTranslator(reader) },
      "../utils/securityLogging": {
        requestLog: (_event: unknown, _level: unknown, action: string) => diagnostics.push(action),
      },
    },
    { defineNitroPlugin: (fn: unknown) => fn },
  );
  plugin.default({
    hooks: {
      hook: (name: string, fn: unknown) => {
        assert.equal(name, "beforeResponse");
        beforeResponse = fn;
      },
    },
  });
  const app = h3.createApp({
    onBeforeResponse: (event: unknown, response: unknown) => beforeResponse(event, response),
  });
  app.use(
    h3.defineEventHandler((event: any) => {
      h3.setResponseHeader(event, "Cache-Control", "public, max-age=60");
      return { page: { name: "Titel", contents: null } };
    }),
  );
  const server = createServer(h3.toNodeListener(app));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const [query, expected] of [
      ["", "Titel"],
      ["?contentLocale=en-GB", "en-GB:Titel"],
      ["?contentLocale=it-IT", "it-IT:Titel"],
      ["?contentLocale=no", "Titel"],
    ]) {
      const response = await fetch(`${base}/api/public/pages/slug${query}`, {
        headers: { cookie: "slk_locale=it-IT", "accept-language": "it-IT" },
      });
      assert.equal(((await response.json()) as any).page.name, expected);
    }
    assert.equal(calls.length, preparedCalls, "HTTP requests may only read stored values");
    unavailable = true;
    const fallback = await fetch(`${base}/api/public/pages/slug?contentLocale=en-GB`);
    assert.equal(((await fallback.json()) as any).page.name, "Titel");
    assert.equal(fallback.headers.get("cache-control"), "no-store");
    assert.deepEqual(diagnostics, ["content.translation.degraded"]);
    const privateResponse = await fetch(`${base}/api/candidate/session?contentLocale=en-GB`);
    assert.equal(((await privateResponse.json()) as any).page.name, "Titel");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("all CMS page/component/composable fetch sites use the shared helper and editor writes retain source transport", () => {
  const walk = (path: string): string[] =>
    readdirSync(new URL(`../../../src/frontend/${path}`, import.meta.url), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(`${path}/${entry.name}`) : [`${path}/${entry.name}`],
    );
  for (const path of ["pages", "components", "layouts", "composables"]
    .flatMap(walk)
    .filter((path) => /\.(vue|ts)$/.test(path))) {
    const code = source(path);
    for (const match of code.matchAll(/\$fetch(?:<[^\n]+>)?\(["'`](\/api\/[^"'`]+)["'`]/g)) {
      assert.equal(contentTranslationPolicy(match[1]!.replace(/\$\{.*?\}/g, "slug")), undefined, path);
    }
    if (code.includes("fetchContent(")) assert.match(code, /useContentFetch\(\)/, path);
  }
  assert.doesNotMatch(source("composables/useNewsEditor.ts"), /useContentFetch/);
  assert.doesNotMatch(source("app/blokkli.editAdapter.ts"), /useContentFetch/);
  assert.doesNotMatch(source("pages/elections/thesen/[[access_token]].vue"), /useContentFetch/);
});
