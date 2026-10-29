import { loggingModule } from "./lib/loggingModules.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import ts from "typescript";
import { runInNewContext } from "node:vm";
import { checkTypeCoverage } from "../../../src/frontend/scripts/check-type-coverage.mjs";
import { directusErrorDetails, requestErrorStatus } from "../../../src/frontend/shared/requestError.js";
import {
  buildArticleDoc,
  buildBlockDoc,
  buildMemberDoc,
  buildMeasureDoc,
  extractBlockText,
} from "../../../src/frontend/server/utils/extractContent.js";

const root = new URL("../../../", import.meta.url);

test("coverage gate rejects unchecked JS, JavaScript Vue scripts and weakened compiler options", () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-type-coverage-"));
  const options = {
    strict: true,
    allowJs: false,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
  };
  try {
    mkdirSync(join(directory, ".nuxt"));
    mkdirSync(join(directory, "scripts"));
    for (const context of ["app", "server", "shared", "node"]) {
      writeFileSync(
        join(directory, ".nuxt", `tsconfig.${context}.json`),
        JSON.stringify({
          compilerOptions: options,
          vueCompilerOptions: { strictTemplates: true, checkUnknownEvents: true },
          include: ["../*.ts", "../*.vue"],
        }),
      );
    }
    writeFileSync(
      join(directory, "scripts/tsconfig.json"),
      JSON.stringify({ compilerOptions: options, include: ["../*.ts"] }),
    );
    writeFileSync(
      join(directory, "tsconfig.tooling.json"),
      JSON.stringify({ compilerOptions: { ...options, allowJs: true, checkJs: true }, include: ["tooling.js"] }),
    );
    writeFileSync(join(directory, "app.ts"), "export const ok = true;");
    writeFileSync(join(directory, "tooling.js"), "module.exports = {};");
    writeFileSync(join(directory, "app.vue"), '<script setup lang="ts">const ok = true;</script>');
    assert.equal(checkTypeCoverage(directory), 3);
    writeFileSync(join(directory, "unchecked.js"), "module.exports = {};");
    assert.throws(() => checkTypeCoverage(directory), /Unchecked sources:\nunchecked.js/);
    rmSync(join(directory, "unchecked.js"));
    writeFileSync(join(directory, "unchecked.jsx"), "export default <main />;");
    assert.throws(() => checkTypeCoverage(directory), /Unchecked sources:\nunchecked.jsx/);
    rmSync(join(directory, "unchecked.jsx"));
    writeFileSync(join(directory, "app.vue"), "<script setup>const ok = true;</script>");
    assert.throws(() => checkTypeCoverage(directory), /Unchecked Vue script/);
    writeFileSync(join(directory, "app.vue"), "<template><main /></template>");
    writeFileSync(
      join(directory, ".nuxt/tsconfig.server.json"),
      JSON.stringify({ compilerOptions: { ...options, exactOptionalPropertyTypes: false }, include: ["../*.ts"] }),
    );
    assert.throws(() => checkTypeCoverage(directory), /must enable exactOptionalPropertyTypes/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("release commands enforce the whole gate and expose translation sources read-only", () => {
  const pkg = JSON.parse(readFileSync(new URL("src/frontend/package.json", root), "utf8"));
  assert.equal(pkg.scripts.prebuild, "npm run typecheck");
  assert.equal(pkg.scripts.pregenerate, "npm run typecheck");
  for (const check of [
    "translations:check",
    "typecheck:coverage",
    "lint:types",
    "typecheck:scripts",
    "typecheck:tooling",
  ])
    assert.ok(pkg.scripts.typecheck.includes(check));
  assert.match(pkg.scripts["lint:types"], /\*\*\/\*\.vue/);
  assert.equal(pkg.scripts["typecheck:baseline"], undefined);
  assert.match(
    readFileSync(new URL("docker-compose.yaml", root), "utf8"),
    /src\/directus\/translations:\/directus\/translations:ro/,
  );
  assert.match(readFileSync(new URL("src/frontend/nuxt.config.ts", root), "utf8"), /typeCheck: "build"/);
});

test("strict compiler settings reject optional undefined, unchecked indexing, missing returns and fallthrough", () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-strict-probe-"));
  try {
    const file = join(directory, "probe.ts");
    writeFileSync(
      file,
      `export {}; const value: {label?: string} = {label: undefined};
const items: string[] = []; items[0].toUpperCase();
function incomplete(input: boolean) { if(input) return 1; }
function branch(input: number) {switch(input) {case 0: console.log(input); case 1: break;}}
`,
    );
    const program = ts.createProgram([file], {
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      noEmit: true,
      types: [],
      skipLibCheck: true,
    });
    const codes = new Set(ts.getPreEmitDiagnostics(program).map((diagnostic) => diagnostic.code));
    for (const code of [2375, 2532, 7030, 7029]) assert.ok(codes.has(code), `Missing strict diagnostic ${code}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("search document builders preserve valid content and refuse malformed external values", () => {
  assert.equal(
    buildArticleDoc({
      slug: "story",
      status: "published",
      title: "Story",
      abstract: "**Useful**",
      article_text: "Text",
    })?.url,
    "/projects/story",
  );
  assert.equal(
    buildBlockDoc(
      { uuid: "b", entity_uuid: "page-id", bundle: "heading", props: { text: "Title" } },
      "Page",
      "",
      "page-slug",
    )?.url,
    "/page-slug#block-b",
  );
  assert.equal(
    buildMeasureDoc({ slug: "solar", name: "Solar", description: "<p>Energy</p>", status: "published" }, "v2")?.text,
    "Energy",
  );
  assert.equal(buildMemberDoc({ id: "u", first_name: "Ada", show_on_team_page: true })?.title, "Ada");
  assert.equal(buildMemberDoc({ id: "u", first_name: "Ada", show_on_team_page: false }), null);
  for (const input of [null, [], { title: {} }, { status: "published", slug: 42 }])
    assert.equal(buildArticleDoc(input), null);
  assert.equal(buildBlockDoc({ uuid: "b", entity_uuid: "p", bundle: "heading", props: [] }, "Page"), null);
  assert.equal(extractBlockText("hero", { title: { private: true }, subtitle: "Valid" }), "Valid");
});

test("Directus error narrowing handles transport variants without trusting malformed exceptions", () => {
  for (const response of [
    { data: { errors: [{ extensions: { code: "RECORD_NOT_UNIQUE" }, message: "email exists" }] } },
    { response: { _data: { errors: [{ extensions: { code: "RECORD_NOT_UNIQUE" }, message: "email exists" }] } } },
  ]) {
    assert.equal(directusErrorDetails(response)[0]?.code, "RECORD_NOT_UNIQUE");
  }
  for (const input of [null, "error", { data: { errors: { private: true } } }])
    assert.deepEqual(directusErrorDetails(input), []);
  assert.equal(directusErrorDetails({ data: { errors: [null, { message: { private: true } }] } })[1]?.message, "");
  assert.equal(requestErrorStatus({ response: { status: 403 } }), 403);
});

test("StadtLandZahl proxy forwards Node request bytes while replacing credentials and rewriting responses", async () => {
  const source = readFileSync(new URL("src/frontend/server/api/stadtlandzahl/[...path].ts", root), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} as { default: (event: unknown) => Promise<Response> } };
  const requests: { url: string; init: RequestInit }[] = [];
  runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    Headers,
    Response,
    URL,
    Buffer,
    Uint8Array,
    require: (id: string) => {
      const logging = loggingModule(id);
      if (logging) return logging;
      assert.equal(id, "../../utils/rateLimit");
      return { rateLimit: async () => true };
    },
    createError: (options: object) => Object.assign(new Error("Rejected proxy request"), options),
    defineEventHandler: (handler: unknown) => handler,
    getStadtlandzahlAuthorization: () => "Basic upstream-fixture",
    getStadtlandzahlBaseUrls: () => [new URL("https://upstream.example.org")],
    resolveStadtlandzahlUrl: (path: string, _query: unknown, base: URL) => new URL(path, base),
    rewriteStadtlandzahlUrl: (url: string) => url.replace("https://upstream.example.org", "/api/stadtlandzahl"),
    rewriteStadtlandzahlPayload: (value: unknown) => value,
    fetch: async (url: URL, init: RequestInit) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({ results: [{ id: "ok" }] }), {
        headers: {
          "content-type": "application/json",
          "set-cookie": "private",
          location: "https://upstream.example.org/next",
        },
      });
    },
  });
  const response = await module.exports.default({
    method: "POST",
    path: "/api/stadtlandzahl/api/render/?format=json",
    node: {
      req: {
        headers: {
          authorization: "Bearer browser",
          cookie: "session=browser",
          host: "frontend.local",
          accept: "application/json",
          "x-request-id": ["a", "b"],
        },
        async *[Symbol.asyncIterator]() {
          yield Buffer.from('{"value":');
          yield Buffer.from("42}");
        },
      },
    },
  });
  assert.equal(requests[0]?.url, "https://upstream.example.org/api/render/?format=json");
  const headers = new Headers(requests[0]?.init.headers);
  assert.equal(headers.get("authorization"), "Basic upstream-fixture");
  assert.equal(headers.get("cookie"), null);
  assert.equal(headers.get("host"), null);
  assert.equal(headers.get("accept-encoding"), "gzip");
  assert.equal(Buffer.from(requests[0]?.init.body as Uint8Array).toString(), '{"value":42}');
  assert.equal(requests[0]?.init.redirect, "manual");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("location"), "/api/stadtlandzahl/next");
  assert.deepEqual(await response.json(), { results: [{ id: "ok" }] });
});
