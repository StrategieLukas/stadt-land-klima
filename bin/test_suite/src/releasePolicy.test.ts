import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { assertReleasePolicy } from "./lib/releasePolicy.js";
const require = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
const { parse } = require("yaml") as { parse: (value: string) => Record<string, any> };
const root = new URL("../../../", import.meta.url);
const base = parse(readFileSync(new URL("docker-compose.yaml", root), "utf8"));
const prod = parse(readFileSync(new URL("docker-compose.prod.yaml", root), "utf8"));
test("production configuration retains the controls required by pinned-runtime security dispositions", () =>
  assertReleasePolicy(base, prod));
test("release review rejects accidentally enabled vulnerable surfaces or public service listeners", () => {
  for (const key of ["CACHE_ENABLED", "TUS_ENABLED", "WEBSOCKETS_ENABLED", "MCP_ENABLED"]) {
    const drift = structuredClone(prod);
    drift.services.directus.environment[key] = "true";
    assert.throws(() => assertReleasePolicy(base, drift), new RegExp(key));
  }
  const drift = structuredClone(prod);
  drift.services.frontend.ports = ["9000:3000"];
  assert.throws(() => assertReleasePolicy(base, drift), /loopback/);
});
