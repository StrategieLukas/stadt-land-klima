/** Explicit, read-only layout/interaction regression gate for dev or production. */
import assert from "node:assert/strict";
import { firefox, webkit, type Page } from "playwright";
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

async function assertFilterControls(page: Page) {
  const panel = page.locator(".slk-filter-panel");
  const disclosure = panel.locator(":scope > button");
  if (await disclosure.isVisible()) await disclosure.click();
  const controls = panel.locator(
    '.slk-filter-pill:visible, .canonical-toggle-group[data-padding="compact"] button:visible',
  );
  await controls.first().waitFor();
  const geometry = await controls.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        weight: style.fontWeight,
        padding: style.padding,
        radius: style.borderRadius,
        border: style.borderWidth,
      };
    }),
  );
  assert(geometry.length > 1, "Exercise real filter controls");
  assert(geometry[0]!.height >= 40, "Compact filter controls retain a usable touch target");
  for (const control of geometry)
    assert.deepEqual(control, geometry[0], "Pills, links and view toggles share geometry");
  if (new URL(page.url()).pathname === "/municipalities") {
    const rows = await panel.locator(".slk-filter-row").evaluateAll((elements) =>
      elements.map((element) => {
        const icon = element.querySelector(":scope > svg")!.getBoundingClientRect();
        const control = element.querySelector("button,a")!.getBoundingClientRect();
        return {
          iconX: icon.x,
          iconWidth: icon.width,
          iconHeight: icon.height,
          controlX: control.x,
          centreOffset: Math.abs(icon.y + icon.height / 2 - control.y - control.height / 2),
        };
      }),
    );
    assert.equal(rows.length, 3);
    assert.equal(rows[0]!.controlX, rows[2]!.controlX, "View and type filters start in the same control column");
    if (page.viewportSize()!.width < 640)
      assert.equal(rows[0]!.controlX, rows[1]!.controlX, "Wrapped catalogue controls retain the same phone column");
    for (const row of rows) {
      assert.equal(row.iconWidth, 24);
      assert.equal(row.iconHeight, 24);
      assert(row.centreOffset <= 1, "Leading icons align with the first control, including wrapped phone rows");
    }
    const icons = panel.locator(".slk-city-filter-icon");
    assert.equal(await icons.count(), 3, "Each type choice has one icon from the same family");
    for (const size of await icons.evaluateAll((elements) => elements.map((el) => [el.clientWidth, el.clientHeight])))
      assert.deepEqual(size, [24, 24]);
  }
  const contrasts = await controls.evaluateAll((elements) =>
    elements.map((element) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const ancestors: Element[] = [];
      for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
      context.fillStyle = "white";
      context.fillRect(0, 0, 1, 1);
      for (const ancestor of ancestors) {
        context.fillStyle = getComputedStyle(ancestor).backgroundColor;
        context.fillRect(0, 0, 1, 1);
      }
      const luminances: number[] = [];
      for (const color of ["transparent", getComputedStyle(element).color]) {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const channels = Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3)).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        luminances.push(channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722);
      }
      return (Math.max(...luminances) + 0.05) / (Math.min(...luminances) + 0.05);
    }),
  );
  assert(
    contrasts.every((ratio) => ratio >= 4.5),
    `Filter labels need 4.5:1 contrast: ${contrasts.join(", ")}`,
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
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
          const header = page.locator("header.slk-header-surface:visible");
          const glass = await header.evaluate((element) => {
            const style = getComputedStyle(element);
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const context = canvas.getContext("2d")!;
            context.fillStyle = style.backgroundColor;
            context.fillRect(0, 0, 1, 1);
            return {
              alpha: context.getImageData(0, 0, 1, 1).data[3]! / 255,
              blur: style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter"),
              stripeBackground: element.querySelector(".slk-navigation-strip")
                ? getComputedStyle(element.querySelector(".slk-navigation-strip")!).backgroundColor
                : null,
            };
          });
          assert.ok(Math.abs(glass.alpha - 0.82) < 0.01, "The header keeps its translucent theme surface");
          assert.match(glass.blur, /blur\(16px\)/, "Page content must blur behind the header");
          if (width >= 640)
            assert.equal(glass.stripeBackground, "rgba(0, 0, 0, 0)", "Navigation must share the header glass");
          await page.evaluate(() => window.scrollTo({ top: 500, behavior: "instant" }));
          await page.waitForFunction(() => window.scrollY >= 400);
          if (width >= 640) {
            await page.waitForFunction(
              () => getComputedStyle(document.querySelector("header.slk-header-surface")!).boxShadow !== "none",
            );
          } else {
            await page.waitForFunction(
              () => document.querySelector("header.slk-header-surface")!.getBoundingClientRect().bottom <= 0,
            );
          }
          await page.evaluate(() => window.scrollTo({ top: 420, behavior: "instant" }));
          await page.waitForFunction(
            () => document.querySelector("header.slk-header-surface")!.getBoundingClientRect().top >= -1,
          );
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          await page.waitForFunction(() => window.scrollY === 0);
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
        for (const path of ["/municipalities", "/measures", "/projects", "/stats"]) {
          await page.goto(origin + path, { waitUntil: "domcontentloaded" });
          await waitForHydration(page);
          await assertFilterControls(page);
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
