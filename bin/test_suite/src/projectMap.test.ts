import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as projectMap from "../../../src/frontend/shared/projectMap.js";
import { ProjectListSchema } from "../../../src/frontend/shared/contracts/content.js";
import { pointLatLng } from "../../../src/frontend/shared/tour.js";
const point = (longitude: number, latitude: number) => ({
  type: "Point" as const,
  coordinates: [longitude, latitude] as [number, number],
});
const town = (
  id: string,
  name: string,
  state: string,
  geolocation = point(13.4, 52.5),
): projectMap.ProjectMunicipality => ({ id, name, state, geolocation });

test("a project point takes precedence over a linked municipality and is never swapped to latitude/longitude in GeoJSON", () => {
  const location = projectMap.resolveProjectLocation(
    { geolocation: point(10, 50), municipality: town("a", "Berlin", "Berlin") },
    [],
  );
  assert.deepEqual(location, { geolocation: point(10, 50), source: "project", municipality_name: "Berlin" });
  assert.deepEqual(pointLatLng(location?.geolocation), [50, 10]);
});

test("linked municipality centres take precedence over textual names and invalid links do not guess a different town", () => {
  const linked = town("a", "Augsburg", "Bayern");
  const directory = [town("b", "Berlin", "Berlin")];
  const result = projectMap.resolveProjectLocation(
    { municipality: linked, municipality_name: "Berlin", state: "Berlin" },
    directory,
  );
  assert.equal(result?.municipality_name, "Augsburg");
  assert.equal(result?.source, "municipality");
  assert.equal(
    projectMap.resolveProjectLocation(
      { municipality: { ...linked, geolocation: null }, municipality_name: "Berlin" },
      directory,
    ),
    null,
  );
});

test("name/state fallback is case/whitespace/Unicode aware and refuses partial, state-only and ambiguous matches", () => {
  const directory = [town("a", "Neustadt", "Bayern"), town("b", "Neustadt", "Sachsen"), town("c", "München", "Bayern")];
  assert.equal(
    projectMap.resolveProjectLocation({ municipality_name: " neustadt ", state: " bAYERN " }, directory)
      ?.municipality_name,
    "Neustadt",
  );
  assert.equal(
    projectMap.resolveProjectLocation({ municipality_name: "Mu\u0308nchen", state: "Bayern" }, directory)
      ?.municipality_name,
    "München",
  );
  assert.equal(projectMap.resolveProjectLocation({ municipality_name: "Neustadt" }, directory), null);
  assert.equal(projectMap.resolveProjectLocation({ municipality_name: "Neustadt", state: "Hessen" }, directory), null);
  assert.equal(projectMap.resolveProjectLocation({ municipality_name: "Münch" }, directory), null);
  assert.equal(projectMap.resolveProjectLocation({ state: "Bayern" }, directory), null);
  assert.equal(
    projectMap.resolveProjectLocation({ municipality_name: "München" }, [...directory, directory[2]!])
      ?.municipality_name,
    "München",
  );
});

test("invalid or missing geometry does not remove the project and never becomes a map marker", () => {
  for (const geometry of [
    point(200, 50),
    point(10, 91),
    point(NaN, 50),
    point(Infinity, 50),
    { type: "LineString", coordinates: [[10, 50]] },
    { type: "Point", coordinates: ["10", "50"] },
  ]) {
    const parsed = ProjectListSchema.parse(article({ geolocation: geometry }));
    assert.equal(parsed.geolocation, null);
    assert.equal(projectMap.resolveProjectLocation(parsed, []), null);
  }
});

test("all projects sharing a point remain in one popup, while filtered/missing points do not produce phantom markers", () => {
  const location = { geolocation: point(10, 50), source: "project" as const, municipality_name: "" };
  const projects = [
    { id: 1, slug: "one", title: "One", label: "Solarpark", location },
    { id: 2, slug: "two", title: "Two", label: "Windpark", location },
  ];
  const groups = projectMap.groupProjectLocations(projects);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.projects.length, 2);
  assert.equal(projectMap.groupProjectLocations(projects.slice(1))[0]?.projects[0]?.id, 2);
  assert.equal(projectMap.groupProjectLocations([]).length, 0);
});

function article(extra: Record<string, unknown> = {}) {
  return {
    id: 1,
    slug: "test-project",
    title: "Test project",
    municipality: null,
    organisation: null,
    measures: null,
    sectors: null,
    public_impact_effects: null,
    can_do_autonomously: null,
    is_profitable: null,
    ...extra,
  };
}
const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
async function endpoint(articles: unknown[], municipalities: unknown[]) {
  const file = new URL("../../../src/frontend/server/api/public/articles.get.ts", import.meta.url);
  const module = { exports: {} as { default(event: unknown): Promise<{ articles: Record<string, any>[] }> } };
  const requests: { collection: string; query: Record<string, any> }[] = [];
  const dependencies: Record<string, unknown> = {
    "~/shared/projectMap": projectMap,
    "~/shared/tour": { pointLatLng },
    "~/shared/contracts/content": { ProjectListSchema },
    "~/server/utils/cmsValue": { cmsRows: (rows: unknown) => rows },
    "~/server/utils/parseCms": {
      parseCms: (schema: { parse(value: unknown): unknown }, value: unknown) => schema.parse(value),
    },
    "~/server/utils/publicQuery": { queryText: () => undefined, queryLimit: () => -1, queryChoice: () => undefined },
    "../../utils/directusServerClient": {
      createDirectusServerClient: () => ({
        request: async (request: { collection: string; query: Record<string, any> }) => {
          requests.push(request);
          return request.collection === "articles" ? articles : municipalities;
        },
      }),
    },
    "@directus/sdk": { readItems: (collection: string, query: unknown) => ({ collection, query }) },
    h3: { defineEventHandler: (handler: unknown) => handler, setResponseHeader() {}, getQuery: () => ({}) },
  };
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (name: string) => (name in dependencies ? dependencies[name] : frontend(name)),
    },
  );
  return { result: await module.exports.default({}), requests };
}

test("the checked public API selects only published data, resolves unlinked towns and excludes extra CMS fields", async () => {
  const { result, requests } = await endpoint(
    [article({ municipality_name: "Berlin", secret: "not-public@example.org" })],
    [town("a", "Berlin", "Berlin")],
  );
  assert.equal(result.articles[0]?.map_location.source, "municipality");
  assert.ok(!JSON.stringify(result).includes("not-public@example.org"));
  assert.equal(requests[0]?.query.filter.status._eq, "published");
  assert.equal(requests[1]?.query.filter.status._eq, "published");
  assert.deepEqual(Array.from(requests[1]?.query.fields ?? []), ["id", "name", "state", "geolocation"]);
  assert.ok(requests[0]?.query.fields.includes("geolocation") && requests[0]?.query.fields.includes("location_label"));
});

test("explicit project points do not trigger a municipality-directory read", async () => {
  const { result, requests } = await endpoint(
    [article({ geolocation: point(10, 50), municipality_name: "Unknown town" })],
    [],
  );
  assert.equal(requests.length, 1);
  assert.equal(result.articles[0]?.map_location.source, "project");
});
