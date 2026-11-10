import assert from "node:assert/strict";
import { launchBrowser, newContext, waitForHydration } from "./lib/browser.js";
import { waitFor } from "./lib/wait.js";
import { MapResponseSchema } from "../../../src/frontend/shared/contracts/map.js";

const base = new URL(process.argv[2] ?? "http://localhost:8080").origin;
const map = MapResponseSchema.parse(await (await fetch(`${base}/api/public/map`)).json());
const city = map.scores.find((score) => score.published)?.municipality;
assert(city, "A published municipality is required");
const browser = await launchBrowser(true);
try {
  for (const width of [390, 1440]) {
    for (const theme of ["light", "dark"] as const) {
      const context = await newContext(browser, { viewport: { width, height: 1000 }, colorScheme: theme });
      try {
        const page = await context.newPage();
        await page.goto(base, { waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        const hero = page.locator("section").filter({ has: page.locator("h1") });
        assert.equal(await hero.locator(".uppercase").count(), 0);
        const photo = hero.locator("figure img");
        await photo.scrollIntoViewIfNeeded();
        await photo.evaluate((image) => (image as HTMLImageElement).decode());
        assert.match(await hero.locator("figcaption").innerText(), /Christhard Landgraf, CC BY/);
        assert.equal(await hero.locator(".slk-area-search-tabs").count(), 0);
        for (const href of ["/klimawerkstatt", "/register_localteam", "/ueber-uns", "/spenden"]) {
          assert(await page.locator(`main a[href="${href}"]`).count(), `Homepage restores ${href}`);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

        for (const path of ["news", "events"]) {
          await page.goto(`${base}/${path}`, { waitUntil: "domcontentloaded" });
          await waitForHydration(page);
          assert.equal(await page.locator('main a[href="/municipalities/updates"]').count(), 0);
          const navigation = page.locator(".slk-timeline-navigation");
          await navigation.waitFor();
          const geometry = await navigation.evaluate((nav) => {
            const rect = nav.getBoundingClientRect();
            const shell = nav.parentElement!.getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              width: rect.width,
              shell: shell.width,
              viewport: document.body.getBoundingClientRect().width,
            };
          });
          assert(geometry.width >= geometry.shell, "Timeline spans the available content width");
          assert(geometry.left >= -1 && geometry.right <= width + 1, "Timeline stays inside the viewport");
          if (width === 390)
            assert(geometry.width >= geometry.viewport - 1, "Phone navigation reaches both viewport edges");
          const first = navigation.locator("a").first();
          await first.click();
          await waitFor(
            "timeline marks the selected section",
            async () => (await first.getAttribute("aria-current")) === "location",
          );
          const controls = page.locator(".slk-timeline-pill, .slk-news-filter");
          const contrasts = await controls.evaluateAll((elements) =>
            elements.map((element) => {
              const style = getComputedStyle(element);
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 1;
              const context = canvas.getContext("2d")!;
              const [a, b] = [style.color, style.backgroundColor].map((color) => {
                context.clearRect(0, 0, 1, 1);
                context.fillStyle = color;
                context.fillRect(0, 0, 1, 1);
                const rgb = Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3)).map((channel) => {
                  const value = channel / 255;
                  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
                });
                return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
              });
              return (Math.max(a!, b!) + 0.05) / (Math.min(a!, b!) + 0.05);
            }),
          );
          assert(
            contrasts.every((contrast) => contrast >= 4.5),
            `${path} pills need 4.5:1 contrast in ${theme}`,
          );
          if (path === "news") {
            const filters = page.locator(".slk-news-filters");
            const remaining = await filters.evaluate((group) => {
              const buttons = [...group.querySelectorAll("button")];
              const last = buttons.at(-1)!;
              return group.getBoundingClientRect().right - last.getBoundingClientRect().right;
            });
            assert(remaining < 2, "News filters fill their row");
          }
        }

        await page.goto(`${base}/municipalities/${city.slug}?v=${encodeURIComponent(map.catalogVersion.name)}`, {
          waitUntil: "domcontentloaded",
        });
        await waitForHydration(page);
        const municipalityHero = page.locator("header").filter({ has: page.locator("h1") });
        assert.equal((await municipalityHero.innerText()).split(city.name).length - 1, 1);
        const summary = page.getByTestId("municipality-assessment-summary").filter({ visible: true });
        assert(!(await summary.locator("h3").innerText()).includes(city.name));
        assert((await summary.innerText()).includes(map.catalogVersion.name));
        const actions = page.getByTestId("municipality-sidebar-actions").filter({ visible: true });
        const icons = actions.locator("img:visible");
        assert.equal(await icons.count(), 3, "All sidebar cards share one themed icon each");
        for (const icon of await icons.all()) {
          await icon.evaluate((image) => (image as HTMLImageElement).decode());
          const size = await icon.boundingBox();
          assert(size && size.width === 24 && size.height === 24);
        }
        console.log(
          `PASS ${width}px ${theme}: homepage content/photo, full-width timelines, 4.5:1 pill contrast, concise municipality header and matching icons`,
        );
      } finally {
        await context.close();
      }
    }
  }
  const context = await newContext(browser);
  try {
    const page = await context.newPage();
    const failures: string[] = [];
    page.on("response", (response) => {
      if (response.status() >= 400 && new URL(response.url()).pathname.includes("/admin/assets/"))
        failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    await page.goto(`${base}/backend`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').waitFor({ timeout: 30_000 });
    assert.equal(failures.length, 0, failures.join("\n"));
    assert(new URL(page.url()).pathname.includes("/admin/"));
    console.log("PASS /backend redirects to a working Directus login with no failed admin chunks");
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
}
