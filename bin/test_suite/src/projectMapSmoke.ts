import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createAdminClient, DirectusClient } from "./lib/directus.js";
import { parseEnvFile } from "./lib/config.js";
import { launchBrowser, waitForHydration } from "./lib/browser.js";
import { waitFor } from "./lib/wait.js";
import { PNG_1X1 } from "./lib/images.js";
import { ProjectMunicipalitySchema } from "../../../src/frontend/shared/projectMap.js";
import { ProjectListSchema } from "../../../src/frontend/shared/contracts/content.js";

const base = new URL(process.argv[2] ?? "http://localhost:8082").origin;
const backend = new URL(process.argv[3] ?? "http://localhost:8081").origin;
assert.ok(
  [base, backend].every((url) => ["localhost", "127.0.0.1"].includes(new URL(url).hostname)),
  "Disposable map fixtures require local services",
);
const env = parseEnvFile(process.argv[4] ?? "../../src/directus/.env");
const admin = await createAdminClient(backend, env);
const suffix = randomBytes(5).toString("hex");
const name = `Kartenprojekt ${suffix}`;
const prefix = `map-${suffix}`;
const articles: number[] = [];
let editorId: string | undefined;
let imageId: string | undefined;
const browser = await launchBrowser(true);
const point = (lng: number, lat: number) => ({ type: "Point", coordinates: [lng, lat] });
try {
  // Existing published geography is read-only; article fixtures never alter real municipality records.
  const directory = ProjectMunicipalitySchema.array().parse(
    await admin.readItems("municipalities", {
      filter: { status: { _eq: "published" } },
      fields: ["id", "name", "state", "geolocation"],
      limit: -1,
    }),
  );
  const town = directory.find(
    (candidate) =>
      candidate.geolocation &&
      candidate.state &&
      candidate.geolocation.coordinates.join(",") !== "10,50" &&
      directory.filter((other) => other.name === candidate.name && other.state === candidate.state).length === 1,
  );
  assert.ok(
    town?.geolocation && town.state,
    "Map acceptance requires one seeded published municipality with a geographic point",
  );
  imageId = (await admin.uploadFile<{ id: string }>(`${prefix}.png`, "image/png", PNG_1X1, prefix)).id;
  const articleDefaults = {
    image: imageId,
    image_credits: "Test fixture",
    author: "Map fixture",
    sectors: ["Strom"],
    profile_stage: "complete",
    abstract: "Klimaschutzprojekt",
    article_text: "Klimaschutz vor Ort",
  };
  const descriptions = [
    {
      title: `Solarprojekt ${suffix}`,
      geolocation: point(10, 50),
      location_label: "Solarpark",
      state: town.state === "Bayern" ? "Sachsen" : "Bayern",
    },
    {
      title: `Windprojekt ${suffix}`,
      geolocation: point(10, 50),
      location_label: "Windpark",
      state: town.state === "Bayern" ? "Sachsen" : "Bayern",
    },
    { title: `Kommunenprojekt ${suffix}`, municipality: town.id, state: town.state },
    { title: `Namensprojekt ${suffix}`, municipality_name: town.name, state: town.state },
    { title: `Ohne Standort ${suffix}`, state: null },
    { title: `Privater Entwurf ${suffix}`, status: "draft", geolocation: point(1, 2) },
  ];
  for (const [index, description] of descriptions.entries()) {
    const article = await admin.createItem<{ id: number }>("articles", {
      ...articleDefaults,
      slug: `${prefix}-project-${index}`,
      status: "published",
      municipality_name: name,
      abstract: "Klimaschutzprojekt",
      article_text: "Klimaschutz vor Ort",
      ...description,
    });
    articles.push(article.id);
  }
  const response = await fetch(`${base}/api/public/articles?municipality=${encodeURIComponent(name)}`);
  assert.equal(response.status, 200);
  const data: { articles?: unknown } = await response.json();
  const publicProjects = ProjectListSchema.array().parse(data.articles);
  assert.equal(publicProjects.length, 4);
  assert.ok(!publicProjects.some((project) => project.id === articles[5]));
  assert.deepEqual(
    publicProjects.find((project) => project.id === articles[0])?.map_location?.geolocation.coordinates,
    [10, 50],
  );
  assert.equal(publicProjects.find((project) => project.id === articles[2])?.map_location?.source, "municipality");
  const namedResponse: { articles?: unknown } = await (
    await fetch(`${base}/api/public/articles?municipality=${encodeURIComponent(town.name)}`)
  ).json();
  const named = ProjectListSchema.array()
    .parse(namedResponse.articles)
    .find((project) => project.id === articles[3]);
  assert.deepEqual(named?.map_location?.geolocation.coordinates, town.geolocation.coordinates);
  assert.equal(publicProjects.find((project) => project.id === articles[4])?.map_location, null);
  console.log("PASS public DTO: own points, linked/name-state fallback, ambiguous locations and draft exclusion");

  const pointField = await admin.request<{ meta: { interface: string } }>("GET", "/fields/articles/geolocation");
  const labelField = await admin.request<{ meta: { options: { trim: boolean } } }>(
    "GET",
    "/fields/articles/location_label",
  );
  assert.equal(pointField.meta.interface, "map");
  assert.equal(labelField.meta.options.trim, true);
  const roles = await admin.request<{ id: string; name: string }[]>("GET", "/roles");
  const policies = await admin.request<{ id: string; name: string }[]>("GET", "/policies");
  const basic = roles.find((role) => role.name === "MinimalUser")!;
  const contributor = policies.find((policy) => policy.name === "Erfolgsprojekte-Contributor")!;
  assert.ok(basic && contributor);
  const password = `Aa1!${randomBytes(18).toString("base64url")}`;
  const email = `${prefix}@example.org`;
  const editor = await admin.createUser<{ id: string }>({
    email,
    password,
    first_name: "Map",
    last_name: "Fixture",
    role: basic.id,
    policies: [{ policy: contributor.id }],
    status: "active",
  });
  editorId = editor.id;
  const personal = new DirectusClient(backend);
  await personal.login(email, password);
  const agreements = await admin.readItems<{ id: string }>("agreement_versions", {
    filter: { isCurrentVersion: { _eq: true }, type: { _in: ["terms_of_service", "data_protection"] } },
    fields: ["id"],
    limit: -1,
  });
  assert.equal(agreements.length, 2);
  for (const agreement of agreements)
    await admin.createItem("user_consent", { user_id: editor.id, consent_target: agreement.id });
  const own = await personal.createItem<{ id: number }>("articles", {
    ...articleDefaults,
    title: `Eigener Entwurf ${suffix}`,
    slug: `${prefix}-editor-draft`,
    geolocation: point(12, 50),
    location_label: "Standort",
  });
  articles.push(own.id);
  await personal.updateItem("articles", own.id, { geolocation: point(12.1, 50.1), location_label: "Neuer Standort" });
  const saved = await admin.readItem<{ geolocation: { coordinates: number[] }; status: string }>("articles", own.id, [
    "geolocation",
    "status",
  ]);
  assert.deepEqual(saved.geolocation.coordinates, [12.1, 50.1]);
  assert.equal(saved.status, "draft");
  console.log("PASS installed map interface and contributor ownership-preserving geodata writes");

  const context = await browser.newContext({
    locale: "de-DE",
    viewport: { width: 1360, height: 1000 },
    serviceWorkers: "block",
  });
  await context.route("**/api/carto-basemap?**", (route) =>
    route.fulfill({ contentType: "image/png", body: Buffer.from(PNG_1X1) }),
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/projects?view=map&municipality=${encodeURIComponent(name)}`);
  await waitForHydration(page);
  await page.locator(".leaflet-container").waitFor();
  await page.locator(".leaflet-container").scrollIntoViewIfNeeded();
  await waitFor("two grouped map markers", async () => (await page.locator(".project-map-icon").count()) === 2);
  assert.ok(
    (await page.getByRole("status").allTextContents()).some((text) =>
      text.includes("Erfolgsprojekte auf der Karte: 3 / 4"),
    ),
  );
  assert.ok(
    (await page.getByRole("status").allTextContents()).some((text) =>
      text.includes("Erfolgsprojekte ohne eindeutigen Standort: 1."),
    ),
  );
  await page
    .locator(".project-map-icon")
    .filter({ has: page.locator(".project-map-count") })
    .click();
  const popup = page.locator(".leaflet-popup-content");
  await popup.getByRole("link", { name: `Solarprojekt ${suffix}` }).waitFor();
  assert.equal(await popup.locator('a[href^="/projects/"]').count(), 2);
  assert.ok((await popup.innerText()).includes("Solarpark") && (await popup.innerText()).includes("Windpark"));
  assert.ok((await popup.innerText()).includes("Projektstandort"));
  await waitFor("popup within map", async () =>
    page.locator(".leaflet-popup").evaluate((popup) => {
      const bounds = popup.getBoundingClientRect();
      const map = popup.closest(".leaflet-container")!.getBoundingClientRect();
      return bounds.top >= map.top && bounds.bottom <= map.bottom;
    }),
  );
  const light = await page
    .locator(".leaflet-popup-content-wrapper")
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "staedteChallengeDark";
  });
  const dark = await page
    .locator(".leaflet-popup-content-wrapper")
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  assert.notEqual(light, dark, "Popup follows the active theme");
  const popupSize = await popup.boundingBox();
  assert.ok(popupSize && popupSize.width <= 300 && popupSize.height <= 260, "Popup remains compact");
  await page.screenshot({ path: "/tmp/slk-project-map-dark.png" });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "staedteChallemgeTheme";
  });
  await page.screenshot({ path: "/tmp/slk-project-map-desktop.png" });
  await page.locator(".leaflet-popup-close-button").click();
  await popup.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Alle Bundesländer", exact: true }).click();
  await page.getByRole("button", { name: town.state!, exact: true }).click();
  await waitFor("state-filtered map marker", async () => (await page.locator(".project-map-icon").count()) === 1);
  await page.locator(".project-map-icon").click();
  await popup.getByText("Kommunenmitte (ungefähr)", { exact: true }).waitFor();
  await page.getByRole("button", { name: town.state!, exact: true }).click();
  await page.getByRole("button", { name: "Alle Bundesländer", exact: true }).click();
  await page.getByRole("radio", { name: "Liste", exact: true }).click();
  await page.getByText(`Ohne Standort ${suffix}`, { exact: true }).waitFor();
  assert.ok(new URL(page.url()).searchParams.get("municipality") === name);
  assert.equal(await page.locator(".leaflet-container").count(), 0);
  console.log("PASS desktop markers, grouped popups, location precision, state filtering and list parity");

  await page.setViewportSize({ width: 375, height: 812 });
  const view = page.getByRole("radiogroup", { name: "Ansicht der Erfolgsprojekte" });
  const mapButton = view.getByRole("radio", { name: "Karte", exact: true });
  assert.equal(await mapButton.isVisible(), true, "Map switch remains outside collapsed phone filters");
  await mapButton.click();
  await waitFor("phone map markers", async () => (await page.locator(".project-map-icon").count()) === 2);
  assert.equal(await mapButton.getAttribute("aria-checked"), "true");
  await page.getByRole("button", { name: "Alle Standorte anzeigen", exact: true }).click();
  await page.screenshot({ path: "/tmp/slk-project-map-phone.png", fullPage: false });
  assert.deepEqual(errors, [], "Map view must hydrate without browser errors");
  console.log("PASS mobile map/list controls, reset control and error-free hydration");
  await context.close();
} finally {
  await browser.close();
  for (const id of articles.reverse()) await admin.deleteItem("articles", id);
  if (editorId) {
    const consents = await admin.readItems<{ id: string }>("user_consent", {
      filter: { user_id: { _eq: editorId } },
      fields: ["id"],
      limit: -1,
    });
    for (const consent of consents) await admin.deleteItem("user_consent", consent.id);
    await admin.deleteUser(editorId);
  }
  if (imageId) await admin.request("DELETE", `/files/${imageId}`);
}
