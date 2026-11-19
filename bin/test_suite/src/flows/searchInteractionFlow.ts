import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import type { Browser, Page } from "playwright";
import { newContext, waitForHydration } from "../lib/browser.js";
import type { TestRunner } from "../lib/runner.js";

/** Real hydrated components, deterministic read-only providers; no CMS fixtures or writes. */
export async function runSearchInteractionFlow(runner: TestRunner, origin: string, browser: Browser) {
  await runner.step(
    "Search interactions: repeated activation, dismissal, selection identity and responsive focus",
    async () => {
      const context = await newContext(browser);
      let releaseArea = () => {};
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        page.setDefaultNavigationTimeout(20000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        let contentMode: "results" | "empty" | "error" = "results";
        let areaMode: "empty" | "region" | "municipality" = "empty";
        let areaGate: Promise<void> = Promise.resolve();
        function holdAreas() {
          areaGate = new Promise<void>((resolve) => {
            releaseArea = resolve;
          });
        }
        await page.route(
          (url) => url.pathname === "/api/content-search",
          (route) => {
            const term = new URL(route.request().url()).searchParams.get("q") ?? "";
            if (contentMode === "error") return route.fulfill({ status: 503, json: {} });
            return route.fulfill({
              json: {
                hits:
                  contentMode === "empty"
                    ? []
                    : Array.from({ length: 30 }, (_, index) => ({
                        id: `proof-${index}`,
                        type: "static_page",
                        title: `Search proof ${term} ${index}`,
                        excerpt: "",
                        url: index ? `/news#search-proof-${index}` : "/contact",
                      })),
              },
            });
          },
        );
        await page.route(
          (url) => url.pathname === "/api/public/municipalities",
          (route) => route.fulfill({ json: { municipalities: [] } }),
        );
        await page.route(
          (url) => url.pathname === "/api/area-search",
          async (route) => {
            const mode = areaMode;
            const term = new URL(route.request().url()).searchParams.get("term") ?? "";
            await areaGate;
            await route
              .fulfill({
                json:
                  mode === "empty"
                    ? []
                    : [
                        {
                          ars: "110000000000",
                          name: `Search area ${term}`,
                          prefix: mode === "region" ? "Land" : "Gemeinde",
                          level: mode === "region" ? 2 : 5,
                          isReasonableForMunicipalRating: mode === "municipality",
                          stadtlandklimaDataAll: [],
                        },
                      ],
              })
              .catch(() => {}); // A cancelled request may already have left the browser context.
          },
        );
        const goto = async (path: string) => {
          await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
          await waitForHydration(page);
        };
        const header = page.locator("[data-search-header] input");
        const panel = page.locator(".palette-panel");
        const first = page.locator(".palette-result").first();
        const close = async () => {
          await page.keyboard.press("Escape");
          await expect(panel).toBeHidden();
        };
        await goto("/news");
        for (const width of [1280, 768]) {
          await page.setViewportSize({ width, height: 900 });
          for (const selection of ["keyboard", "pointer", "same-route"]) {
            await header.click();
            await header.fill(`repeat-${width}-${selection}`);
            await expect(first).toContainText(`repeat-${width}-${selection}`);
            await header.press("Enter");
            await expect(panel).toBeVisible(); // Enter requires an explicit selection.
            if (selection === "pointer") await first.locator("a").click();
            else {
              await header.press("ArrowDown");
              await header.press("Enter");
            }
            await expect(page).toHaveURL(`${origin}/contact`);
            await expect(panel).toBeHidden();
            await header.click();
            await expect(panel).toBeVisible();
            await expect(header).toHaveValue("");
          }
          await header.fill("retained");
          for (let repeat = 0; repeat < 3; repeat++) {
            await close();
            await header.click();
            await expect(header).toHaveValue("retained");
            await expect(first).toContainText("retained");
            await page.locator(".slk-modal-backdrop").click({ position: { x: 5, y: 400 } });
            await expect(panel).toBeHidden();
            await page.keyboard.press("Control+k");
            await expect(header).toBeFocused();
            await expect(first).toContainText("retained");
          }
          const trigger = page.locator("[data-nav-trigger]").first();
          await trigger.hover();
          await expect(page.locator(".navigation-panel")).toBeVisible();
          await expect(panel).toBeHidden();
          await page.keyboard.type(" typed");
          await expect(panel).toBeVisible();
          await expect(page.locator(".navigation-panel")).toBeHidden();
          await header.hover();
          await trigger.hover();
          await expect(panel).toBeHidden();
          await header.click();
          await expect(panel).toBeVisible();
          await header.hover();
          await trigger.hover();
          await expect(panel).toBeHidden();
          await page.keyboard.press("Escape");
          await expect(panel).toBeVisible();
          await expect(header).toHaveValue("retained typed");
          await header.press("Tab");
          await expect(panel).toBeVisible(); // Clear remains inside the boundary.
          await page.keyboard.press("Tab");
          await expect(panel).toBeHidden();
          await header.click();
          await page.locator("[data-search-header] button").click();
          await expect(header).toHaveValue("");
          await expect(first).toHaveCount(0);
        }

        areaMode = "region";
        holdAreas();
        await header.fill("delayed");
        await expect(first).toContainText("delayed");
        await header.press("ArrowDown");
        await expect(page.locator(".palette-result--focused")).toContainText("Search proof delayed 0");
        releaseArea();
        await expect(page.locator(".palette-result")).toHaveCount(31);
        await expect(page.locator(".palette-result--focused")).toContainText("Search proof delayed 0");
        await header.press("ArrowDown");
        await header.dispatchEvent("keydown", { key: "Enter", isComposing: true });
        await expect(panel).toBeVisible();
        for (let index = 0; index < 28; index++) await header.press("ArrowDown");
        const scroll = page.locator(".palette-results-scroll");
        await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        await header.fill("replacement");
        await expect(page.locator(".palette-result--focused")).toHaveCount(0);
        await expect(first).toContainText("Search area replacement");
        areaMode = "empty";
        contentMode = "error";
        await header.fill("failure");
        await expect(page.locator(".palette-result")).toHaveCount(0);
        await expect(panel.locator(".slk-flower-spinner")).toHaveCount(0);
        contentMode = "empty";
        await header.fill("empty");
        await expect(first).toHaveCount(0);
        contentMode = "results";
        await header.fill("recovered");
        await expect(first).toContainText("recovered");
        areaMode = "region";
        holdAreas();
        await header.fill("cancelled");
        await expect(first).toContainText("cancelled");
        await close();
        releaseArea();
        await expect(panel).toBeHidden();
        areaMode = "empty";
        await header.click();
        await expect(header).toHaveValue("cancelled");
        await expect(first).toContainText("cancelled");

        await page.setViewportSize({ width: 390, height: 844 });
        const standalone = panel.locator("input");
        await expect(standalone).toBeFocused();
        await expect(standalone).toHaveValue("cancelled");
        await expect(panel).toHaveAttribute("aria-modal", "true");
        await standalone.press("Shift+Tab");
        assert(await panel.evaluate((element) => element.contains(document.activeElement)));
        await page.keyboard.press("Tab");
        await expect(standalone).toBeFocused();
        await close();
        await page.keyboard.press("Control+k");
        await expect(standalone).toBeFocused();
        await page.setViewportSize({ width: 1280, height: 900 });
        await expect(header).toBeFocused();
        await expect(header).toHaveValue("cancelled");
        await expect(panel).toHaveAttribute("aria-modal", "false");
        await close();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.keyboard.press("Meta+k");
        await expect(standalone).toBeFocused();
        await close();
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        await page.keyboard.press("Control+k");
        await expect(standalone).toBeFocused();
        await close();
        const opener = page.locator(".slk-header-surface button").first();
        await opener.click();
        await expect(standalone).toBeFocused();
        await close();
        await expect(opener).toBeFocused();

        // Exercise homepage fields, their teleported panels and an unrelated form.
        await page.setViewportSize({ width: 1280, height: 900 });
        await goto("/");
        areaMode = "municipality";
        const area = page.locator("[data-area-search-input]").first();
        const dropdown = page.locator(".slk-area-search-dropdown");
        await area.fill("Berlin");
        await expect(page.locator(".slk-area-search-result").first()).toContainText("Berlin");
        await area.press("Escape");
        await expect(dropdown).toBeHidden();
        await expect(area).toHaveValue("Berlin");
        await area.click();
        await expect(dropdown).toBeVisible();
        await area.press("Tab"); // May enter the component's filter controls.
        for (let index = 0; index < 3 && (await dropdown.isVisible()); index++) await page.keyboard.press("Tab");
        await expect(dropdown).toBeHidden();
        await area.click();
        await expect(dropdown).toBeVisible();
        await page.locator("input[type=email]").first().click();
        await expect(dropdown).toBeHidden();
        await area.click();
        await expect(page.locator(".slk-area-search-result").first()).toContainText("Berlin");
        holdAreas();
        await area.fill("Munich");
        await area.press("ArrowDown");
        await area.press("Enter");
        await expect(page).toHaveURL(`${origin}/`);
        await expect(page.locator(".slk-area-search-result")).toHaveCount(0);
        releaseArea();
        await expect(page.locator(".slk-area-search-result").first()).toContainText("Munich");
        await area.dispatchEvent("keydown", { key: "ArrowDown", isComposing: true });
        await expect(page.locator(".slk-area-search-result--focused")).toHaveCount(0);
        await area.press("Escape");
        await area.fill("again");
        await expect(page.locator(".slk-area-search-result").first()).toContainText("again");
        await area.press("Escape");
        await goto("/regions/080000000000");
        await expect(page.locator("[data-area-search-input]")).toHaveCount(0);
        await goto("/");
        const filterArea = page.locator("[data-area-search-input]").first();
        await filterArea.fill("Munich");
        await expect(page.locator(".slk-area-search-result").first()).toContainText("Munich");
        holdAreas();
        await page.locator(".slk-area-search-tab").last().click();
        await filterArea.press("ArrowDown");
        await filterArea.press("Enter");
        await expect(page).toHaveURL(`${origin}/`);
        await expect(page.locator(".slk-area-search-result")).toHaveCount(0);
        releaseArea();
        await expect(page.locator(".slk-area-search-result").first()).toContainText("Munich");
        await filterArea.press("Escape");
        // A focusable native result must survive the input's blur until click activation.
        await goto("/");
        await area.fill("pointer");
        const areaLink = page.locator(".slk-area-search-result").first();
        await expect(areaLink).toContainText("pointer");
        const areaTarget = await areaLink.getAttribute("href");
        assert(areaTarget);
        await areaLink.click();
        await expect(page).toHaveURL(`${origin}${areaTarget}`);
        await header.click();
        await header.fill("after-area-click");
        await expect(first).toContainText("after-area-click");
        await close();
        assert.deepEqual(errors, [], "Search interactions must not cause browser runtime errors");
        await touchSearch(browser, origin);
      } finally {
        releaseArea();
        await context.close();
      }
    },
  );
}

async function touchSearch(browser: Browser, origin: string) {
  const context = await newContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page: Page = await context.newPage();
    await page.route(
      (url) => url.pathname === "/api/area-search",
      (route) =>
        route.fulfill({
          json: Array.from({ length: 5 }, (_, index) => ({
            ars: `99999999999${index}`,
            name: `Touch municipality ${index}`,
            prefix: "Gemeinde",
            level: 5,
            isReasonableForMunicipalRating: true,
            stadtlandklimaDataAll: [],
          })),
        }),
    );
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    const input = page.locator("[data-area-search-input]").first();
    await input.fill("touch");
    const row = page.locator(".slk-area-search-result").first();
    await expect(row).toBeVisible();
    const bounds = await row.boundingBox();
    assert(bounds);
    const session = await context.newCDPSession(page);
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 5; step++)
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - step * 15 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page).toHaveURL(`${origin}/`);
    await input.press("Escape");
  } finally {
    await context.close();
  }
}
