import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { GeoFeatureSchema } from "../../../src/frontend/shared/contracts/geometry.js";
import type { CollectionItems } from "../../../src/frontend/utils/collectionItems.js";

const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
type Fetcher = (input: URL, options: RequestInit) => Promise<Response>;
function load(fetcher: Fetcher) {
  const source = readFileSync(new URL("../../../src/frontend/utils/collectionItems.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    URL,
    AbortSignal,
    fetch: fetcher,
    window: { location: { origin: "https://site.test" } },
    require: (id: string) => {
      if (id === "zod") return frontend("zod");
      if (id === "~/shared/contracts/geometry") return { GeoFeatureSchema };
      if (id === "~/shared/visualizationSafety") return { visualizationUrl: (value: string) => value };
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return module.exports as { fetchCollectionItems(input: string, signal?: AbortSignal): Promise<CollectionItems> };
}
const feature = (id: number) => ({
  type: "Feature",
  id,
  geometry: { type: "Point", coordinates: [8, 49] },
  properties: {},
});
const input = "/api/stadtlandzahl/api/collections/solar-plants/items/?area=081110000000&no_page=1";

test("point maps follow OGC next links beyond the unpaged energy limit", async () => {
  const calls: number[] = [];
  const { fetchCollectionItems } = load(async (url, options) => {
    assert.equal(url.searchParams.has("no_page"), false);
    assert.equal(url.searchParams.get("limit"), "1000");
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    const offset = Number(url.searchParams.get("offset") ?? 0);
    calls.push(offset);
    const count = Math.min(1000, 5001 - offset);
    const next = new URL(url);
    next.searchParams.set("offset", String(offset + count));
    return Response.json({
      type: "FeatureCollection",
      numberMatched: 5001,
      features: Array.from({ length: count }, (_, index) => feature(offset + index)),
      links: offset + count < 5001 ? [{ rel: "next", href: next.href }] : [],
    });
  });
  const result = await fetchCollectionItems(input);
  assert.equal(result.features.length, 5001);
  assert.equal(result.numberReturned, 5001);
  assert.deepEqual(calls, [0, 1000, 2000, 3000, 4000, 5000]);
  assert.equal(result.next, null);
});

for (const href of [
  "https://other.test/api/stadtlandzahl/api/collections/solar-plants/items/?area=081110000000",
  "/api/stadtlandzahl/api/collections/wind-turbines/items/?area=081110000000",
  "/api/stadtlandzahl/api/collections/solar-plants/items/?area=091110000000",
  "/api/stadtlandzahl/api/collections/solar-plants/items/?area=081110000000&limit=1000",
]) {
  test(`pagination refuses changed scope or loops: ${href}`, async () => {
    const { fetchCollectionItems } = load(async () =>
      Response.json({
        type: "FeatureCollection",
        features: [feature(1)],
        links: [{ rel: "next", href }],
      }),
    );
    await assert.rejects(fetchCollectionItems(input), /Invalid collection pagination link/);
  });
}

test("failed later pages reject the load instead of presenting a complete-looking partial map", async () => {
  let calls = 0;
  const { fetchCollectionItems } = load(async (url) => {
    if (++calls > 1) return new Response("unavailable", { status: 503 });
    const next = new URL(url);
    next.searchParams.set("offset", "1000");
    return Response.json({ type: "FeatureCollection", features: [feature(1)], next: next.href });
  });
  await assert.rejects(fetchCollectionItems(input), /HTTP 503/);
});
