import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { launchBrowser, newContext, waitForHydration, collectPublicPageErrors } from "./lib/browser.js";

// Delay real read-only providers: no container builds or writable CMS fixtures.
const origin = process.env.SLK_TEST_FRONTEND_URL ?? "http://localhost:8080";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname))
  throw new Error("Region navigation acceptance requires a local frontend");
const browser = await launchBrowser(true);
try {
  for (const [width, theme] of [
    [1280, "light"],
    [390, "dark"],
  ] as const) {
    const context = await newContext(browser, { viewport: { width, height: 1000 }, colorScheme: theme });
    const release = new Map<string, () => void>();
    try {
      await context.addInitScript((mode) => localStorage.setItem("slk_theme_preference", mode), theme);
      const page = await context.newPage();
      const errors = collectPublicPageErrors(page);
      await page.goto(`${origin}/regions/040000000000?v=beta`, { waitUntil: "domcontentloaded" });
      await waitForHydration(page);
      await expect(page.locator("main canvas.maplibregl-canvas")).toBeVisible();
      const held = new Set<string>();
      const waits = new Map(
        ["area", "catalogue", "municipalities"].map((key) => [
          key,
          new Promise<void>((resolve) => release.set(key, resolve)),
        ]),
      );
      await page.route(
        (url) =>
          (url.pathname === "/api/area-by-slug" && url.searchParams.get("slug") === "000000000000") ||
          url.pathname === "/api/public/catalogs" ||
          url.pathname === "/api/public/regions/000000000000",
        async (route) => {
          const path = new URL(route.request().url()).pathname;
          const key =
            path === "/api/area-by-slug" ? "area" : path === "/api/public/catalogs" ? "catalogue" : "municipalities";
          held.add(key);
          await waits.get(key);
          await route.continue();
        },
      );
      const started = Date.now();
      await page.locator('main nav a[href="/regions/000000000000"]').click({ noWaitAfter: true });
      try {
        await expect(page).toHaveURL(`${origin}/regions/000000000000`, { timeout: 2000 });
      } catch (error) {
        console.error({ held: [...held], errors });
        throw error;
      }
      const main = page.locator("main[aria-busy]");
      await expect(main).toHaveAttribute("aria-busy", "true");
      await expect(main.locator("header .skeleton").first()).toBeVisible();
      const mapSkeleton = main.locator("section").first().locator(".skeleton");
      await expect(mapSkeleton).toBeVisible();
      const placeholder = await mapSkeleton.boundingBox();
      assert(placeholder && placeholder.height >= 320);
      await expect(main.locator("section").last().locator(".skeleton").first()).toBeVisible();
      await expect(main.locator("ol li")).toHaveCount(0);
      await expect(main.getByText("Keine Kommunen gefunden", { exact: true })).toHaveCount(0);
      const navigationMs = Date.now() - started;
      release.get("area")!();
      await expect(main.locator("h1")).toHaveText("Deutschland", { timeout: 20000 });
      await expect(mapSkeleton).toBeVisible();
      release.get("catalogue")!();
      release.get("municipalities")!();
      await expect(main).toHaveAttribute("aria-busy", "false", { timeout: 45000 });
      await expect(main.locator("ol li")).toHaveCount(50);
      await expect(main.locator("canvas.maplibregl-canvas")).toBeVisible();
      const renderedMap = await main.locator("section").first().locator(":scope > div").boundingBox();
      assert.equal(renderedMap?.height, placeholder.height);
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${theme} ${width}: navigation and skeletons in ${navigationMs}ms before provider responses; independent header, complete list, stable map height`,
      );
    } finally {
      for (const resolve of release.values()) resolve();
      await context.close();
    }
  }
} finally {
  await browser.close();
}
