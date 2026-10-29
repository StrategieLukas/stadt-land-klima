import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = new URL("../../../src/frontend/", import.meta.url);
const require = createRequire(new URL("package.json", root));
type Row = Record<string, any>;
function load(path: string, dependencies: Row = {}, globals: Row = {}): Row {
  const url = new URL(path, root);
  const source = readFileSync(url, "utf8").replaceAll("import.meta.url", JSON.stringify(url.href));
  const module = { exports: {} };
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    {
      module,
      exports: module.exports,
      URL,
      structuredClone,
      process: { env: { SLK_ENV: "production" } },
      require: (id: string) => (id in dependencies ? dependencies[id] : require(id)),
      ...globals,
    },
  );
  return module.exports;
}

test("Wahlcheck partner framing is scoped to embed routes and retains the full nonce policy", async () => {
  const config = load(
    "nuxt.config.ts",
    {
      "@tailwindcss/vite": () => ({}),
      "./shared/serviceUrl": { resolveSiteOrigin: () => "https://site.example" },
      "./scripts/securityStyles.mts": { staticIconStyleHashes: () => [] },
    },
    { defineNuxtConfig: (value: unknown) => value },
  ).default;
  const prefix = "node_modules/nuxt-security/dist/";
  const merge = require(new URL(prefix + "utils/merge.mjs", root).pathname);
  const headers = require(new URL(prefix + "utils/headers.mjs", root).pathname);
  const context = load(prefix + "runtime/nitro/context/index.js", { "../../../utils/merge": merge });
  const plugin = load(prefix + "runtime/nitro/plugins/00-routeRules.js", {
    "nitropack/runtime": {
      defineNitroPlugin: (fn: unknown) => fn,
      useRuntimeConfig: () => ({ security: config.security, nitro: { routeRules: config.routeRules } }),
    },
    "../context/index.js": context,
    "../../../utils/merge": merge,
    "../../../utils/headers": headers,
  });
  await plugin.default({ hooks: { hook() {}, callHook: async () => {} } });
  const rules = (path: string) => context.resolveSecurityRules({ path, context: {} });
  const allowed = [
    "'self'",
    "https://localzero.net",
    "https://www.localzero.net",
    "https://germanzero.de",
    "https://www.germanzero.de",
  ];
  for (const path of ["/embed/wahlcheck/example", "/embed/wahlcheck/example?answers=1"]) {
    const resolved = rules(path);
    assert.equal(resolved.enabled, true);
    assert.deepEqual(Array.from(resolved.headers.contentSecurityPolicy["frame-ancestors"]), allowed);
    assert.ok(resolved.headers.contentSecurityPolicy["script-src"].includes("'nonce-{{nonce}}'"));
    assert.ok(resolved.headers.contentSecurityPolicy["script-src"].includes("'strict-dynamic'"));
    assert.deepEqual(Array.from(resolved.headers.contentSecurityPolicy["object-src"]), ["'none'"]);
  }
  for (const path of [
    "/",
    "/elections/wahlcheck/example",
    "/elections/thesen/private",
    "/backend/admin",
    "/embed/wahlcheck-other/example",
    "/embed/other/example",
    "/embed/wahlcheck/example/other",
  ]) {
    assert.deepEqual(Array.from(rules(path).headers.contentSecurityPolicy["frame-ancestors"]), ["'self'"], path);
  }
});
