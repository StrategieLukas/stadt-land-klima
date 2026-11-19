import assert from "node:assert/strict";
import type { Browser, Page } from "playwright";
import { newContext, waitForHydration } from "./browser.js";

/** Check usable document geometry, excluding the browser's reserved scrollbar strip. */
export async function assertPageGutter(page: Page, headingMaxWidth?: number): Promise<void> {
  if (headingMaxWidth !== undefined) await page.locator(".slk-page-main h1:visible").first().waitFor();
  const width = page.viewportSize()!.width;
  const gutter = width < 640 ? 16 : width < 768 ? 24 : 32;
  const geometry = await page.locator(".slk-page-main").evaluate((main) => {
    const shell = main.querySelector<HTMLElement>(":scope > [data-content-width]")!;
    const bounds = main.getBoundingClientRect();
    const content = shell.getBoundingClientRect();
    const style = getComputedStyle(main);
    const heading = Array.from(shell.querySelectorAll("h1")).find((node) => node.getClientRects().length);
    const cms = shell.querySelector(".cms-page-shell");
    return {
      x: bounds.x,
      width: bounds.width,
      left: content.left,
      right: content.right,
      contentWidth: content.width,
      full: shell.dataset.contentWidth === "full",
      padding: [parseFloat(style.paddingLeft), parseFloat(style.paddingRight)],
      headingLeft: heading?.getBoundingClientRect().left,
      cmsPadding: cms ? [getComputedStyle(cms).paddingLeft, getComputedStyle(cms).paddingRight] : null,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  const label = `${new URL(page.url()).pathname} at ${width}px`;
  const contentWidth = Math.min(geometry.width - 2 * gutter, geometry.full ? Infinity : 1280);
  const left = geometry.x + (geometry.width - contentWidth) / 2;
  assert.deepEqual(geometry.padding, [gutter, gutter], `${label}: one responsive gutter`);
  assert(Math.abs(geometry.left - left) <= 1, `${label}: centered content left edge`);
  assert(Math.abs(geometry.contentWidth - contentWidth) <= 1, `${label}: fluid content and width cap`);
  assert(
    Math.abs(geometry.right - (geometry.x + geometry.width - (left - geometry.x))) <= 1,
    `${label}: symmetric margins`,
  );
  assert.equal(geometry.overflow, false, `${label}: no document overflow`);
  if (headingMaxWidth !== undefined) {
    const headingLeft = geometry.x + (geometry.width - Math.min(headingMaxWidth, geometry.width - 2 * gutter)) / 2;
    assert(geometry.headingLeft !== undefined, `${label}: exercise a real heading`);
    assert(Math.abs(geometry.headingLeft - headingLeft) <= 1, `${label}: heading follows its content grid`);
  }
  if (geometry.cmsPadding) assert.deepEqual(geometry.cmsPadding, ["0px", "0px"], `${label}: no second CMS gutter`);
}

/** Shared by the read-only style gate and both development workflow profiles. */
export async function assertResponsivePageLayouts(
  browser: Browser,
  origin: string,
  details: readonly { path: string; headingMaxWidth?: number }[] = [],
): Promise<void> {
  const standard = [
    "/",
    "/jobs",
    "/organisation",
    "/municipalities",
    "/news",
    "/events",
    "/projects",
    "/tools",
    "/measures",
    "/stats",
    "/contact",
    "/elections/wahlcheck",
    "/data",
  ];
  for (const theme of ["light", "dark"] as const) {
    const context = await newContext(browser, { viewport: { width: 960, height: 1000 }, colorScheme: theme });
    await context.addInitScript((mode) => localStorage.setItem("slk_theme_preference", mode), theme);
    // Public layout verification must never submit forms or write CMS content.
    await context.route("**/*", async (route) => {
      if (["GET", "HEAD"].includes(route.request().method())) await route.continue();
      else await route.abort();
    });
    try {
      const page = await context.newPage();
      const check = async (headingMaxWidth?: number) => {
        await assertPageGutter(page, headingMaxWidth);
        if (new URL(page.url()).pathname === "/data") {
          const visuals = page.locator(".data-dashboard-visuals");
          if (await visuals.count()) {
            const aligned = await visuals.evaluate((element) => {
              const shell = element.closest("[data-content-width]")!.getBoundingClientRect();
              // Below lg the wrapper uses display:contents; each panel occupies the shared grid.
              const panels: Element[] =
                getComputedStyle(element).display === "contents"
                  ? Array.from(element.querySelectorAll(".data-dashboard-panel"))
                  : [element];
              return Array.from(panels).every((panel) => {
                const bounds = panel.getBoundingClientRect();
                return Math.abs(bounds.left - shell.left) <= 1 && Math.abs(bounds.right - shell.right) <= 1;
              });
            });
            assert(aligned, "Dashboard visuals retain the shared outer gutter without additional margins");
          }
        }
      };
      const visit = async (path: string, headingMaxWidth?: number) => {
        const response = await page.goto(new URL(path, origin).href, { waitUntil: "domcontentloaded" });
        assert.equal(response?.status(), 200, `${path}: public page loads`);
        await waitForHydration(page);
        await check(headingMaxWidth);
      };
      for (const path of standard) await visit(path, 1280);
      for (const path of ["/register_localteam", "/projects/submit"]) await visit(path, 768);
      await visit("/municipalities/updates", 896);
      for (const detail of details) await visit(detail.path, detail.headingMaxWidth);
      console.info(`[PASS] Page layout: 960px ${theme}, standard pages and narrow content`);
      for (const path of ["/jobs", "/news", "/data"]) {
        await page.setViewportSize({ width: 960, height: 1000 });
        await visit(path, 1280);
        for (const width of [390, 639, 640, 767, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(
            () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
          );
          await check(1280);
        }
        console.info(`[PASS] Page layout: ${path} ${theme}, phone/tablet/desktop and gutter boundaries`);
      }
    } finally {
      await context.close();
    }
  }
}
