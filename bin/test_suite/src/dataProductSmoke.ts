import { launchBrowser, waitForHydration } from "./lib/browser.js";
import { assert } from "./lib/assert.js";

/** Read-only regression for cycleway maps/charts and sector header translations. */
const origin = new URL(process.argv[2] ?? "http://localhost:8080").origin;
const area = process.argv[3] ?? "stadtkreis_stuttgart";
assert(/^[a-z0-9_-]+$/.test(area), "Expected a canonical area slug");
const browser = await launchBrowser(true);
try {
  const context = await browser.newContext({ locale: "de-DE", viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", async (route) => {
    if (["GET", "HEAD"].includes(route.request().method())) await route.continue();
    else await route.abort();
  });
  const page = await context.newPage();
  const errors: string[] = [];
  let workerLoaded = false;
  let geometryRequests = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.includes("maplibre-gl-worker")) {
      if (response.ok()) workerLoaded = true;
      else errors.push(`Worker HTTP ${response.status()}`);
    }
  });
  page.on("request", (request) => {
    if (new URL(request.url()).searchParams.get("geojson_type") === "classified_network") geometryRequests++;
  });
  const start = performance.now();
  await page.goto(`${origin}/data/${area}/cycleway-infrastructure`, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  const map = page.locator(".slk-maplibre-render").first();
  await map.locator("canvas").waitFor({ timeout: 15000 });
  const basemapMs = Math.round(performance.now() - start);
  await map.locator('button[aria-label="Kartendaten herunterladen"]').waitFor({ state: "attached", timeout: 45000 });
  const readyMs = Math.round(performance.now() - start);
  const chart = page.locator(".slk-vega-chart").first();
  await chart.scrollIntoViewIfNeeded();
  await chart.locator("canvas").waitFor({ timeout: 20000 });
  assert(!(await chart.innerText()).includes("konnte nicht geladen"), "Infrastructure chart must render");
  await chart.hover();
  await page.mouse.wheel(0, -150);
  await page.waitForTimeout(250);
  assert(workerLoaded, "Bundled MapLibre worker must load successfully");
  assert(errors.length === 0, errors.join("; "));
  const initialRequests = geometryRequests;
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "staedteChallengeDark";
  });
  await page.waitForTimeout(250);
  await map.locator('button[aria-label="Kartendaten herunterladen"]').waitFor({ state: "attached", timeout: 10000 });
  assert(geometryRequests === initialRequests, "Theme changes must reuse checked geometry");
  const translations = [
    ["de-DE", "Verkehr"],
    ["en-GB", "Transport"],
    ["it-IT", "Trasporti"],
  ] as const;
  for (const [locale, label] of translations) {
    await context.addCookies([{ name: "slk_locale", value: locale, url: origin }]);
    await page.goto(`${origin}/data/${area}`, { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    const badges = page.locator('section[data-sector-key="transport"] .group\\/cover .uppercase');
    await badges.first().waitFor({ state: "attached", timeout: 20000 });
    const values = await badges.allTextContents();
    assert(
      values.length > 0 && values.every((value) => value.trim() === label),
      `${locale}: translated sector badges required`,
    );
    console.log(`[PASS] ${locale} sector headers: ${label}`);
  }
  console.log(
    `[PASS] Cycleway worker, map and infrastructure chart; basemap ${basemapMs}ms, geometry ready ${readyMs}ms; ${initialRequests} geometry request(s)`,
  );
  await context.close();
} finally {
  await browser.close();
}
