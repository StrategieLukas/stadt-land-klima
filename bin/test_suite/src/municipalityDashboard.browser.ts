import assert from "node:assert/strict";
import type { Page } from "playwright";
import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createWriteStream, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "../../../src/frontend/node_modules/yaml/dist/index.js";
import type { GeoJSONVT as GeoJSONVTType } from "../../../src/frontend/node_modules/@maplibre/geojson-vt/dist/index.js";
const { GeoJSONVT } = (await import(
  new URL("../../../src/frontend/node_modules/@maplibre/geojson-vt/dist/geojson-vt.mjs", import.meta.url).href
)) as { GeoJSONVT: typeof GeoJSONVTType };
import type { fromGeojsonVt as FromGeojsonVt } from "../../../src/frontend/node_modules/@maplibre/vt-pbf/dist/index.js";
const { fromGeojsonVt } = (await import(
  new URL("../../../src/frontend/node_modules/@maplibre/vt-pbf/dist/index.es.js", import.meta.url).href
)) as { fromGeojsonVt: typeof FromGeojsonVt };
import { overviewFixture, histogramFixture, municipalityFixture } from "./fixtures/municipalityOverview.js";
import type { MunicipalityOverview } from "../../../src/frontend/shared/contracts/municipalityOverview.js";
import { launchBrowser, newContext, collectPublicPageErrors } from "./lib/browser.js";
import { waitFor } from "./lib/wait.js";

// Isolated HTTP fixtures exercise the actual Nuxt pages and shared components.
// They are deliberately not scientific/publication or production API acceptance.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const report = new URL("../../../.reports/checks/dashboard-browser/", import.meta.url);
mkdirSync(report, { recursive: true });
const appPort = Number(process.env.SLK_DASHBOARD_TEST_PORT ?? "8080");
const origin = `http://127.0.0.1:${appPort}`;
let upstream = "";
let histogramStale = false;
let edition = 1;
const upstreamUrl = (path: string) => `${upstream}${path.replace(/^\/api\/stadtlandzahl/, "")}`;
function context(metric = "power", scope = "DE"): MunicipalityOverview {
  const result = structuredClone(overviewFixture);
  result.snapshot_id = `fixture-${metric}-${scope}-${edition}`;
  result.metric_id = metric;
  result.scope = {
    ars: scope,
    name: scope === "DE" ? "Deutschland" : scope === "080000000000" ? "Baden-Württemberg" : "Stuttgart",
    state_ars: scope === "DE" ? null : "080000000000",
  };
  result.histogram.interactions = { reveal_municipalities: { metric_id: metric, selection: "whole_bin" } };
  result.histogram.data_url = upstreamUrl(
    `/api/collections/wind-turbines/histogram/?metric=${metric}&snapshot=${result.snapshot_id}`,
  );
  const spec = JSON.stringify(result.histogram.vegalite_spec).replaceAll(
    overviewFixture.histogram.data_url!,
    result.histogram.data_url,
  );
  result.histogram.vegalite_spec = JSON.parse(spec) as Record<string, unknown>;
  result.map.tile_url = upstreamUrl(
    `/api/collections/wind-turbines/overview/tiles/{z}/{x}/{y}.pbf?snapshot=${result.snapshot_id}`,
  );
  result.links.municipalities = upstreamUrl(
    `/api/collections/wind-turbines/overview/municipalities/?snapshot=${result.snapshot_id}`,
  );
  result.links.regions = upstreamUrl(`/api/collections/wind-turbines/overview/regions/?snapshot=${result.snapshot_id}`);
  return result;
}
const tileIndex = new GeoJSONVT(
  {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { ...municipalityFixture, bin_index: 0, score_class: "red" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [8, 48],
              [10, 48],
              [10, 50],
              [8, 50],
              [8, 48],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          ...municipalityFixture,
          ars: "081150000000",
          name: "Böblingen",
          slug: "landkreis_boeblingen",
          value: 10,
          bin_index: 0,
          score_class: "darkgreen",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [10, 50],
              [12, 50],
              [12, 52],
              [10, 52],
              [10, 50],
            ],
          ],
        },
      },
    ],
  },
  { extent: 4096 },
);
const navigation = [
  {
    id: "explore",
    label: "Entdecken",
    link_type: "none",
    dropdown_layout: "preview",
    children: [
      {
        id: "data",
        label: "Datenanalyse",
        description: "Kommunale Klimadaten entdecken",
        link_type: "page",
        page_slug: "data",
        image_id: "00000000-0000-4000-8000-000000000001",
      },
      {
        id: "municipalities",
        label: "Kommunen",
        link_type: "page",
        page_slug: "municipalities",
        image_id: "00000000-0000-4000-8000-000000000002",
      },
      {
        id: "map",
        label: "Karte",
        link_type: "page",
        page_slug: "map",
        image_id: "00000000-0000-4000-8000-000000000003",
      },
    ],
  },
  {
    id: "offers",
    label: "Angebote",
    link_type: "none",
    dropdown_layout: "cards",
    children: [
      {
        id: "offer-data",
        label: "Klimadaten",
        description: "Kommunale Kennwerte entdecken",
        link_type: "page",
        page_slug: "data",
        image_id: "00000000-0000-4000-8000-000000000001",
      },
      {
        id: "offer-join",
        label: "Mitmachen",
        description: "Klimaschutz gemeinsam gestalten",
        link_type: "page",
        page_slug: "participate",
      },
    ],
  },
  {
    id: "information",
    label: "Informationen",
    link_type: "none",
    dropdown_layout: "list",
    children: [
      { id: "info-about", label: "Über uns", link_type: "page", page_slug: "about" },
      { id: "info-contact", label: "Kontakt", link_type: "page", page_slug: "contact" },
    ],
  },
  { id: "news", label: "Aktuelles", link_type: "page", page_slug: "news" },
];
const translations = readdirSync(new URL("../../../src/directus/translations/de-DE/", import.meta.url))
  .filter((name) => name.endsWith(".yaml"))
  .map(
    (name) =>
      parse(readFileSync(new URL(`../../../src/directus/translations/de-DE/${name}`, import.meta.url), "utf8")) as {
        key: string;
        value: string;
        language: string;
      },
  );
const fixtureServer = createServer((request, response) => {
  const url = new URL(request.url ?? "/", upstream || "http://fixture.invalid");
  const json = (body: unknown, status = 200) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (url.pathname === "/translations") return json({ data: translations });
  if (url.pathname === "/items/navigation_config")
    return json({ data: { header_items: navigation, footer_columns: [] } });
  if (url.pathname === "/items/data_page_config")
    return json({
      data: { collection_ids: [], include_only: false, under_construction: false, under_construction_explanation: "" },
    });
  if (url.pathname.startsWith("/items/")) return json({ data: [] });
  if (url.pathname.startsWith("/assets/")) {
    response.writeHead(200, { "content-type": "image/svg+xml" });
    return response.end(
      '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480"><rect width="720" height="480" fill="#006e94"/><circle cx="300" cy="230" r="130" fill="#AFCA0B"/></svg>',
    );
  }
  if (url.pathname.startsWith("/indexes/")) return json({ message: "Fixture search is unavailable" }, 503);
  if (url.pathname === "/api/manifests/collections-index")
    return json({
      collections: [
        {
          id: "wind-turbines",
          title: { "de-DE": "Windkraft" },
          description: { "de-DE": "Installierte Leistung im kommunalen Vergleich." },
          sector: "energy",
          iconify_str: "mdi:wind-turbine",
          municipality_overview: { contract_version: 1, default_metric_id: "power" },
        },
        { id: "population-density", title: { "de-DE": "Bevölkerungsdichte" }, description: {}, sector: "general" },
      ],
    });
  if (url.pathname === "/api/collections/wind-turbines/overview/") {
    const metric = url.searchParams.get("metric") ?? "power";
    if (!["power", "second-metric"].includes(metric)) return json({ code: "invalid_metric" }, 400);
    return json(context(metric, url.searchParams.get("scope") ?? "DE"));
  }
  if (url.pathname === "/api/collections/wind-turbines/overview/regions/")
    return json({
      snapshot_id: url.searchParams.get("snapshot"),
      results:
        url.searchParams.get("level") === "state"
          ? [
              {
                ars: "080000000000",
                name: "Baden-Württemberg",
                level: "state",
                parent_ars: null,
                bounds: [7.5, 47.5, 10.5, 50],
              },
            ]
          : [
              {
                ars: "081110000000",
                name: "Stuttgart",
                level: "district",
                parent_ars: "080000000000",
                bounds: [9, 48.6, 9.4, 49],
              },
            ],
    });
  if (url.pathname === "/api/collections/wind-turbines/overview/municipalities/")
    return json({
      snapshot_id: url.searchParams.get("snapshot"),
      count: 2,
      results: url.searchParams.has("cursor")
        ? [{ ...municipalityFixture, ars: "081150000000", name: "Böblingen", slug: "landkreis_boeblingen", value: 10 }]
        : [municipalityFixture],
      next_cursor: url.searchParams.has("cursor") ? null : "fixture-page-2",
    });
  const tile = /\/overview\/tiles\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(url.pathname);
  if (tile) {
    const data = tileIndex.getTile(Number(tile[1]), Number(tile[2]), Number(tile[3]));
    response.writeHead(200, { "content-type": "application/vnd.mapbox-vector-tile" });
    return response.end(data ? fromGeojsonVt({ municipalities: data }) : new Uint8Array());
  }
  if (url.pathname === "/api/collections/wind-turbines/histogram/") {
    if (histogramStale) {
      histogramStale = false;
      edition++;
      return json({ code: "snapshot_unavailable" }, 409);
    }
    const result = structuredClone(histogramFixture);
    const metric = url.searchParams.get("metric") ?? "power";
    const snapshot = url.searchParams.get("snapshot") ?? "fixture-power-DE";
    result.metric = overviewFixture.metrics.find((item) => item.id === metric)!;
    result.interaction_context = {
      snapshot_id: snapshot,
      metric_id: metric,
      members_url: upstreamUrl(`/api/collections/wind-turbines/overview/municipalities/?snapshot=${snapshot}`),
    };
    return json(result);
  }
  if (url.pathname === "/api/collections/wind-turbines/render/")
    return json({
      render_elements: [context().histogram],
      narrative_steps: [
        {
          index: 0,
          title: { "de-DE": "Vergleich" },
          description: {},
          plot_ids: ["histogram-power"],
          layout: "full_width",
        },
      ],
    });
  if (url.pathname === "/api/collections/wind-turbines/summary/")
    return json({ aggregate: {}, area: municipalityFixture.ars });
  if (url.pathname === "/api/collections/wind-turbines/")
    return json({
      id: "wind-turbines",
      title: { "de-DE": "Windkraft" },
      description: {},
      render_elements: [context().histogram],
    });
  if (url.pathname.startsWith("/api/areas/"))
    return json({
      ...municipalityFixture,
      level: 6,
      population: 600000,
      is_reasonable_for_municipal_rating: true,
      geo_center: { lat: 48.78, lon: 9.18 },
      geo_area: {
        type: "Polygon",
        coordinates: [
          [
            [9, 48],
            [10, 48],
            [10, 49],
            [9, 49],
            [9, 48],
          ],
        ],
      },
      stadtlandklima_data_all: [],
    });
  return json({ results: [], data: [], ancestors: [] });
});
await new Promise<void>((resolve) => {
  fixtureServer.listen(0, "127.0.0.1", resolve);
});
const address = fixtureServer.address();
assert(address && typeof address !== "string");
upstream = `http://127.0.0.1:${address.port}`;
const log = createWriteStream(new URL("nuxt.log", report));
const app = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("../../../src/frontend/node_modules/@nuxt/cli/bin/nuxi.mjs", import.meta.url)),
    "dev",
    "--host",
    "127.0.0.1",
    "--port",
    String(appPort),
  ],
  {
    cwd: `${root}src/frontend`,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NUXT_DIRECTUS_SERVER_URL: upstream,
      NUXT_DIRECTUS_FRONTEND_SERVER_TOKEN: "fixture-private-token",
      NUXT_PUBLIC_CLIENT_DIRECTUS_URL: upstream,
      NUXT_STADTLANDZAHL_SERVER_BASE_URL: upstream,
      NUXT_MEILISEARCH_URL: upstream,
      REDIS_URL: "redis://127.0.0.1:1",
      NUXT_PUBLIC_APP_ENV: "development",
    },
  },
);
app.stdout?.pipe(log);
app.stderr?.pipe(log);
let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
let activePage: Page | undefined;
try {
  await waitFor(
    "fixture Nuxt server",
    async () => (await fetch(`${origin}/data`, { signal: AbortSignal.timeout(5000) })).ok,
    { timeoutMs: 120000, intervalMs: 1000 },
  );
  const curl = await promisify(execFile)(
    "curl",
    [
      "--fail",
      "--silent",
      "--max-time",
      "30",
      "--output",
      fileURLToPath(new URL("data.html", report)),
      "--write-out",
      "%{http_code}",
      `${origin}/data`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(curl.stdout, "200");
  assert(!readFileSync(new URL("data.html", report), "utf8").includes("fixture-private-token"));
  console.log(`curl ${origin}/data: HTTP 200 with isolated fixtures; private service token absent from HTML.`);
  browser = await launchBrowser(true);
  const errors: string[] = [];
  for (const width of [1280, 340, 768]) {
    const session = await newContext(browser, {
      viewport: { width, height: 1000 },
      hasTouch: width === 340,
      isMobile: width === 340,
      colorScheme: width === 768 ? "dark" : "light",
      reducedMotion: width === 768 ? "reduce" : "no-preference",
    });
    const page = await session.newPage();
    activePage = page;
    page.setDefaultNavigationTimeout(20000);
    page.setDefaultTimeout(20000);
    const pageErrors = collectPublicPageErrors(page);
    if (width === 768) {
      await page.addInitScript(`
        const originalCanvasContext = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
          value(...args) {
            if (typeof args[0] === "string" && /webgl/i.test(args[0])) return null;
            return Reflect.apply(originalCanvasContext, this, args);
          },
        });
      `);
    }
    await page.route("**/api/stadtlandzahl/**", async (route) => {
      const url = new URL(route.request().url());
      const reply = await fetch(`${upstream}${url.pathname.replace(/^\/api\/stadtlandzahl/, "")}${url.search}`);
      const contentType = reply.headers.get("content-type") ?? "application/json";
      const body = Buffer.from(await reply.arrayBuffer());
      await route.fulfill({
        status: reply.status,
        contentType,
        body: contentType.includes("json") ? body.toString().replaceAll(upstream, `${origin}/api/stadtlandzahl`) : body,
      });
    });
    await page.goto(`${origin}/data`, { waitUntil: "domcontentloaded" });
    await page.getByText("Verteilung der Gemeinden", { exact: true }).waitFor({ timeout: 60000 });
    await page.locator("#data-explorer canvas").first().waitFor({ timeout: 30000 });
    if (width === 768) {
      await page
        .getByText(
          "Die Karte ist gerade nicht verfügbar. Du kannst Gemeinden über die Suche oder die Verteilung auswählen.",
          { exact: true },
        )
        .waitFor();
      assert.equal(await page.locator("html").getAttribute("data-theme"), "staedteChallengeDark");
    }
    if (width === 340) {
      const canvas = page.locator(".maplibregl-canvas");
      const box = await canvas.boundingBox();
      assert(box);
      const mercatorY = (latitude: number) =>
        0.5 - Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) / (2 * Math.PI);
      const [west, south, east, north] = overviewFixture.map.bounds;
      const scale = Math.min(
        (box.width - 48) / ((east - west) / 360),
        (box.height - 48) / (mercatorY(south) - mercatorY(north)),
      );
      const position = {
        x: box.width / 2 + ((9 - (west + east) / 2) / 360) * scale,
        y: box.height / 2 + (mercatorY(49) - (mercatorY(south) + mercatorY(north)) / 2) * scale,
      };
      const detailLink = page.getByRole("link", { name: "Datenprodukt für diese Gemeinde öffnen", exact: true });
      await waitFor("touch map preview", async () => {
        await canvas.tap({ position });
        return detailLink.isVisible();
      });
      assert.equal(await detailLink.getAttribute("href"), "/data/stadtkreis_stuttgart/wind-turbines");
      await page
        .getByRole("region", { name: "Karte der kommunalen Kennwerte" })
        .first()
        .locator("..")
        .getByRole("button", { name: "Schließen", exact: true })
        .click();
    }
    await page.getByText("Wertebereich auswählen", { exact: true }).click();
    await page.getByRole("button", { name: "0–10 · 2", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Gemeinden im Wertebereich" });
    await dialog.getByRole("link", { name: /Stuttgart/ }).waitFor();
    assert.equal(
      await dialog.getByRole("link", { name: /Stuttgart/ }).getAttribute("href"),
      "/data/stadtkreis_stuttgart/wind-turbines",
    );
    await dialog.getByRole("button", { name: "Weitere Gemeinden laden" }).click();
    await dialog.getByRole("link", { name: /Böblingen/ }).waitFor();
    assert.equal(await dialog.getByRole("link").count(), 2);
    await page.screenshot({ path: fileURLToPath(new URL(`selection-${width}.png`, report)), fullPage: true });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "2 ausgewählte Gemeinden anzeigen" }).click();
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
    await page.getByRole("button", { name: "Auswahl aufheben", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "2 ausgewählte Gemeinden anzeigen" }).count(), 0);
    console.log(width, "selection passed");
    await page.getByRole("combobox", { name: "Kennwert", exact: true }).selectOption("second-metric");
    await page.waitForURL(/metric=second-metric/);
    await page.getByRole("heading", { name: /Zweiter Kennwert/ }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("color"), "continuous");
    console.log(width, "metric passed", page.url());
    await page.goBack();
    await page.getByRole("combobox", { name: "Kennwert", exact: true }).selectOption("power");
    await page.getByLabel("Bundesland", { exact: true }).selectOption("080000000000");
    await page.waitForURL(/scope=080000000000/);
    await page.getByLabel("Kreis", { exact: true }).selectOption("081110000000");
    await page.waitForURL(/scope=081110000000/);
    console.log(width, "regions passed");
    await page.getByLabel("Gemeinde suchen", { exact: true }).fill("Stuttgart");
    await page.getByRole("link", { name: /Stuttgart.*0,0/ }).waitFor();
    await page.screenshot({ path: fileURLToPath(new URL(`dashboard-${width}.png`, report)), fullPage: true });
    if (width === 1280) {
      await page.evaluate(() => window.scrollTo(0, 0));
      const trigger = page.getByRole("button", { name: "Untermenü für Entdecken" });
      await trigger.focus();
      await page.keyboard.press("ArrowDown");
      const panel = page.locator(".navigation-panel");
      await panel.waitFor();
      assert.equal(await panel.getByRole("link").count(), 3);
      await panel.getByRole("link", { name: "Kommunen", exact: true }).focus();
      await waitFor("keyboard image preview", async () =>
        /000000000002/.test((await panel.locator("img").getAttribute("src")) ?? ""),
      );
      const box = await panel.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= width);
      await page.keyboard.press("Escape");
      await panel.waitFor({ state: "hidden" });
      assert(await trigger.evaluate((element) => element === document.activeElement));
      assert(box.height < 240 && box.width <= 560, "Preview dropdown should stay compact");
      await trigger.hover();
      await panel.waitFor();
      const originalPanel = await panel.elementHandle();
      assert(originalPanel);
      await page.getByRole("button", { name: "Untermenü für Angebote", exact: true }).hover();
      await waitFor(
        "shared panel morph",
        async () => {
          const current = await panel.boundingBox();
          return (
            (await panel.getAttribute("aria-label")) === "Angebote" &&
            !!current &&
            current.width > 461 &&
            current.width < 559
          );
        },
        { intervalMs: 10, timeoutMs: 3000 },
      );
      assert(await originalPanel.evaluate((element) => element === document.querySelector(".navigation-panel")));
      await waitFor("cards panel size", async () => Math.abs((await panel.boundingBox())!.width - 460) < 1);
      const properties = await panel.evaluate((element) => getComputedStyle(element).transitionProperty);
      for (const property of ["width", "height", "left"]) assert(properties.includes(property));
      await page.getByRole("button", { name: "Untermenü für Informationen", exact: true }).hover();
      await waitFor(
        "list panel size",
        async () =>
          (await panel.getAttribute("aria-label")) === "Informationen" &&
          Math.abs((await panel.boundingBox())!.width - 280) < 1,
      );
      await page.locator('nav [data-navigation-id="news"]').hover();
      await panel.waitFor({ state: "hidden" });
      await originalPanel.dispose();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await trigger.hover();
      await panel.waitFor();
      assert.equal(await panel.evaluate((element) => getComputedStyle(element).transitionDuration), "0s");
      await page.getByRole("button", { name: "Untermenü für Informationen", exact: true }).hover();
      await waitFor(
        "reduced-motion list panel",
        async () => (await panel.getAttribute("aria-label")) === "Informationen",
      );
      await page.keyboard.press("Escape");
      await panel.waitFor({ state: "hidden" });
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      "Dashboard must fit its viewport",
    );
    if (width === 1280) {
      console.log(width, "navigation passed");
      histogramStale = true;
      await page.getByRole("combobox", { name: "Kennwert", exact: true }).selectOption("second-metric");
      await page
        .getByText("Die Daten haben sich geändert. Die Ansicht wurde aktualisiert und die Auswahl aufgehoben.", {
          exact: true,
        })
        .waitFor();
      await page.locator("#data-explorer .slk-vega-chart canvas").first().waitFor();
      console.log(width, "snapshot recovery passed");
      await page.goto(`${origin}/data/stadtkreis_stuttgart/wind-turbines`, { waitUntil: "domcontentloaded" });
      await page.getByText("Wertebereich auswählen", { exact: true }).waitFor({ timeout: 30000 });
      await page.getByText("Wertebereich auswählen", { exact: true }).click();
      await page.getByRole("button", { name: "0–10 · 2", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("link", { name: /Stuttgart/ })
        .waitFor();
      await page.keyboard.press("Escape");
      const canvas = page.locator(".slk-vega-chart canvas").first();
      const box = await canvas.boundingBox();
      assert(box);
      await canvas.click({ position: { x: box.width * 0.6, y: box.height * 0.3 } });
      await page
        .getByRole("dialog")
        .getByRole("link", { name: /Stuttgart/ })
        .waitFor();
      await page.keyboard.press("Escape");
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width >= 640) await page.locator("header input:visible").first().click();
    else await page.getByRole("button", { name: "Suchen...", exact: true }).click();
    const palette = page.locator(".palette-panel");
    await palette.waitFor();
    const theme = await page.locator("html").getAttribute("data-theme");
    for (const selectedTheme of ["staedteChallemgeTheme", "staedteChallengeDark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, selectedTheme);
      const color = await page
        .locator(".slk-modal-backdrop")
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      assert.match(color, /[,/]\s*0\.5\)$/, `Search backdrop must remain translucent: ${selectedTheme}: ${color}`);
      await page.screenshot({
        path: fileURLToPath(new URL(`search-${width}-${selectedTheme}.png`, report)),
        fullPage: true,
      });
    }
    await page.evaluate((value) => {
      if (value) document.documentElement.dataset.theme = value;
    }, theme);
    await page.keyboard.press("Escape");
    await palette.waitFor({ state: "hidden" });
    errors.push(...pageErrors);
    await session.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "Dashboard browser fixtures passed: desktop/mobile selection, pagination, dialog lifecycle, two metrics, history, regional filters, search, keyboard navigation, snapshot recovery, detail histogram bar clicks and dark/reduced-motion tablet WebGL fallback.",
  );
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    console.log("Failure URL:", activePage.url());
    writeFileSync(new URL("failure.html", report), await activePage.content());
    await activePage.screenshot({ path: fileURLToPath(new URL("failure.png", report)), fullPage: true });
  }
  throw error;
} finally {
  await browser?.close();
  app.kill("SIGTERM");
  fixtureServer.closeAllConnections();
  await new Promise<void>((resolve) => {
    fixtureServer.close(() => resolve());
  });
  log.end();
}
