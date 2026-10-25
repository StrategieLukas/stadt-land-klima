/** Explicit, read-only layout/interaction regression gate for dev or production. */
import assert from "node:assert/strict";
import { firefox, webkit } from "playwright";
import { launchBrowser, newContext, waitForHydration, collectPublicPageErrors } from "./lib/browser.js";

const target = new URL(process.argv[2] || "http://localhost:8080");
assert.ok(
  ["http:", "https:"].includes(target.protocol) && !target.username && !target.password,
  "Expected an HTTP(S) origin without credentials",
);
const origin = target.origin;
const selected = process.env.TEST_STYLE_BROWSER || "chromium";
if (selected !== "chromium" && selected !== "firefox" && selected !== "webkit")
  throw new Error("Unknown style-test browser");
const browser =
  selected === "chromium" ? await launchBrowser(true) : await { firefox, webkit }[selected].launch({ headless: true });
const started = performance.now();
try {
  for (const width of [1440, 390])
    for (const preference of ["light", "dark"] as const) {
      const context = await newContext(browser, { viewport: { width, height: 1000 }, colorScheme: preference });
      await context.route("**/*", async (route) => {
        if (!["GET", "HEAD"].includes(route.request().method())) await route.abort();
        else await route.continue();
      });
      await context.addInitScript((mode) => localStorage.setItem("slk_theme_preference", mode), preference);
      const page = await context.newPage();
      const errors = collectPublicPageErrors(page);
      try {
        for (const path of ["/", "/measures"]) {
          // Nuxt fetches build metadata after hydration. Hard navigation while it
          // is pending makes WebKit report the aborted fetch as an access error.
          const manifestReady = page
            .waitForResponse(
              (response) => /\/_nuxt\/builds\/meta\/[^/]+\.json$/.test(new URL(response.url()).pathname),
              { timeout: 10_000 },
            )
            .then(
              (response) => response.ok(),
              () => false,
            );
          const response = await page.goto(origin + path, { waitUntil: "domcontentloaded" });
          assert.equal(response?.status(), 200);
          await waitForHydration(page);
          assert.ok(await manifestReady, "Build metadata must settle before the next hard navigation");
          const layout = await page.evaluate(() => {
            const content = document.querySelector(".drawer-content");
            const rect = content?.getBoundingClientRect();
            const root = document.documentElement;
            const style = getComputedStyle(root);
            const button = document.querySelector(".canonical-button");
            return {
              x: rect?.x,
              width: rect?.width,
              viewport: document.body.clientWidth,
              overflow: root.scrollWidth > innerWidth,
              theme: root.dataset.theme,
              primary: style.getPropertyValue("--color-primary").trim().toLowerCase(),
              buttonRadius: button ? getComputedStyle(button).borderRadius : null,
            };
          });
          assert.equal(layout.theme, preference === "light" ? "staedteChallemgeTheme" : "staedteChallengeDark");
          assert.equal(layout.primary, "#afca0b");
          assert.equal(layout.x, 0, "Closed drawer must not reserve a sidebar column");
          assert.ok(Math.abs(layout.width! - layout.viewport) <= 1, "Content must span the viewport");
          assert.equal(layout.overflow, false);
          assert.equal(layout.buttonRadius, "6px", "CanonicalButton corners must survive the upgrade");
          const footer = page.locator("footer");
          const footerLayout = await footer.evaluate((element) => {
            const width = element.getBoundingClientRect().width;
            return {
              display: getComputedStyle(element).display,
              sections: [...element.children]
                .filter((child) => child.tagName === "DIV")
                .map((child) => child.getBoundingClientRect().width / width),
              inputBackground: getComputedStyle(element.querySelector('input[type="email"]')!).backgroundColor,
            };
          });
          assert.equal(footerLayout.display, "block", "Custom footer sections must not inherit DaisyUI grids");
          assert.ok(
            footerLayout.sections.every((ratio) => ratio > 0.8),
            "Footer sections span the available width",
          );
          assert.equal(
            footerLayout.inputBackground,
            preference === "light" ? "rgb(255, 255, 255)" : "rgb(23, 33, 43)",
            "Newsletter input keeps an opaque theme background",
          );
          if (path === "/measures") {
            const card = page.locator("main .card-body").first();
            await card.waitFor();
            assert.equal(await card.evaluate((element) => getComputedStyle(element).padding), "32px");
          }
        }
        // Replace only the browser-facing response; this gate never sends live newsletter mail.
        let subscriptions = 0;
        await page.route("**/api/newsletter-subscribe", async (route) => {
          subscriptions++;
          await route.fulfill({ json: { success: true, alreadySubscribed: false } });
        });
        const newsletter = page.locator("footer form");
        const email = newsletter.locator('input[type="email"]');
        await email.fill("invalid");
        await newsletter.locator('button[type="submit"]').click();
        assert.equal(subscriptions, 0, "Invalid email must not reach the subscription API");
        await email.fill("style-regression@example.invalid");
        await email.press("Enter");
        await newsletter.waitFor({ state: "detached" });
        assert.equal(subscriptions, 1, "Enter submits the newsletter form once and renders success");
        if (width < 640) {
          await page.locator("#page-drawer-toggle").click();
          await page.getByRole("dialog").waitFor({ state: "visible" });
          await page.locator("#page-drawer-toggle").click();
          await page.getByRole("dialog").waitFor({ state: "hidden" });
        } else {
          assert.equal(
            await page.locator(".drawer-side").evaluate((element) => getComputedStyle(element).position),
            "fixed",
          );
          await page.locator("#page-drawer").evaluate((element) => {
            (element as HTMLInputElement).checked = true;
            element.dispatchEvent(new Event("change", { bubbles: true }));
          });
          await page.locator(".drawer-side").waitFor({ state: "visible" });
          await page.keyboard.press("Escape");
          await page.locator(".drawer-side").waitFor({ state: "hidden" });
        }
        assert.deepEqual(errors, [], "No hydration/public-request/runtime failures");
        console.info(`[PASS] Styles: ${width}px ${preference}, centered layout, theme, cards, button and menu`);
      } finally {
        await context.close();
      }
    }
  console.info(`${selected} style regression gate passed in ${((performance.now() - started) / 1000).toFixed(2)}s`);
} finally {
  await browser.close();
}
