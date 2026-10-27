import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fromMarkdown } from "../../../src/frontend/node_modules/mdast-util-from-markdown/index.js";
import { prepareTranslationDocument } from "../../../src/frontend/server/utils/contentTranslationFormat.js";
import {
  createDeepLTranslator,
  deepLBatch,
  deepLNamespace,
  DeepLTranslationError,
  DeepLSettingsSchema,
  type DeepLOptions,
} from "../../../src/frontend/server/utils/deepLTranslation.js";
import { runContentTranslationWorker } from "../../../src/frontend/server/utils/contentTranslationWorker.js";
import { createContentTranslator } from "../../../src/frontend/server/utils/contentTranslation.js";
import { contentTranslationPolicy } from "../../../src/frontend/shared/contentTranslation.js";
import { collectPublicTranslationSnapshots } from "../../../src/frontend/server/utils/contentTranslationSources.js";
import type {
  PreparedTranslationRow,
  TranslationPersistence,
} from "../../../src/frontend/server/utils/contentTranslationPersistence.js";
import type { TranslationOperation } from "../../../src/frontend/shared/contentTranslationProtocol.js";

const require = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
const { parseDocument, DomUtils } =
  require("htmlparser2") as typeof import("../../../src/frontend/node_modules/htmlparser2/dist/index.js");
const options: DeepLOptions = { apiKey: "fixture-key-never-real" };

test("format preparation sends only text leaves, preserves HTML destinations/code/placeholders and escapes provider markup", () => {
  const source =
    '<div title="Hinweis"><p>Hallo <strong>Welt</strong> [[[ONBOARDING_BOX]]] {{name}} :name https://example.org/a?x=1&amp;y=2</p><a href="https://example.org/a?x=1&amp;y=2" data-id="stable">Mehr erfahren</a><img src="/asset" alt="Ein Bild"><pre>CODE unverändert</pre><span translate="no">Name bleibt</span><script>unsafeSource()</script></div>';
  const document = prepareTranslationDocument({ text: source, format: "html", context: "contents" });
  assert.deepEqual([...document.texts].sort(), ["Ein Bild", "Hallo", "Hinweis", "Mehr erfahren", "Welt"].sort());
  const result = document.render((text) => `EN ${text}`)!;
  assert.match(result, /\[\[\[ONBOARDING_BOX\]\]\] \{\{name\}\} :name/);
  assert.match(result, /<pre>CODE unverändert<\/pre>/);
  assert.match(result, /<span translate="no">Name bleibt<\/span>/);
  assert.match(result, /<script>unsafeSource\(\)<\/script>/);
  const tree = parseDocument(result);
  const anchor = DomUtils.getElementsByTagName("a", tree)[0]!;
  assert.equal(anchor.attribs.href, "https://example.org/a?x=1&y=2");
  assert.equal(anchor.attribs["data-id"], "stable");
  const escaped = document.render((text) => `<img src=x onerror=alert(1)> ${text}`)!;
  assert.equal(
    DomUtils.getElementsByTagName("img", parseDocument(escaped)).length,
    1,
    "Provider tags stay text; only the original image remains",
  );
  assert.equal(
    document.render(() => undefined),
    undefined,
  );
  assert.throws(() => document.render(() => "[[[INJECTED]]]"));
  const technical = prepareTranslationDocument({
    text: '<code>const source = "Hallo"</code>',
    format: "html",
    context: "contents",
  });
  assert.deepEqual(technical.texts, []);
  assert.equal(
    technical.render(() => {
      throw new Error("Must not translate code");
    }),
    '<code>const source = "Hallo"</code>',
  );
});

test("Markdown AST reconstruction preserves GFM tables, links, code, reference IDs and application placeholders", () => {
  const source =
    '# Hallo\n\n[Mehr erfahren](https://example.org/page?x=1&y=2 "Hinweis")\n\n[[[ONBOARDING_BOX]]]\n\n`code bleibt`\n\n```js\nconst value = "unverändert";\n```\n\n| Name | Wert |\n| --- | --- |\n| Klima | Gut |\n\n![Ein Bild](/asset "Bildtitel")\n';
  const document = prepareTranslationDocument({ text: source, format: "markdown", context: "article_text" });
  assert(!document.texts.some((text) => /example|ONBOARDING|const value|code bleibt|\/asset/.test(text)));
  const result = document.render((text) => `EN ${text}`)!;
  assert.match(result, /\[\[\[ONBOARDING_BOX\]\]\]/);
  assert.match(result, /`code bleibt`/);
  assert.match(result, /const value = "unverändert";/);
  const destinations = (node: unknown): string[] => {
    if (!node || typeof node !== "object") return [];
    const row = node as { url?: unknown; children?: unknown[] };
    return [...(typeof row.url === "string" ? [row.url] : []), ...(row.children ?? []).flatMap(destinations)];
  };
  assert.deepEqual(
    destinations(fromMarkdown(result)),
    destinations(fromMarkdown(source)),
    "Escaped Markdown destinations retain identical decoded URLs",
  );
  assert.match(result, /\| EN Name\s+\| EN Wert/);
  assert.match(result, /!\[EN Ein Bild\]\(\/asset "EN Bildtitel"\)/);
  const injected = document.render(() => "<script>alert(1)</script> **injected**")!;
  const parsed = fromMarkdown(injected);
  assert(!JSON.stringify(parsed).includes('"type":"html"'), "Provider cannot add raw HTML nodes");
});

test("DeepL maps fixed languages, checks quota, bounds code points/UTF-8 batches and keeps credentials out of namespaces/errors", async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(
      String(url).endsWith("/usage")
        ? { character_count: 400, character_limit: 1000 }
        : { translations: [{ text: "Hello 🌍", billed_characters: 7 }] },
    );
  };
  const provider = createDeepLTranslator({ ...options, apiKey: "fixture-free-key:fx" }, fetcher);
  assert.equal(await provider.remaining(new AbortController().signal), 600);
  assert.deepEqual(await provider.translate("en-GB", ["Hallo 🌍"], new AbortController().signal), [
    { text: "Hello 🌍", billed: 7 },
  ]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]!.url, "https://api-free.deepl.com/v2/translate");
  const payload = JSON.parse(String(calls[1]!.init!.body));
  assert.equal(payload.source_lang, "DE");
  assert.equal(payload.target_lang, "EN-GB");
  assert.equal(payload.show_billed_characters, true);
  assert.equal(calls[1]!.init!.redirect, "error");
  assert.equal(
    provider.namespace,
    createDeepLTranslator(options, fetcher).namespace,
    "Key/account changes reuse purchased translations",
  );
  assert.doesNotMatch(provider.namespace, /fixture/);
  const limited = createDeepLTranslator(options, async () =>
    Response.json({
      character_count: 400,
      character_limit: 1000,
      api_key_character_count: 90,
      api_key_character_limit: 100,
    }),
  );
  assert.equal(await limited.remaining(new AbortController().signal), 10, "Respect the smaller API-key quota");
  const batch = deepLBatch(
    options,
    "it-IT",
    Array.from({ length: 20 }, () => "🌍".repeat(2000)),
  );
  assert.equal(batch.texts.length, 5);
  assert.equal(batch.characters, 10_000);
  assert.equal(batch.body.target_lang, "IT");
  assert(Buffer.byteLength(JSON.stringify(batch.body)) < 128 * 1024);
  assert.throws(() => deepLBatch(options, "de-DE", ["Hallo"]));
  assert.throws(() => createDeepLTranslator({ apiKey: "" }));
  for (const [status, code] of [
    [429, "rate"],
    [456, "quota"],
    [403, "auth"],
    [500, "uncertain"],
  ] as const) {
    let count = 0;
    const failed = createDeepLTranslator(options, async () => {
      count++;
      return new Response("PRIVATE PROVIDER MESSAGE", { status });
    });
    await assert.rejects(
      () => failed.translate("it-IT", ["Hallo"], new AbortController().signal),
      (error: unknown) =>
        error instanceof DeepLTranslationError && error.code === code && !error.message.includes("PRIVATE"),
    );
    assert.equal(count, 1, "No implicit paid retries");
  }
});

test("malformed, missing and oversized DeepL responses are uncertain rather than retried", async () => {
  for (const body of [
    { translations: [] },
    { translations: [{ text: "" }] },
    { translations: [{ text: "a" }, { text: "b" }] },
  ]) {
    let count = 0;
    const provider = createDeepLTranslator(options, async () => {
      count++;
      return Response.json(body);
    });
    await assert.rejects(
      () => provider.translate("en-GB", ["Hallo"], new AbortController().signal),
      (error: unknown) => error instanceof DeepLTranslationError && error.code === "uncertain",
    );
    assert.equal(count, 1);
  }
});

function harness(sourceData: { pages?: { name: string; contents: string }[]; tools?: { title: string }[] }) {
  const namespace = deepLNamespace(options);
  const rows = new Map<string, PreparedTranslationRow>();
  const reservations = new Map<string, { key: string; locale: "en-GB" | "it-IT" }[]>();
  const operations: TranslationOperation[] = [];
  const generations: { locale: string; texts: string[] }[] = [];
  let fail: "uncertain" | undefined;
  let remaining = 1_000_000;
  const persistence: TranslationPersistence = {
    namespace,
    load: async (keys) => new Map(keys.flatMap((key) => (rows.has(key) ? [[key, rows.get(key)!]] : []))),
    operation: async (operation) => {
      operations.push(operation);
      if (operation.op === "claim") return { lease: { owner: operation.owner, revision: 1 } };
      if (operation.op === "reserve") {
        reservations.set(operation.batch, operation.units);
        for (const unit of operation.units)
          rows.set(unit.key, {
            id: unit.key,
            namespace,
            kind: "unit",
            locale: unit.locale,
            format: "text",
            state: "inflight",
            translated_text: null,
            retry_at: null,
          });
        return { reserved: true };
      }
      if (operation.op === "commit") {
        for (const unit of operation.units)
          rows.set(unit.key, { ...rows.get(unit.key)!, state: "ready", translated_text: unit.text });
        for (const field of operation.fields)
          rows.set(field.key, {
            id: field.key,
            namespace,
            kind: "field",
            locale: field.locale,
            format: field.format,
            state: "ready",
            translated_text: field.text,
            retry_at: null,
          });
        return { committed: true };
      }
      if (operation.op === "failed-batch") {
        for (const unit of reservations.get(operation.batch) ?? [])
          rows.set(unit.key, {
            ...rows.get(unit.key)!,
            state: operation.code === "uncertain" ? "uncertain" : "pending",
          });
      }
      return {};
    },
  };
  const provider: ReturnType<typeof createDeepLTranslator> = {
    namespace,
    remaining: async () => remaining,
    translate: async (locale, texts) => {
      generations.push({ locale, texts: [...texts] });
      assert(operations.at(-1)?.op === "reserve", "Reserve must commit before any paid call");
      if (fail) throw new DeepLTranslationError(fail);
      return texts.map((text) => ({ text: `${locale}|${text}`, billed: Array.from(text).length }));
    },
  };
  const source = {
    records: async () => [],
    fetch: async (path: string) =>
      path === "/api/public/site-layout"
        ? { pages: sourceData.pages ?? [] }
        : path === "/api/public/climate-tools"
          ? { tools: sourceData.tools ?? [] }
          : {},
  };
  return {
    rows,
    operations,
    generations,
    persistence,
    source,
    provider,
    setFail: (value: typeof fail) => {
      fail = value;
    },
    setRemaining: (value: number) => {
      remaining = value;
    },
    run: () =>
      runContentTranslationWorker({
        persistence,
        provider,
        providerOptions: options,
        source,
        signal: new AbortController().signal,
      }),
  };
}

test("worker deduplicates text across fields and both locales, persists results, and regenerates only a changed paragraph", async () => {
  const data = {
    pages: [{ name: "Gemeinsam handeln", contents: "<p>Erster Absatz.</p><p>Zweiter Absatz.</p>" }],
    tools: [{ title: "Gemeinsam handeln" }],
  };
  const original = structuredClone(data);
  const fixture = harness(data);
  assert.equal(
    (await fixture.run()).generated,
    6,
    "One heading plus two paragraphs per language, shared across fields",
  );
  assert.deepEqual(data, original);
  const requests = fixture.generations.length;
  assert.equal((await fixture.run()).generated, 0);
  assert.equal(fixture.generations.length, requests);
  data.pages[0]!.contents = "<p>Korrigierter Absatz.</p><p>Zweiter Absatz.</p>";
  assert.equal((await fixture.run()).generated, 2);
  assert.deepEqual(
    fixture.generations.slice(requests).map((call) => call.texts),
    [["Korrigierter Absatz."], ["Korrigierter Absatz."]],
  );
  data.pages[0]!.contents = '<div class="changed">Korrigierter Absatz.</div><p>Zweiter Absatz.</p>';
  assert.equal((await fixture.run()).generated, 0, "Markup changes reuse all purchased text units");
  const read = createContentTranslator({
    namespace: fixture.persistence.namespace,
    enabled: true,
    getMany: async (keys) =>
      new Map(
        keys.flatMap((key) => {
          const row = fixture.rows.get(key);
          return row?.kind === "field" && row.state === "ready" && row.translated_text
            ? [[key, row.translated_text]]
            : [];
        }),
      ),
  });
  const result = await read(
    { page: { name: data.pages[0]!.name, contents: data.pages[0]!.contents } },
    "en-GB",
    contentTranslationPolicy("/api/public/pages/example")!,
  );
  assert.equal(result.pending, false);
  assert.match(result.data.page.contents, /en-GB\|Korrigierter Absatz/);
  assert.match(result.data.page.contents, /en-GB\|Zweiter Absatz/);
});

test("uncertain paid calls are quarantined and page reads or later sweeps never rebill those units", async () => {
  const fixture = harness({ tools: [{ title: "Hallo" }] });
  fixture.setFail("uncertain");
  await fixture.run();
  await fixture.run();
  const attempts = fixture.generations.length;
  assert.equal(attempts, 2, "At most one uncertain attempt per language");
  fixture.setFail(undefined);
  const result = await fixture.run();
  assert.equal(result.generated, 0);
  assert.equal(result.attention, true);
  assert.equal(fixture.generations.length, attempts);
  assert([...fixture.rows.values()].every((row) => row.state === "uncertain"));
});

test("provider quota is checked before reservation and a missing quota never makes a paid call", async () => {
  const fixture = harness({ tools: [{ title: "Hallo" }] });
  fixture.setRemaining(0);
  await fixture.run();
  assert.equal(fixture.generations.length, 0);
  assert(!fixture.operations.some((operation) => operation.op === "reserve"));
  assert.equal(fixture.operations.at(-1)?.op, "finish");
  assert(fixture.operations.some((operation) => operation.op === "finish" && operation.error === "budget"));
});

test("source enumeration uses published identities and rechecks every body through a registered public route", async () => {
  const paths: string[] = [];
  const snapshots = [];
  for await (const snapshot of collectPublicTranslationSnapshots({
    records: async (collection, fields, filter) => {
      assert(fields.length > 0);
      assert(!fields.includes("*"));
      if (collection === "pages") {
        assert.deepEqual(filter, { status: { _eq: "published" } });
        return [
          { id: "published-id", slug: "public", status: "published" },
          { id: "draft-id", slug: "private", status: "draft" },
        ];
      }
      return [];
    },
    fetch: async (path) => {
      paths.push(path);
      return {};
    },
  }))
    snapshots.push(snapshot);
  assert(paths.some((path) => path === "/api/public/pages/public"));
  assert(paths.some((path) => path.includes("entityUuid=published-id")));
  assert(!paths.some((path) => path.includes("private") || path.includes("draft-id") || path.includes("preview")));
  assert(snapshots.every((snapshot) => contentTranslationPolicy(snapshot.path)));
});

test("inline HTML in Markdown retains tag boundaries and excludes nested notranslate/code content", () => {
  const source =
    'Hallo <span translate="no">Name **bleibt**</span> Welt <code>CODE bleibt</code> <a href="/fixed" title="Hinweis">Mehr</a>.';
  const document = prepareTranslationDocument({ text: source, format: "markdown", context: "article_text" });
  assert(!document.texts.some((text) => /Name|bleibt|CODE|fixed/.test(text)));
  const result = document.render((text) => `EN ${text}`)!;
  assert.match(result, /<span translate="no">Name \*\*bleibt\*\*<\/span>/);
  assert.match(result, /<code>CODE bleibt<\/code>/);
  assert.match(result, /<a href="\/fixed" title="EN Hinweis">EN Mehr<\/a>/);
  assert.doesNotMatch(result, /<span translate="no"><\/span>/);
});

test("unpublished report fields and inactive construction copy are never selected for generation", async () => {
  const data = {
    stops: [
      {
        title: "Public itinerary",
        report_status: "draft",
        report_title: "PRIVATE REPORT",
        teaser: "PRIVATE TEASER",
        media: [{ caption: "PRIVATE CAPTION" }],
      },
    ],
  };
  const { collectContentTranslationSegments } =
    await import("../../../src/frontend/server/utils/contentTranslation.js");
  const selected = collectContentTranslationSegments(
    data,
    contentTranslationPolicy("/api/public/tour-stops-by-tour")!,
    "test-v1",
    "en-GB",
  );
  assert.deepEqual(
    [...selected.values()].map((segment) => segment.text),
    ["Public itinerary"],
  );
  const config = collectContentTranslationSegments(
    { config: { under_construction: false, under_construction_explanation: "INACTIVE" } },
    contentTranslationPolicy("/api/public/data-page-config")!,
    "test-v1",
    "it-IT",
  );
  assert.equal(config.size, 0);
});

test("missing key or disabled configuration never starts provider, persistence writes or background timers", async () => {
  const { readFileSync } = await import("node:fs");
  const { runInNewContext } = await import("node:vm");
  const ts = await import("typescript");
  const code = readFileSync(
    new URL("../../../src/frontend/server/plugins/content-translation-worker.ts", import.meta.url),
    "utf8",
  ).replaceAll("import.meta.prerender", "false");
  for (const [enabled, generationEnabled, apiKey] of [
    [false, true, "fixture-key-present"],
    [true, false, "fixture-key-present"],
    [true, true, ""],
  ] as const) {
    const module = { exports: {} as { default?: (nitro: unknown) => void } };
    let starts = 0;
    let timers = 0;
    let aborted = 0;
    let readers = 0;
    const config = {
      contentTranslationEnabled: enabled,
      contentTranslationGenerationEnabled: generationEnabled,
      deeplApiEndpoint: "auto",
      deeplModel: "prefer_quality_optimized",
      deeplGlossaryEn: "",
      deeplGlossaryIt: "",
      deeplPolicyRevision: "v1",
      deeplApiKey: apiKey,
      directusServerUrl: "http://directus:8055",
      directusFrontendServerToken: "private-server-token",
      contentTranslationWorkerToken: "private-worker-token",
    };
    const forbidden = () => {
      starts++;
      throw new Error("Must stay disabled");
    };
    const dependencies: Record<string, unknown> = {
      zod: require("zod"),
      "../utils/contentTranslation": { configureContentTranslationReader() {}, noopContentTranslationReader: {} },
      "../utils/contentTranslationPersistence": {
        createPersistedTranslationReader: () => {
          readers++;
          return {};
        },
        createTranslationPersistence: forbidden,
      },
      "../utils/deepLTranslation": { deepLNamespace, DeepLSettingsSchema, createDeepLTranslator: forbidden },
      "../utils/contentTranslationWorker": { runContentTranslationWorker: forbidden },
      "../utils/publicItems": { readPublicItems: forbidden },
      "../utils/securityLogging": { systemLog() {} },
      "~/shared/contentTranslation": { contentTranslationPolicy },
    };
    runInNewContext(
      ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
        .outputText,
      {
        module,
        exports: module.exports,
        require: (id: string) => {
          assert(id in dependencies, id);
          return dependencies[id];
        },
        defineNitroPlugin: (callback: unknown) => callback,
        useRuntimeConfig: () => config,
        process: { env: {} },
        __slkTranslationWorker: {
          abort() {
            aborted++;
          },
        },
        setTimeout: () => {
          timers++;
        },
        setInterval: () => {
          timers++;
        },
      },
    );
    module.exports.default!({ hooks: { hook() {} } });
    assert.equal(starts, 0);
    assert.equal(timers, 0);
    assert.equal(aborted, 1, "Disabling after a hot reload aborts the preceding worker");
    assert.equal(readers, enabled ? 1 : 0, "Reader-only mode works with a configured key and generation disabled");
  }
});

test("a received translation can retry its idempotent database commit without calling DeepL again", async () => {
  const { createTranslationPersistence } =
    await import("../../../src/frontend/server/utils/contentTranslationPersistence.js");
  let writes = 0;
  const payloads: string[] = [];
  const persistence = createTranslationPersistence(
    "http://private-directus:8055",
    "fixture-worker-token",
    deepLNamespace(options),
    async (_url, init) => {
      writes++;
      payloads.push(String(init?.body));
      return writes === 1
        ? Response.json({ error: "translation_control_unavailable" }, { status: 503 })
        : Response.json({ committed: true });
    },
    0,
  );
  const { randomUUID } = await import("node:crypto");
  assert.deepEqual(
    await persistence.operation(
      { op: "commit", owner: randomUUID(), namespace: persistence.namespace, batch: null, units: [], fields: [] },
      new AbortController().signal,
    ),
    { committed: true },
  );
  assert.equal(writes, 2);
  assert.equal(payloads[0], payloads[1]);
});

test("one edited sentence does not rebill the rest of its paragraph; reverting an edit reuses earlier fields", async () => {
  const data = { pages: [{ name: "Titel", contents: "<p>Erster Satz. Zweiter Satz.</p>" }] };
  const fixture = harness(data);
  await fixture.run();
  const before = fixture.generations.length;
  data.pages[0]!.contents = "<p>Korrigierter Satz. Zweiter Satz.</p>";
  assert.equal((await fixture.run()).generated, 2);
  assert.deepEqual(
    fixture.generations.slice(before).map((call) => call.texts),
    [["Korrigierter Satz."], ["Korrigierter Satz."]],
  );
  data.pages[0]!.contents = "<p>Erster Satz. Zweiter Satz.</p>";
  assert.equal((await fixture.run()).generated, 0);
});

test("offline DeepL plan measures deduplicated text rather than billing markup, code or repeat fields", async () => {
  const { planDeepLUsage } = await import("./contentTranslationPlan.js");
  const plan = planDeepLUsage([
    {
      path: "/api/public/site-layout",
      data: { pages: [{ name: "Hallo", contents: '<p>Hallo</p><code>NO BILLING</code><a href="/stable">Welt</a>' }] },
    },
    {
      path: "/api/public/pages/a",
      data: { page: { name: "Hallo", contents: '<p>Hallo</p><code>NO BILLING</code><a href="/stable">Welt</a>' } },
    },
  ]);
  assert.deepEqual(plan, {
    uniqueTextUnitsPerTarget: 2,
    codePointsPerTarget: 9,
    codePointsBothTargets: 18,
    unsupportedFields: 0,
  });
});

test("staging sample planning bounds fields, Unicode characters and explicit apply; dry-run cannot call provider or write", async () => {
  const { parseSampleOptions, planTranslationSample, runTranslationSample } =
    await import("./contentTranslationSample.js");
  const layout = {
    pages: ["Über uns", "Klimaschutz 🌍", "Mitmachen"].map((name, index) => ({
      id: String(index),
      slug: `page-${index}`,
      name,
      contents: "Large body excluded",
      sort_order: index,
    })),
    municipalities: [],
    navigationConfig: null,
  };
  const args = ["--frontend-url", "https://staging.example.org", "--directus-url", "http://127.0.0.1:9001"];
  const options = parseSampleOptions(args);
  assert.equal(options.apply, false);
  assert.equal(options.maxCharacters, 200);
  assert.equal(parseSampleOptions([...args, "--apply"]).apply, true);
  for (const invalid of [
    [...args, "--count", "6"],
    [...args, "--count", "-1"],
    [...args, "--max-characters", "501"],
    [...args, "--unknown"],
    [...args, "--apply", "--apply"],
    ["--frontend-url", "https://user:secret@staging.example.org", "--directus-url", "http://localhost:9001"],
  ])
    assert.throws(() => parseSampleOptions(invalid));
  const plan = planTranslationSample(layout, 2, 200);
  assert.equal(plan.pages.length, 2);
  assert.equal(plan.maximumSourceCharacters, 2 * Array.from("Über unsKlimaschutz 🌍").length);
  assert(!JSON.stringify(plan).includes("Large body"));
  assert.throws(() => planTranslationSample(layout, 2, 1));
  assert.throws(() => planTranslationSample(layout, 0, 200));
  const calls: string[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.method, undefined, "Sample planning only performs a public GET");
    assert.equal(String(url), "https://staging.example.org/api/public/site-layout?contentLocale=de-DE");
    return Response.json(layout);
  };
  const secrets = {
    CONTENT_TRANSLATION_ENABLED: "true",
    CONTENT_TRANSLATION_GENERATION_ENABLED: "false",
    DEEPL_API_KEY: "fixture-valid-key-never-sent",
    CONTENT_TRANSLATION_WORKER_TOKEN: "private",
  };
  const result = await runTranslationSample(options, secrets, fakeFetch);
  assert.equal(result.mode, "dry-run");
  assert.equal(calls.length, 1);
  assert.equal("providerCalls" in result && result.providerCalls, 0);
  await assert.rejects(
    runTranslationSample(
      { ...options, apply: true },
      { ...secrets, CONTENT_TRANSLATION_GENERATION_ENABLED: "true" },
      fakeFetch,
    ),
    /automatic generation/,
  );
  assert.equal(calls.length, 2, "Unsafe apply is refused before private/provider calls or enqueue");
});

test("bounded staging apply persists both locales, verifies public overlays and reuses all paid units on rerun", async () => {
  const { parseSampleOptions, runTranslationSample } = await import("./contentTranslationSample.js");
  const { contentTranslationKey } = await import("../../../src/frontend/server/utils/contentTranslation.js");
  const store = harness({ pages: [] });
  const layout = {
    pages: ["Über uns", "Klimaschutz"].map((name, index) => ({
      id: String(index),
      slug: `sample-${index}`,
      name,
      contents: null,
      sort_order: index,
    })),
    municipalities: [],
    navigationConfig: null,
  };
  let billed = 0;
  let paidCalls = 0;
  let enqueues = 0;
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "staging.example.org") {
      const locale = url.searchParams.get("contentLocale");
      if (locale === "de-DE") return Response.json(layout);
      return Response.json({
        ...layout,
        pages: layout.pages.map((page) => ({
          ...page,
          name:
            store.rows.get(
              contentTranslationKey(store.persistence.namespace, locale as "en-GB" | "it-IT", {
                text: page.name,
                format: "text",
                context: "name",
              }),
            )?.translated_text ?? page.name,
        })),
      });
    }
    if (url.hostname === "api.deepl.com") {
      if (url.pathname === "/v2/usage") return Response.json({ character_count: billed, character_limit: 10000 });
      assert.equal(url.pathname, "/v2/translate");
      const body = JSON.parse(String(init?.body)) as { text: string[]; target_lang: string };
      paidCalls++;
      return Response.json({
        translations: body.text.map((text) => ({
          text: `${body.target_lang}|${text}`,
          billed_characters: Array.from(text).length,
        })),
      });
    }
    assert.equal(url.host, "127.0.0.1:9001");
    if (url.pathname === "/content-translations/status")
      return Response.json({
        limits: { daily: 38, total: 38 },
        usage: [
          { id: "total", reserved_characters: billed, billed_characters: billed },
          {
            id: `day:${new Date().toISOString().slice(0, 10)}`,
            reserved_characters: billed,
            billed_characters: billed,
          },
        ],
        job: { namespace: store.persistence.namespace, lease_until: null },
      });
    if (url.pathname === "/content-translations/memory")
      return Response.json({
        rows: [...store.rows.values()].filter((row) => url.searchParams.get("keys")!.split(",").includes(row.id)),
      });
    if (url.pathname === "/items/content_translation_memory") {
      const filter = JSON.parse(url.searchParams.get("filter")!) as { id: { _in: string[] } };
      return Response.json({
        data: [...store.rows.values()].filter(
          (row) => row.kind === "field" && row.state === "ready" && filter.id._in.includes(row.id),
        ),
      });
    }
    assert.equal(url.pathname, "/content-translations");
    const body = JSON.parse(String(init?.body)) as TranslationOperation;
    if (body.op === "enqueue") {
      enqueues++;
      return Response.json({ queued: true });
    }
    if (body.op === "commit")
      billed += body.units
        .filter((unit) => store.rows.get(unit.key)?.state !== "ready")
        .reduce((total, unit) => total + unit.billed, 0);
    return Response.json(await store.persistence.operation(body, new AbortController().signal));
  };
  const options = parseSampleOptions([
    "--frontend-url",
    "https://staging.example.org",
    "--directus-url",
    "http://127.0.0.1:9001",
    "--count",
    "2",
    "--apply",
  ]);
  const env = {
    CONTENT_TRANSLATION_ENABLED: "true",
    CONTENT_TRANSLATION_GENERATION_ENABLED: "false",
    DEEPL_API_KEY: "fixture-api-key-not-real",
    CLI_DIRECTUS_STATIC_TOKEN: "private-operator",
    CONTENT_TRANSLATION_WORKER_TOKEN: "private-worker",
    DIRECTUS_FRONTEND_SERVER_TOKEN: "private-reader",
  };
  const timing = { wait: async () => {}, paceMs: 0 };
  const first = await runTranslationSample(options, env, fakeFetch, timing);
  assert.equal(first.mode, "applied");
  assert.equal(first.providerCalls, 2);
  assert.equal(first.billedDelta, 38);
  assert.equal(paidCalls, 2);
  const second = await runTranslationSample(options, env, fakeFetch, timing);
  assert.equal(second.providerCalls, 0);
  assert.equal(second.billedDelta, 0);
  assert.equal(paidCalls, 2);
  assert.equal(enqueues, 2);
});
