import assert from "node:assert/strict";
import { launchBrowser, newContext, waitForHydration, collectPublicPageErrors } from "./lib/browser.js";
import { MapResponseSchema } from "../../../src/frontend/shared/contracts/map.js";
import { waitFor } from "./lib/wait.js";

const base = new URL(process.argv[2] ?? "http://localhost:8080").origin;
const map = MapResponseSchema.parse(await (await fetch(`${base}/api/public/map`)).json());
assert(
  map.scores.some((score) => !score.published),
  "Seed an in-progress municipality for map acceptance",
);
assert(map.scores.every((score) => score.published || score.score_total === null));
const city = map.scores.find((score) => score.published)?.municipality;
assert(city, "Seed a complete published municipality for hero acceptance");
const browser = await launchBrowser(true);
try {
  const mapContext = await newContext(browser);
  try {
    const page = await mapContext.newPage();
    await page.goto(`${base}/map?v=${encodeURIComponent(map.catalogVersion.name)}`, { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    const markers = page.locator(".leaflet-marker-icon:visible");
    const located = map.scores.filter((score) => score.municipality.geolocation !== null);
    await waitFor(
      "published map markers",
      async () => (await markers.count()) === located.filter((score) => score.published).length,
    );
    await page.locator("input.toggle.toggle-sm").check();
    await waitFor("in-progress map markers", async () => (await markers.count()) === located.length);
    console.log(
      `PASS map: ${located.length} located municipalities, including in-progress markers without private results`,
    );
  } finally {
    await mapContext.close();
  }
  for (const locale of ["de-DE", "en-GB", "it-IT"]) {
    for (const width of [390, 1440]) {
      for (const theme of ["light", "dark"] as const) {
        const context = await newContext(browser, { locale, viewport: { width, height: 1000 }, colorScheme: theme });
        try {
          const page = await context.newPage();
          const errors = collectPublicPageErrors(page);
          await page.goto(base, { waitUntil: "domcontentloaded" });
          await waitForHydration(page);
          assert.equal(await page.locator("h1").count(), 1);
          assert.equal(await page.locator("html").getAttribute("lang"), locale);
          assert.equal(await page.locator('input[name="q"]').count(), 1);
          assert.equal(await page.locator('a.canonical-button[href="/municipalities"]').count(), 1);
          assert.equal(
            await page
              .locator("h1")
              .innerText()
              .then((text) => text.includes("home.title")),
            false,
          );
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.screenshot({ path: `/tmp/slk-home-${locale}-${width}-${theme}.png` });
          await page.goto(`${base}/municipalities/${city.slug}?v=${encodeURIComponent(map.catalogVersion.name)}`, {
            waitUntil: "domcontentloaded",
          });
          await waitForHydration(page);
          await page.getByRole("heading", { level: 1, name: city.name, exact: true }).waitFor();
          assert.equal(await page.locator('a.canonical-button[href*="/municipalities/updates"]').count(), 0);
          const group = page.locator('.canonical-toggle-group[data-padding="large"]:visible').first();
          await group.getByRole("radio").first().focus();
          await page.keyboard.press("End");
          assert.equal(await group.getByRole("radio").last().getAttribute("aria-checked"), "true");
          await page.keyboard.press("Home");
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.goto(`${base}/municipalities?v=${encodeURIComponent(map.catalogVersion.name)}`, {
            waitUntil: "domcontentloaded",
          });
          await waitForHydration(page);
          if (width < 420) {
            const filter = page.locator('.slk-filter-panel > button[aria-expanded="false"]');
            if (await filter.count()) await filter.click();
          }
          const icons = page.locator(".slk-city-filter-icon:visible");
          assert((await icons.count()) > 0);
          assert(
            await icons.evaluateAll((nodes) =>
              nodes.every((node) => {
                const style = getComputedStyle(node);
                return style.backgroundColor === style.color && style.maskImage !== "none";
              }),
            ),
          );
          assert.equal(errors.length, 0, errors.join("; "));
          console.log(
            `PASS ${locale} ${width}px ${theme}: homepage, municipality hero, keyboard toggles and city icons`,
          );
        } finally {
          await context.close();
        }
      }
    }
  }
  const tours = (await (await fetch(`${base}/api/public/tours?limit=1`)).json()) as { tours: { slug: string }[] };
  assert(tours.tours[0], "Seed a published project tour for retro toggle acceptance");
  for (const width of [390, 1440]) {
    for (const theme of ["light", "dark"] as const) {
      const context = await newContext(browser, { viewport: { width, height: 1000 }, colorScheme: theme });
      try {
        const page = await context.newPage();
        for (const path of ["/projects", "/measures", "/stats", `/projects/tours/${tours.tours[0].slug}`]) {
          await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
          await waitForHydration(page);
          if (width < 420 && path === "/measures") await page.locator(".slk-filter-panel > button").first().click();
          const group = page.locator(".canonical-toggle-group:visible").first();
          await group.waitFor();
          assert(
            await group.evaluate((element) => {
              const selected = element.querySelector('[aria-checked="true"]');
              if (!selected) return false;
              const probe = document.createElement("span");
              probe.style.backgroundColor = "var(--slk-filter-active-bg)";
              element.append(probe);
              const matches = getComputedStyle(probe).backgroundColor === getComputedStyle(selected).backgroundColor;
              probe.remove();
              return matches;
            }),
            `${path} must use its own palette in ${theme}`,
          );
          if (path.includes("/tours/")) {
            assert.equal(await group.getAttribute("data-appearance"), "retro");
            assert.equal(await group.evaluate((element) => getComputedStyle(element).borderRadius), "0px");
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path);
        }
        console.log(`PASS ${width}px ${theme}: project, measure, statistics palettes and retro tour toggle`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
