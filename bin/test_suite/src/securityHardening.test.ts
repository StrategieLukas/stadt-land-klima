import * as pdfFilename from "../../../src/directus/extensions/endpoint-pdf-service/src/filename.ts";
import * as municipalityClassification from "../../../src/frontend/shared/municipalityClassification.ts";
import { loggingModule } from "./lib/loggingModules.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { createHmac } from "node:crypto";
import ts from "typescript";

const root = new URL("../../../", import.meta.url);
const frontend = createRequire(new URL("src/frontend/package.json", root));
type Row = Record<string, any>;
const h3 = {
  ...frontend("h3"),
  defineEventHandler: (fn: unknown) => fn,
  createError: (options: Row) => Object.assign(new Error("Controlled failure"), options),
  getHeader: (event: Row, name: string) => event.headers?.[name],
  setResponseHeader() {},
  setResponseStatus() {},
};
function load(path: string, deps: Row = {}, globals: Row = {}, extra = ""): Row {
  const source = readFileSync(new URL(path, root), "utf8") + extra;
  const module = { exports: {} };
  runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
      .outputText,
    {
      module,
      exports: module.exports,
      Buffer,
      URL,
      URLSearchParams,
      Date,
      setTimeout,
      clearTimeout,
      console,
      process: { env: {} },
      require: (id: string) =>
        id.endsWith("/municipalityClassification.ts")
          ? municipalityClassification
          : id in deps
            ? deps[id]
            : id === "h3"
              ? h3
              : (loggingModule(id) ?? frontend(id)),
      ...globals,
    },
  );
  return module.exports;
}
const utility = (path: string, deps: Row = {}, globals: Row = {}) =>
  load("src/frontend/server/utils/" + path, deps, globals);

test("CMS sanitizer works without a DOM, preserves formatting, and removes active HTML and hostile URLs", () => {
  const { sanitizeHtml, sanitizeText } = load("src/frontend/utils/sanitizeHtml.ts");
  for (const dirty of [
    '<img src=x onerror="alert(1)">',
    '<svg><a xlink:href="javascript:alert(1)">x</a></svg>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<a href="java&#x73;cript:alert(1)">link</a>',
    "<xmp><img src=x onerror=alert(1)></xmp>",
    '<span style="background:url(https://evil.org);position:fixed">safe</span>',
  ]) {
    const result = sanitizeHtml(dirty);
    assert.doesNotMatch(result, /onerror|<svg|<iframe|javascript:|<xmp|url\(|position:/i, dirty);
  }
  const safe = sanitizeHtml(
    '<h2>Grüße</h2><span style="color:#afca0b;text-align:center">Hello</span><a href="https://example.org" target="_blank">link</a>',
  );
  assert.match(safe, /<h2>Grüße<\/h2>/);
  assert.match(safe, /color:#afca0b/);
  assert.match(safe, /noopener noreferrer/);
  assert.equal(sanitizeText("<b>A &amp; B</b><script>secret</script>"), "A & B");
  assert.equal(sanitizeHtml(undefined), "");
});

test("signed math challenges reject missing, expired, future, cross-purpose, malformed and incorrect answers, including development", async () => {
  const { verifyMathChallenge } = utility("verifyMathChallenge.ts", {
    "./abuseProtection": { DEVELOPMENT_CAPTCHA_SECRET: "dev-secret-change-in-production" },
  });
  const key = "a".repeat(64);
  const token = (purpose = "contact", timestamp = Date.now()) => {
    const signed = `${JSON.stringify({ num1: 12, num2: 7, purpose })}:${timestamp}`;
    return Buffer.from(`${signed}:${createHmac("sha256", key).update(signed).digest("hex")}`).toString("base64");
  };
  assert.equal(await verifyMathChallenge(token(), "19", key, "contact", false), true);
  for (const [proof, answer, purpose] of [
    [token(), "18", "contact"],
    [token(), "19evil", "contact"],
    [token(), "19", "form"],
    [token("contact", Date.now() + 60000), "19", "contact"],
    [token("contact", Date.now() - 1200001), "19", "contact"],
    ["", "19", "contact"],
    [token("unknown"), "19", "contact"],
  ]) {
    assert.equal(await verifyMathChallenge(proof, answer, key, purpose, false), false);
    assert.equal(await verifyMathChallenge(proof, answer, key, purpose, true), false);
  }
});

test("request limits reject concurrent excess, fail closed for writes/PDF, bound degraded reads and ignore forged proxy headers", async () => {
  let count = 0;
  let down = false;
  const env: Row = {};
  const { rateLimit, requestPeer } = utility(
    "rateLimit.ts",
    {
      "./rateLimitConfig": { getRateLimitPreset: () => ({ max: 3, windowSeconds: 60 }) },
      "./protectionRedis": {
        withProtectionRedis: async (operation: (redis: Row) => Promise<unknown>) => {
          if (down) throw new Error("offline");
          return operation({
            eval: async (_script: string, command: Row) => (++count <= Number(command.arguments[1]) ? 1 : 0),
          });
        },
      },
    },
    { process: { env } },
  );
  const event = {
    method: "GET",
    node: { req: { socket: { remoteAddress: "::ffff:192.0.2.1" }, headers: { "x-real-ip": "198.51.100.4" } } },
  };
  assert.equal(requestPeer(event), "192.0.2.1");
  env.TRUST_PROXY = "true";
  env.SLK_ENV = "production";
  assert.equal(requestPeer(event), "198.51.100.4");
  assert.equal(
    (await Promise.all(Array.from({ length: 20 }, () => rateLimit(event, "test")))).filter(Boolean).length,
    3,
  );
  down = true;
  await assert.rejects(rateLimit({ ...event, method: "POST" }, "test"), { statusCode: 503 });
  await assert.rejects(rateLimit(event, "election-pdf"), { statusCode: 503 });
  for (let i = 0; i < 4; i++) assert.equal(await rateLimit(event, "read-test"), i < 3);
});

test("generic submissions use a published form contract, reject forged field names, and apply trusted routing and delivery quotas", async () => {
  const { GenericFormRequestSchema } = frontend("./shared/contracts/submissions.ts");
  let writes = 0;
  let stored: Row = {};
  let quotas = 0;
  const definition = {
    formKey: "trusted",
    formTitle: "Trusted",
    notificationEmail: "owner@example.org",
    sendCopy: false,
    fields: [{ name: "message", label: "Message", type: "textarea", required: true }],
  };
  const handler = load(
    "src/frontend/server/api/submit-form-response.post.ts",
    {
      "~/shared/contracts/submissions": { GenericFormRequestSchema },
      "../utils/publishedForm": {
        publishedForm: async (_type: string, _id: string, uuid: string) => {
          if (uuid !== "real-form") throw Object.assign(new Error(), { statusCode: 404 });
          return definition;
        },
      },
      "../utils/formDeliveryQuota": {
        formDeliveryQuota: async () => {
          quotas++;
        },
      },
      "../utils/abuseProtection": { abuseProtection: () => ({ hmacKey: "secret", devMode: false }) },
      "../utils/readRequestBody": { readRequestBody: async (event: Row) => event.body },
      "../utils/verifyAltcha": { verifyAltcha: async () => true },
      "../utils/verifyMathChallenge": { verifyMathChallenge: async () => true },
      "../utils/rateLimit": { rateLimit: async () => true },
    },
    {
      ...h3,
      useRuntimeConfig: () => ({ directusAdminToken: "private" }),
      $fetch: async (_url: string, options: Row) => {
        writes++;
        stored = options.body;
        return { data: { id: 1, status: "received" } };
      },
    },
  ).default;
  const body = {
    formUuid: "real-form",
    entityType: "pages",
    entityUuid: "owner",
    notificationEmail: "attacker@example.org",
    sendCopy: true,
    formTitle: "Forged",
    fields: [{ name: "forged", label: "Forged", type: "text" }],
    values: { message: "<img src=x onerror=alert(1)>" },
    altcha: "proof",
    mathChallenge: { token: "proof", answer: "20" },
  };
  await handler({ body });
  assert.equal(writes, 1);
  assert.equal(quotas, 1);
  assert.equal(stored.notification_email, "owner@example.org");
  assert.equal(stored.form_title, "Trusted");
  assert.equal(stored.send_copy, false);
  assert.equal(stored.response_data.fields[0].name, "message");
  await assert.rejects(handler({ body: { ...body, values: { unknown: "forged" } } }), { statusCode: 400 });
  await assert.rejects(handler({ body: { ...body, formUuid: "unpublished" } }), { statusCode: 404 });
  assert.equal(writes, 1);
});

test("published form lookup traverses checked nested blocks and rejects unpublished owners and nonexistent forms", async () => {
  const blocks = [
    {
      uuid: "container",
      bundle: "container",
      props: {
        blocks: [
          {
            uuid: "nested",
            bundle: "form",
            options: { notificationEmail: "owner@example.org" },
            props: {
              title: "Form",
              fields: [
                {
                  uuid: "field",
                  bundle: "form_field",
                  options: { fieldName: "Email", fieldType: "email", required: true },
                  props: { label: [{ uuid: "label", bundle: "form_label", props: { text: "Email" } }] },
                },
              ],
            },
          },
        ],
      },
    },
  ];
  const { publishedForm } = utility("publishedForm.ts", {
    "~/shared/editorBlocks": frontend("./shared/editorBlocks.ts"),
    "./publicBlocks": {
      readPublicBlocks: async (_type: string, id: string) => {
        if (id === "draft") throw Object.assign(new Error(), { statusCode: 404 });
        return blocks;
      },
    },
  });
  const form = await publishedForm("pages", "owner", "nested");
  assert.equal(form.notificationEmail, "owner@example.org");
  assert.equal(form.fields[0].name, "email");
  assert.equal(form.fields[0].required, true);
  await assert.rejects(publishedForm("pages", "owner", "missing"), { statusCode: 404 });
  await assert.rejects(publishedForm("pages", "draft", "nested"), { statusCode: 404 });
});

test("candidate sessions use encrypted HttpOnly cookies with no header override and enforce origin plus constant-time CSRF checks", async () => {
  let options: Row = {};
  const { candidateSession, candidateMutationOrigin, validCandidateCsrf } = utility(
    "candidateSession.ts",
    {
      h3: {
        ...h3,
        useSession: async (_event: unknown, config: Row) => {
          options = config;
          return { data: {} };
        },
      },
      "./abuseProtection": { abuseProtection: () => ({ hmacKey: "a".repeat(64), devMode: false }) },
    },
    { useRuntimeConfig: () => ({ appPublicUrl: "https://example.org", candidateSessionSecret: "" }) },
  );
  await candidateSession({});
  assert.equal(options.sessionHeader, false);
  assert.equal(options.cookie.httpOnly, true);
  assert.equal(options.cookie.secure, true);
  assert.equal(options.cookie.sameSite, "strict");
  assert.equal(options.cookie.path, "/api/candidate");
  const headers = {
    "x-slk-candidate": "1",
    origin: "https://example.org",
    host: "example.org",
    "sec-fetch-site": "same-origin",
  };
  candidateMutationOrigin({ headers });
  for (const changed of [{ "x-slk-candidate": "" }, { origin: "https://evil.org" }, { "sec-fetch-site": "cross-site" }])
    assert.throws(() => candidateMutationOrigin({ headers: { ...headers, ...changed } }), { statusCode: 403 });
  assert.equal(validCandidateCsrf("a".repeat(64), "a".repeat(64)), true);
  for (const value of [undefined, "a", "b".repeat(64)]) assert.equal(validCandidateCsrf(value, "a".repeat(64)), false);
});

test("CSP reports never log document URLs, blocked URLs, script samples or unbounded directive keys", async () => {
  const logs: string[] = [];
  let now = 0;
  const handler = load(
    "src/frontend/server/api/security/csp.post.ts",
    {
      "../../utils/readRequestBody": { readRequestBody: async (event: Row) => event.body },
      "../../utils/rateLimit": { rateLimit: async () => true },
      "../../utils/securityLogging": {
        requestLog: (_event: unknown, level: string, code: string, details: unknown) =>
          logs.push(JSON.stringify({ level, code, details })),
      },
    },
    { Date: { now: () => now }, console: { info: (...args: unknown[]) => logs.push(JSON.stringify(args)) } },
  ).default;
  now = 61000;
  await handler({
    body: {
      "csp-report": {
        "effective-directive": "script-src-elem",
        "document-uri": "https://example.org/private-token",
        "blocked-uri": "https://evil.org/secret",
        "script-sample": "private text",
      },
    },
  });
  assert.match(logs.join(), /csp_blocked/);
  assert.match(logs.join(), /"count":1/);
  assert.doesNotMatch(logs.join(), /private|secret|evil\.org/);
});

test("search cleanup removes UUID and legacy-slug children before deletion and excludes every nonpublished block", async () => {
  const removed: string[] = [];
  const added: Row[] = [];
  const actions = new Map<string, Function[]>();
  const filters = new Map<string, Function>();
  const page = { id: "12345678-1234-4234-8234-123456789abc", slug: "example", name: "Example", status: "draft" };
  const rows: Row = {
    pages: [page],
    measures: [{ id: 1, slug: "measure", status: "draft", catalog_version: "catalog" }],
    measure_catalog: [{ id: "catalog", hidden: false, isCurrentFrontend: true }],
    news_items: [{ ...page, title: "News", teaser: "Public news" }],
    blocks: [
      {
        id: 1,
        uuid: "block-uuid",
        entity_uuid: page.id,
        entity_type: "pages",
        field_name: "content",
        bundle: "heading",
        props: { text: "Private" },
        status: "draft",
      },
      {
        id: 2,
        uuid: "legacy-block",
        entity_uuid: page.slug,
        entity_type: "pages",
        field_name: "content",
        bundle: "heading",
        props: { text: "Legacy" },
        status: "published",
      },
    ],
  };
  const database = (table: string) => {
    let tests: ((row: Row) => boolean)[] = [];
    const builder: Row = {
      where(field: string | Function, value?: unknown) {
        if (typeof field === "function") field(builder);
        else tests.push((row) => row[field] === value);
        return builder;
      },
      orWhere(field: string, value: unknown) {
        const previous = tests.pop()!;
        tests.push((row) => previous(row) || row[field] === value);
        return builder;
      },
      whereIn(field: string, values: unknown[]) {
        tests.push((row) => values.includes(row[field]));
        return builder;
      },
      whereNotIn(field: string, values: unknown[]) {
        tests.push((row) => !values.includes(row[field]));
        return builder;
      },
      select() {
        return builder;
      },
      limit() {
        return builder;
      },
      then(resolve: Function, reject: Function) {
        return Promise.resolve(rows[table].filter((row: Row) => tests.every((test) => test(row)))).then(
          resolve as any,
          reject as any,
        );
      },
    };
    return builder;
  };
  const hook = load("src/directus/extensions/hook-search-index/src/index.ts", {
    meilisearch: {
      Meilisearch: class {
        index() {
          return {
            addDocuments: async (docs: Row[]) => added.push(...docs),
            deleteDocument: async (id: string) => removed.push(id),
          };
        }
      },
    },
  }).default;
  hook(
    {
      action: (event: string, handler: Function) => actions.set(event, [...(actions.get(event) || []), handler]),
      filter: (event: string, handler: Function) => filters.set(event, handler),
    },
    { env: {}, logger: { error: assert.fail, warn() {} }, emitter: { onAction() {} } },
  );
  for (const fn of actions.get("items.update")!) await fn({ collection: "pages", keys: [page.id] }, { database });
  assert.ok(removed.includes("page_example"));
  assert.ok(removed.includes("block_block-uuid"));
  assert.ok(removed.includes("block_legacy-block"));
  removed.length = 0;
  await filters.get("items.delete")!([page.id], { collection: "pages" }, { database });
  assert.ok(removed.includes("page_example"));
  assert.ok(removed.includes("block_block-uuid"));
  assert.ok(removed.includes("block_legacy-block"));
  removed.length = 0;
  await filters.get("items.delete")!([1], { collection: "blocks" }, { database });
  assert.deepEqual(removed, ["block_block-uuid"]);
  page.status = "published";
  removed.length = 0;
  for (const fn of actions.get("items.update")!) await fn({ collection: "blocks", keys: [1] }, { database });
  assert.ok(removed.includes("block_block-uuid"));
  assert.equal(added.length, 0);
  for (const fn of actions.get("items.update")!) await fn({ collection: "pages", keys: [page.id] }, { database });
  assert.ok(
    added.some((doc) => doc.id === "block_legacy-block"),
    "republishing restores published child results",
  );
  const update = async (collection: string, keys: (string | number)[]) => {
    for (const fn of actions.get("items.update")!) await fn({ collection, keys }, { database });
  };
  const create = async (collection: string, key: string | number) => {
    for (const fn of actions.get("items.create")!) await fn({ collection, key }, { database });
  };
  added.length = 0;
  removed.length = 0;
  await create("measures", 1);
  assert.equal(added.length, 0);
  assert.ok(removed.includes("measure_measure"));
  rows.measures[0].status = "published";
  await update("measures", [1]);
  assert.ok(added.some((doc) => doc.id === "measure_measure"));
  added.length = 0;
  rows.measure_catalog[0].hidden = true;
  await update("measure_catalog", ["catalog"]);
  assert.equal(added.length, 0);
  rows.measure_catalog[0].hidden = false;
  rows.measure_catalog[0].isCurrentFrontend = false;
  await update("measures", [1]);
  assert.equal(added.length, 0);
  rows.measure_catalog[0].isCurrentFrontend = true;
  await update("measure_catalog", ["catalog"]);
  assert.ok(added.some((doc) => doc.id === "measure_measure"));
  removed.length = 0;
  await filters.get("items.update")!({ slug: "renamed" }, { collection: "measures", keys: [1] }, { database });
  assert.ok(removed.includes("measure_measure"));

  rows.measures.push({ id: 2, slug: "measure", status: "draft", catalog_version: "old-catalog" });
  added.length = 0;
  removed.length = 0;
  await update("measures", [2]);
  assert.ok(
    added.some((doc) => doc.id === "measure_measure"),
    "old draft versions preserve the current published measure",
  );
  assert.ok(!removed.includes("measure_measure"));
  await filters.get("items.delete")!([2], { collection: "measures" }, { database });
  assert.ok(!removed.includes("measure_measure"), "deleting an old version preserves the current result");
  await filters.get("items.update")!({ slug: "old-renamed" }, { collection: "measures", keys: [2] }, { database });
  assert.ok(!removed.includes("measure_measure"), "renaming an old version preserves the current result");

  removed.length = 0;
  await filters.get("items.update")!({ slug: "page-renamed" }, { collection: "pages", keys: [page.id] }, { database });
  assert.ok(removed.includes("page_example"));
  assert.ok(removed.includes("block_block-uuid"));
  assert.ok(removed.includes("block_legacy-block"), "renames clean up legacy slug-linked block documents");

  const news = rows.news_items[0];
  rows.blocks.push({ ...rows.blocks[1], id: 3, uuid: "news-child", entity_type: "news_items", entity_uuid: page.id });
  added.length = 0;
  await create("news_items", news.id);
  assert.equal(added.length, 0);
  news.status = "published";
  await update("news_items", [news.id]);
  assert.ok(added.some((doc) => doc.id === "news_item_example" && doc.url === "/news/example"));
  assert.ok(added.some((doc) => doc.id === "block_news-child" && doc.url === "/news/example#block-news-child"));
  removed.length = 0;
  news.status = "draft";
  await update("news_items", [news.id]);
  assert.ok(removed.includes("news_item_example"));
  assert.ok(removed.includes("block_news-child"));
});

test("PDF compilation passes a native kill timeout and bounded binary buffers to execFile", async () => {
  let captured: Row = {};
  const extension = load(
    "src/directus/extensions/endpoint-pdf-service/src/index.ts",
    {
      "./filename.ts": pdfFilename,
      child_process: {
        execFile: (...args: unknown[]) => {
          captured = args[2] as Row;
          const callback = args[3] as Function;
          callback(null, Buffer.from("%PDF-fixture"), Buffer.alloc(0));
        },
      },
      util: {
        promisify:
          (fn: Function) =>
          (...args: unknown[]) =>
            new Promise((resolve, reject) =>
              fn(...args, (error: Error | null, stdout: Buffer, stderr: Buffer) =>
                error ? reject(error) : resolve({ stdout, stderr }),
              ),
            ),
      },
      "html-to-text": { convert: (value: unknown) => value },
    },
    {},
    "\nexports.compilePdfForTest = compilePdf;",
  );
  const pdf = await extension.compilePdfForTest("/tmp/source.typ", "/tmp", "/tmp", {});
  assert.equal(pdf.toString(), "%PDF-fixture");
  assert.equal(captured.timeout, 30000);
  assert.equal(captured.killSignal, "SIGKILL");
  assert.equal(captured.maxBuffer, 50 * 1024 * 1024);
  assert.equal(captured.encoding, "buffer");
});

test("notification flow escapes every submitted HTML value before rendering either email", async () => {
  const yaml = frontend("yaml");
  const flow = yaml.parse(readFileSync(new URL("src/directus/flows/notifyNewFormResponse.yaml", root), "utf8"));
  const operation = flow.operations.find((op: Row) => op.key === flow.operation_key);
  const module = { exports: null as unknown };
  runInNewContext(operation.options.code, { module });
  const transform = module.exports as (data: unknown) => Promise<Row>;
  const safe = await transform({
    $trigger: {
      payload: {
        form_title: "<img src=x onerror=alert(1)>",
        response_summary: "<script>evil</script>",
        page_path: '&"',
      },
    },
  });
  assert.doesNotMatch(JSON.stringify(safe), /<img|<script>/);
  assert.match(safe.response_summary, /&lt;script&gt;/);
  for (const mail of flow.operations.filter((op: Row) => op.type === "mail")) {
    assert.doesNotMatch(mail.options.body, /\$trigger\.payload/);
    assert.match(mail.options.body, /escape_form_response_html/);
  }
});

test("core data cutover preserves old clusters, refuses missing/colliding paths, and rolls back a partial move failure", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const script = new URL("bin/lib/core-data-cutover.sh", root).pathname;
  const fixture = () => {
    const dir = mkdtempSync(join(tmpdir(), "slk-cutover-"));
    for (const name of ["db", "meilisearch"])
      for (const suffix of ["", ".upgrade-test"]) {
        mkdirSync(join(dir, name + suffix));
        writeFileSync(join(dir, name + suffix, suffix ? "new" : "old"), "fixture");
      }
    return dir;
  };
  let dir = fixture();
  try {
    assert.equal(spawnSync("sh", [script, "test", dir]).status, 0);
    for (const name of ["db", "meilisearch"]) {
      assert.ok(existsSync(join(dir, name, "new")));
      assert.ok(existsSync(join(dir, name + ".before-test", "old")));
    }
    assert.notEqual(spawnSync("sh", [script, "test", dir]).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  dir = fixture();
  try {
    rmSync(join(dir, "meilisearch.upgrade-test"), { recursive: true });
    assert.notEqual(spawnSync("sh", [script, "test", dir]).status, 0);
    assert.ok(existsSync(join(dir, "db", "old")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  dir = fixture();
  try {
    const commands = join(dir, "commands");
    mkdirSync(commands);
    const marker = join(dir, "failed");
    writeFileSync(
      join(commands, "mv"),
      `#!/bin/sh\ncase "$1" in *meilisearch.upgrade-test) if [ ! -e '${marker}' ]; then touch '${marker}'; exit 42; fi;; esac\nexec /bin/mv "$@"\n`,
      { mode: 0o755 },
    );
    const result = spawnSync("sh", [script, "test", dir], {
      env: { ...process.env, PATH: commands + ":" + process.env.PATH },
    });
    assert.equal(result.status, 42);
    for (const name of ["db", "meilisearch"]) {
      assert.ok(existsSync(join(dir, name, "old")));
      assert.ok(existsSync(join(dir, name + ".upgrade-test", "new")));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("core startup guard refuses old data and migration rejects unsupported mounts before stopping or writing", async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "slk-core-guard-"));
  const log = join(dir, "calls");
  try {
    writeFileSync(
      join(dir, "docker"),
      `#!/usr/bin/env python3
import os,sys,json
args=sys.argv[1:]
with open(os.environ['SLK_TEST_CALLS'],'a') as f: f.write(json.dumps(args)+'\\n')
if args[0]=='compose':
 if 'config' in args: print('postgis/postgis:17-3.6\\ngetmeili/meilisearch:v1.55.0')
 elif 'ps' in args: print(args[-1]+'-fixture')
elif args[0]=='inspect':
 if '.Mounts' in args[-1]: print(os.environ.get('SLK_TEST_MOUNT','bind')+'|/fixture/data|fixture-volume')
 else: print('fixture-image')
elif args[0]=='run':
 print(os.environ.get('SLK_TEST_PG','17') if args[-1]=='PG_VERSION' else '1.55.0')
else: sys.exit('Unexpected Docker operation')
`,
      { mode: 0o755 },
    );
    const env = { ...process.env, PATH: dir + ":" + process.env.PATH, SLK_TEST_CALLS: log };
    const guard = new URL("bin/check_core_service_data.sh", root).pathname;
    assert.equal(spawnSync("bash", [guard, "production"], { env }).status, 0);
    assert.equal(spawnSync("bash", [guard, "production"], { env: { ...env, SLK_TEST_PG: "13" } }).status, 1);
    assert.equal(spawnSync("bash", [guard, "unknown"], { env }).status, 2);
    const migration = new URL("bin/upgrade_core_services.sh", root).pathname;
    const rejected = spawnSync("bash", [migration, "production", "--apply"], {
      env: { ...env, SLK_TEST_MOUNT: "volume" },
      encoding: "utf8",
    });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /requires bind mounts/);
    assert.doesNotMatch(readFileSync(log, "utf8"), /"(?:stop|start|pull|exec|cp|rm)"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("static SVG icons retain geometry while dropping scripts, event handlers, foreign HTML and external references", () => {
  const { sanitizeSvg } = load("src/frontend/utils/sanitizeHtml.ts");
  const result = sanitizeSvg(
    '<svg viewBox="0 0 24 24" onload="evil()"><path d="M0 0" fill="currentColor"/><script>evil()</script><foreignObject><img src=x onerror=evil()></foreignObject><use href="https://evil.org/icon"/><path fill="url(https://evil.org)" d="M1 1"/></svg>',
  );
  assert.match(result, /viewBox="0 0 24 24"/);
  assert.match(result, /fill="currentColor"/);
  assert.doesNotMatch(result, /onload|script|foreignObject|onerror|<use|https:\/\/evil/);
});

test("form delivery quotas hash recipients, reserve global/form/copy budgets and fail closed on denial or Redis failure", async () => {
  let state: "allow" | "deny" | "down" = "allow";
  let command: Row = {};
  const { formDeliveryQuota } = utility("formDeliveryQuota.ts", {
    "./protectionRedis": {
      withProtectionRedis: async (operation: Function) => {
        if (state === "down") throw new Error("offline");
        return operation({
          eval: async (_script: string, options: Row) => {
            command = options;
            return state === "allow" ? 1 : 0;
          },
        });
      },
    },
  });
  await formDeliveryQuota("published-owner:real-form", "person@example.org");
  assert.equal(command.keys.length, 3);
  assert.deepEqual(Array.from(command.arguments), ["200", "50", "5"]);
  assert.doesNotMatch(JSON.stringify(command.keys), /person|example\.org|published-owner/);
  state = "deny";
  await assert.rejects(formDeliveryQuota("form"), { statusCode: 429 });
  state = "down";
  await assert.rejects(formDeliveryQuota("form"), { statusCode: 503 });
});

test("translated rich text keeps markup while rejecting executable CMS text and interpolated municipality names", () => {
  const createTranslator = frontend("./shared/createTranslator.ts").default;
  const { sanitizeHtml } = load("src/frontend/utils/sanitizeHtml.ts");
  const { t } = createTranslator([
    { key: "localteam.register.onboarding.body", value: '<strong>:name</strong><img src=x onerror="evil()">' },
  ]);
  const result = sanitizeHtml(t("localteam.register.onboarding.body", { ":name": '<svg onload="evil()">City</svg>' }));
  assert.match(result, /<strong>City<\/strong>/);
  assert.doesNotMatch(result, /onerror|onload|<svg/);
});

test("editor cookie holds only an opaque identity and CSRF; tokens live in revocable Redis sessions", async () => {
  const values = new Map<string, string>();
  let down = false;
  let options: Row = {};
  const cookie = {
    data: {} as Row,
    update: async (data: Row) => {
      cookie.data = data;
    },
  };
  const exports = utility(
    "editorSession.ts",
    {
      "~/shared/contracts/auth": frontend("./shared/contracts/auth.ts"),
      h3: {
        ...h3,
        useSession: async (_event: unknown, config: Row) => {
          options = config;
          return cookie;
        },
      },
      "./abuseProtection": { abuseProtection: () => ({ hmacKey: "a".repeat(64), devMode: false }) },
      "./protectionRedis": {
        withProtectionRedis: async (fn: Function) => {
          if (down) throw Error("Redis offline");
          return fn({
            set: async (key: string, value: string, flags: Row) => {
              if (flags.XX && !values.has(key)) return null;
              values.set(key, value);
              return "OK";
            },
            get: async (key: string) => values.get(key) ?? null,
            del: async (key: string) => values.delete(key),
          });
        },
      },
    },
    { useRuntimeConfig: () => ({ appPublicUrl: "https://example.org", editorSessionSecret: "" }) },
  );
  const session = {
    accessToken: "access-private",
    refreshToken: "refresh-private",
    expiresAt: Date.now() + 100000,
    user: { id: "personal" },
  };
  const response = await exports.openEditorSession({}, session);
  assert.deepEqual(Object.keys(response).sort(), ["csrf", "user"]);
  assert.deepEqual(Object.keys(cookie.data).sort(), ["csrf", "sid"]);
  assert.equal(options.sessionHeader, false);
  assert.equal(options.cookie.httpOnly, true);
  assert.equal(options.cookie.secure, true);
  assert.equal(options.cookie.sameSite, "strict");
  const event = {
    headers: {
      "x-slk-editor": "1",
      "x-csrf-token": response.csrf,
      origin: "https://example.org",
      "sec-fetch-site": "same-origin",
    },
  };
  assert.equal((await exports.readEditorSession(event, true)).session.accessToken, "access-private");
  for (const change of [
    { "x-csrf-token": "" },
    { "x-csrf-token": "b".repeat(64) },
    { "x-slk-editor": "" },
    { origin: "https://evil.org" },
    { "sec-fetch-site": "cross-site" },
  ])
    await assert.rejects(exports.readEditorSession({ headers: { ...event.headers, ...change } }, true), {
      statusCode: 403,
    });
  down = true;
  await assert.rejects(exports.readEditorSession(event), { statusCode: 503 });
  down = false;
  const sid = cookie.data.sid;
  await exports.revokeEditorSession(sid);
  await assert.rejects(exports.readEditorSession(event), { statusCode: 401 });
  await assert.rejects(
    exports.saveEditorSession(sid, session, true),
    { statusCode: 401 },
    "Refresh may not resurrect a logged-out session",
  );
});

test("editor refresh rotates exactly once across concurrent requests and revocation wins an in-flight refresh", async () => {
  let session: Row | null = { accessToken: "old", refreshToken: "old-refresh", expiresAt: 0, user: { id: "personal" } };
  let lock = false,
    refreshes = 0,
    logouts = 0,
    revoke = false;
  const { editorAccess } = utility(
    "editorUpstream.ts",
    {
      "~/shared/contracts/auth": frontend("./shared/contracts/auth.ts"),
      "./editorSession": {
        readEditorSession: async () => {
          if (!session) throw Object.assign(new Error(), { statusCode: 401 });
          return { sid: "a".repeat(64), session };
        },
        saveEditorSession: async (_sid: string, next: Row) => {
          if (revoke) {
            session = null;
            throw Object.assign(new Error(), { statusCode: 401 });
          }
          session = next;
        },
      },
      "./protectionRedis": {
        withProtectionRedis: async (fn: Function) =>
          fn({
            set: async () => {
              if (lock) return null;
              lock = true;
              return "OK";
            },
            eval: async () => {
              lock = false;
            },
          }),
      },
    },
    {
      useRuntimeConfig: () => ({ directusServerUrl: "http://cms" }),
      $fetch: async (url: string) => {
        if (url.endsWith("/logout")) {
          logouts++;
          return;
        }
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { data: { access_token: "fresh", refresh_token: "fresh-refresh", expires: 600000 } };
      },
    },
  );
  const results = await Promise.all(Array.from({ length: 8 }, () => editorAccess({}, true)));
  assert.equal(refreshes, 1);
  assert.ok(results.every((result) => result.session.accessToken === "fresh"));
  session!.expiresAt = 0;
  revoke = true;
  await assert.rejects(editorAccess({}, true), { statusCode: 401 });
  assert.equal(logouts, 1);
  assert.equal(session, null);
});

test("CMS transport strips nested credentials, rejects inherited deep paths and bounds transforms", () => {
  const { publicEditorJson, validateEditorQuery } = utility("editorTransport.ts");
  const result = publicEditorJson({
    data: [
      {
        id: 1,
        owner: {
          name: "Editor",
          token: "secret",
          password: "secret",
          access_token: "secret",
          refresh_token: "secret",
          api_key: "secret",
        },
      },
    ],
  });
  assert.equal(JSON.stringify(result), JSON.stringify({ data: [{ id: 1, owner: { name: "Editor" } }] }));
  let blocks: Row[] = [{ uuid: "leaf", bundle: "heading", props: { text: "Nested content" } }];
  for (let level = 0; level < 16; level++)
    blocks = [{ uuid: `container-${level}`, bundle: "container", props: { blocks } }];
  frontend("./shared/editorBlocks.ts").parseEditorBlocks(blocks);
  const draft = { data: { draft_blocks: blocks } };
  assert.equal(
    JSON.stringify(publicEditorJson(draft)),
    JSON.stringify(draft),
    "All valid persisted nesting survives the CMS envelope",
  );
  validateEditorQuery(
    new URLSearchParams({ deep: JSON.stringify({ translations: { _filter: { language: { _eq: "de" } } } }) }),
  );
  validateEditorQuery(
    new URLSearchParams({
      deep: JSON.stringify({
        name: { _limit: 1 },
        translations: { _filter: { name: { _eq: "de" }, length: { _gt: 1 } } },
      }),
    }),
  );
  assert.throws(
    () =>
      validateEditorQuery(
        new URLSearchParams({ deep: JSON.stringify({ translations: { _deep: '{"toString":{"_limit":1}}' } }) }),
      ),
    { statusCode: 400 },
  );
  for (const key of ["__proto__", "constructor", "toString", "valueOf", "map", "call", "safe.toString"])
    assert.throws(() => validateEditorQuery(new URLSearchParams({ deep: `{"${key}":{"_limit":1}}` })), {
      statusCode: 400,
    });
  for (const value of ["{", JSON.stringify(Array(1001).fill(null)), JSON.stringify("a".repeat(33000))])
    assert.throws(() => validateEditorQuery(new URLSearchParams({ deep: value })), { statusCode: 400 });
  assert.throws(() => validateEditorQuery(new URLSearchParams({ access_token: "forged" })), { statusCode: 400 });
  const { validateEditorAssetQuery } = utility("editorAssets.ts");
  validateEditorAssetQuery(new URLSearchParams("width=1200&height=900&quality=75&format=webp&fit=cover"));
  for (const query of [
    "width=20000",
    "width=-1",
    "width=1&width=2",
    "height=NaN",
    "quality=101",
    "transforms=[]",
    "format=html",
    "key=../private",
    "download=%0a",
  ])
    assert.throws(() => validateEditorAssetQuery(new URLSearchParams(query)), { statusCode: 400 });
});

test("editor CMS proxy preserves the personal ACL, strips credentials and headers, restricts routes and protects uploads", async () => {
  const calls: Row[] = [];
  let response: Response;
  let mutation: boolean | undefined;
  const transport = utility("editorTransport.ts");
  const assets = utility("editorAssets.ts");
  const { default: handler, allowedEditorPath } = load(
    "src/frontend/server/api/editor/cms/[...path].ts",
    {
      h3: { ...h3, getRouterParam: (event: Row) => event.route },
      "../../../utils/editorTransport": transport,
      "../../../utils/editorAssets": assets,
      "../../../utils/editorUpstream": {
        editorAccess: async (_event: Row, mutates: boolean) => {
          mutation = mutates;
          return { session: { accessToken: "personal-only", user: { id: "editor" } } };
        },
      },
      "../../../utils/rateLimit": { rateLimit: async () => true },
    },
    {
      Headers,
      Response,
      AbortSignal,
      Uint8Array,
      useRuntimeConfig: () => ({ directusServerUrl: "http://cms" }),
      fetch: async (url: string, init: Row) => {
        calls.push({ url, init });
        return response;
      },
    },
  );
  for (const path of [
    "users",
    "auth/login",
    "settings",
    "items/directus_users",
    "items/pages/../users",
    "assets/%2e",
    "https://evil.org",
    "graphql",
  ])
    assert.equal(allowedEditorPath(path, "GET"), false, path);
  const event = (method: string, route = "items/pages", body = "") => ({
    method,
    route,
    path: `/api/editor/cms/${route}`,
    headers: {},
    node: {
      req: {
        headers: { authorization: "Bearer forged", cookie: "browser=private", "content-type": "application/json" },
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(body);
        },
      },
    },
  });
  response = new Response(JSON.stringify({ data: { id: 1, owner: { token: "private" } } }), {
    headers: { "content-type": "application/json", "set-cookie": "cms-private", location: "http://cms/secret" },
  });
  const result = await handler(event("PATCH", "items/pages/id", '{"name":"Updated"}'));
  assert.equal(mutation, true);
  assert.equal(calls[0].init.headers.get("authorization"), "Bearer personal-only");
  assert.equal(calls[0].init.headers.get("cookie"), null);
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(Buffer.from(calls[0].init.body).toString(), '{"name":"Updated"}');
  assert.equal(result.headers.get("set-cookie"), null);
  assert.equal(result.headers.get("location"), null);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await result.json(), { data: { id: 1, owner: {} } });
  const conflict = event("GET");
  conflict.headers = { "x-slk-editor-user": "other" };
  await assert.rejects(handler(conflict), { statusCode: 409 });
  await assert.rejects(handler(event("PATCH", "items/pages/id", "a".repeat(5 * 1024 * 1024 + 1))), { statusCode: 413 });
  response = new Response(null, { status: 204 });
  assert.equal((await handler(event("DELETE", "items/pages/id"))).status, 204);
  response = new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } });
  const image = await handler(event("GET", "assets/12345678-1234-4234-8234-123456789abc"));
  assert.match(image.headers.get("content-security-policy"), /sandbox/);
});

test("pinned analytics retains normal delivery and drops candidate/preview events across SPA transitions", async () => {
  const { createHash } = await import("node:crypto");
  const { plausibleManifest } = load("src/frontend/shared/plausibleManifest.ts");
  const script = readFileSync(new URL("src/frontend/public" + plausibleManifest.src, root), "utf8");
  assert.equal(plausibleManifest.integrity, "sha384-" + createHash("sha384").update(script).digest("base64"));
  const calls: Row[] = [];
  const location = new URL("https://example.org/public");
  const window: Row = {
    fetch: true,
    localStorage: {},
    navigator: {},
    history: {},
    addEventListener() {},
    innerHeight: 100,
  };
  runInNewContext(script, {
    window,
    location,
    URL,
    URLSearchParams,
    Date,
    console,
    setInterval,
    clearInterval,
    fetch: async (url: string, options: Row) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return { status: 202 };
    },
    document: {
      currentScript: {
        src: "https://example.org" + plausibleManifest.src,
        getAttribute: (name: string) =>
          name === "data-api" ? "https://analytics.example.org/api/event" : "example.org",
      },
      visibilityState: "visible",
      referrer: "",
      documentElement: {},
      addEventListener() {},
      hasFocus: () => true,
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://analytics.example.org/api/event");
  for (const path of [
    "/elections/thesen/private",
    "/elections/thesen#token=secret",
    "/municipalities/test?preview=secret",
    "/public?blokkliPreview=1",
    "/public#access_token=secret",
  ]) {
    location.href = "https://example.org" + path;
    window.plausible("pageview");
  }
  assert.equal(calls.length, 1);
  location.href = "https://example.org/public-again";
  window.plausible("pageview");
  assert.equal(calls.length, 2);
});

test("pinned Directus runtime guards reject inherited deep paths, SQL geometry and oversized transforms without running a CMS", async () => {
  const guards = await import("../../../docker/directus/security-patches/patch-api.js");
  const validateDeep = new Function("deep", "InvalidQueryError", guards.deepGuard);
  validateDeep({ translations: { _filter: { language: { _eq: "de" } } } }, Error);
  validateDeep({ name: { _limit: 1 }, translations: { _filter: { name: { _eq: "de" }, length: { _gt: 1 } } } }, Error);
  for (const key of ["__proto__", "toString", "valueOf", "constructor.prototype", "safe.toString", "map", "call"])
    assert.throws(() => validateDeep(JSON.parse(`{"${key}":{"_limit":1}}`), Error));
  const geometry = new Function("field", guards.geometryGuard);
  for (const type of ["geometry", "geometry.Point", "geometry.MultiPolygon"]) geometry({ type });
  for (const type of ["geometry.bad", "geometry.Point);SELECT pg_sleep(1);--", "geometry.Point.extra"])
    assert.throws(() => geometry({ type }));
  const asset = new Function("transforms", "IllegalAssetTransformationError", guards.assetGuard);
  for (const args of [[1200, 900], [{ width: 4096, height: null }], [null, 900]]) asset([["resize", ...args]], Error);
  for (const args of [[20000, 900], [{ height: 20000 }], ["999999", 1], [NaN, 1], [-1, 1]])
    assert.throws(() => asset([["resize", ...args]], Error));
  assert.throws(() => asset([["extend", { left: 999999 }]], Error));
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "slk-unreviewed-api-"));
  try {
    mkdirSync(join(dir, "dist/utils"), { recursive: true });
    writeFileSync(join(dir, "dist/utils/sanitize-query.js"), "unreviewed");
    assert.throws(() => guards.patchDirectusApi(dir), /Unreviewed Directus source/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("tour media uses private runtime CMS configuration, checks publication and preserves streaming/ranges without build-time env", async () => {
  let reports = true;
  const reads: Row[] = [];
  const requests: Row[] = [];
  const handler = load(
    "src/frontend/server/api/tour-media/[id].get.ts",
    {
      "../../utils/rateLimit": { rateLimit: async () => true },
    },
    {
      ...h3,
      Response,
      Headers,
      getRouterParam: () => "12345678-1234-4234-8234-123456789abc",
      useRuntimeConfig: () => ({
        directusServerUrl: "http://private-cms/",
        directusFrontendServerToken: "server-only",
        public: { serverDirectusUrl: "" },
      }),
      $fetch: async (url: string, options: Row) => {
        reads.push({ url, options });
        return { data: reports ? [{ id: "published-report" }] : [] };
      },
      fetch: async (url: string, options: Row) => {
        requests.push({ url, options });
        return new Response("image-bytes", {
          status: 206,
          headers: {
            "content-type": "image/png",
            "content-range": "bytes 0-10/11",
            "accept-ranges": "bytes",
            "set-cookie": "private-upstream",
          },
        });
      },
    },
  ).default;
  const event = {
    path: "/api/tour-media/12345678-1234-4234-8234-123456789abc?width=900",
    node: { req: { headers: { range: "bytes=0-10" } } },
  };
  const response = await handler(event);
  assert.equal(reads[0].url, "http://private-cms/items/success_project_tour_stops");
  assert.match(reads[0].options.query.filter, /"report_status":\{"_eq":"published"\}/);
  assert.equal(requests[0].url, "http://private-cms/assets/12345678-1234-4234-8234-123456789abc?width=900");
  assert.equal(requests[0].options.headers.Authorization, "Bearer server-only");
  assert.equal(requests[0].options.headers.Range, "bytes=0-10");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 0-10/11");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(await response.text(), "image-bytes");
  reports = false;
  await assert.rejects(handler(event), { statusCode: 404 });
  assert.equal(requests.length, 1, "Unpublished media must never be fetched");
});

test("PDF report data refuses unpublished/incomplete assessments and reads only public catalog ratings", async () => {
  const extension = load(
    "src/directus/extensions/endpoint-pdf-service/src/index.ts",
    {
      "./filename.ts": pdfFilename,
      "html-to-text": { convert: (value: unknown) => value },
    },
    {},
    "\nexports.fetchReportDataForTest = fetchReportData;",
  );
  const score = {
    published: true,
    percentage_rated: 100,
    catalog_version: { hidden: false },
    municipality: { status: "published", localteam_id: "team" },
  };
  const commands: Row[] = [];
  class ItemsService {
    constructor(readonly collection: string) {}
    async readByQuery(query: Row) {
      commands.push({ collection: this.collection, query });
      if (this.collection === "municipality_scores") return [score];
      if (this.collection === "measures") return [{ id: "measure", sector: "energy" }];
      return [{ measure_id: "measure", rating: 1, applicable: true, date_updated: "2026-01-01" }];
    }
  }
  const read = () =>
    extension.fetchReportDataForTest(
      { params: { slug: "town", version: "v2026" }, accountability: { admin: false } },
      {},
      ItemsService,
    );
  await read();
  const ratings = commands.find((command) => command.collection === "ratings_measures")!.query;
  assert.equal(ratings.filter.status._eq, "published");
  assert.equal(ratings.filter.approved._eq, true);
  assert.equal(ratings.filter.measure_id.catalog_version.name._eq, "v2026");
  assert.equal(ratings.fields.includes("*"), false);
  assert.equal(ratings.limit, 501);
  score.published = false;
  await assert.rejects(read(), { status: 404 });
  score.published = true;
  score.percentage_rated = 99;
  await assert.rejects(read(), { status: 404 });
  score.percentage_rated = 100;
  score.municipality.status = "draft";
  await assert.rejects(read(), { status: 404 });
  score.municipality.status = "published";
  score.catalog_version.hidden = true;
  await assert.rejects(read(), { status: 404 });
});
