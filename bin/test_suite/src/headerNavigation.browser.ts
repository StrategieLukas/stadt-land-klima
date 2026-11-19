import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { expect } from "@playwright/test";
import { launchBrowser, newContext, waitForHydration } from "./lib/browser.js";

// Read-only acceptance against the running website and its actual CMS navigation.
const origin = process.env.TEST_FRONTEND_URL ?? "http://localhost:8080";
const report = new URL("../../../.reports/checks/header-navigation/", import.meta.url);
mkdirSync(report, { recursive: true });
const browser = await launchBrowser(true);
try {
  for (const width of [1920, 1280, 768, 340]) {
    const context = await newContext(browser, { viewport: { width, height: 900 }, colorScheme: "dark" });
    const page = await context.newPage();
    for (const route of ["/events", "/news"]) {
      await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
      await waitForHydration(page);
      const timeline = page.locator(".slk-timeline-navigation");
      assert.notEqual(
        await timeline.evaluate((element) => getComputedStyle(element).boxShadow),
        "none",
        "Month strip casts a downward shadow",
      );
      await expect
        .poll(async () =>
          timeline.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return Math.max(
              Math.abs(rect.left),
              Math.abs(rect.right - document.documentElement.getBoundingClientRect().right),
            );
          }),
        )
        .toBeLessThan(1.5);
      const links = timeline.locator(".slk-timeline-links");
      const geometry = await links.evaluate((strip) => {
        const content = strip.parentElement!.parentElement!;
        const page = content.getBoundingClientRect();
        const bounds = strip.getBoundingClientRect();
        const style = getComputedStyle(strip);
        const contentStyle = getComputedStyle(content);
        const pills = Array.from(strip.querySelectorAll("a"));
        const first = pills[0]?.getBoundingClientRect();
        const last = pills.at(-1)?.getBoundingClientRect();
        return {
          clipStart: bounds.left,
          clipEnd: bounds.right,
          start: bounds.left + parseFloat(style.paddingLeft),
          end: bounds.right - parseFloat(style.paddingRight),
          pageStart: page.left + parseFloat(contentStyle.paddingLeft),
          pageEnd: page.right - parseFloat(contentStyle.paddingRight),
          scrolls: strip.scrollWidth > strip.clientWidth + 1,
          first: first?.left,
          last: last?.right,
          heights: pills.map((pill) => pill.getBoundingClientRect().height),
          fontSizes: pills.map((pill) => parseFloat(getComputedStyle(pill).fontSize)),
        };
      });
      assert(Math.abs(geometry.start - geometry.pageStart) < 1.5, "Month links start at the page content edge");
      assert(Math.abs(geometry.end - geometry.pageEnd) < 1.5, "Month links end at the page content edge");
      assert(Math.abs(geometry.clipStart - geometry.pageStart) < 1.5, "Scrolled links clip at the page start");
      assert(Math.abs(geometry.clipEnd - geometry.pageEnd) < 1.5, "Scrolled links clip at the page end");
      assert(geometry.heights.length, "Timeline has month links");
      assert(
        geometry.heights.every((height) => height <= 30),
        "Month pills remain compact",
      );
      assert(
        geometry.fontSizes.every((size) => size === 12),
        "Month labels use the compact type size",
      );
      if (!geometry.scrolls) {
        assert(geometry.first !== undefined && Math.abs(geometry.first - geometry.start) < 1.5);
        assert(
          geometry.last !== undefined && Math.abs(geometry.last - geometry.end) < 1.5,
          "Pills fill the page-wide row",
        );
      }
      await page.evaluate(() => window.scrollTo(0, 600));
      await expect
        .poll(async () =>
          timeline.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return Math.max(
              Math.abs(rect.left),
              Math.abs(rect.right - document.documentElement.getBoundingClientRect().right),
            );
          }),
        )
        .toBeLessThan(1.5);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    }
    if (width >= 640) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator(".header-nav-reveal")).toHaveAttribute("data-navigation-visible", "true");
      const strip = page.locator(".slk-navigation-strip");
      const plainLink = strip.locator('li > a[href^="/"]').first();
      const href = await plainLink.getAttribute("href");
      assert(href, "Published navigation must include a plain internal link");
      // Exercise client navigation, then a direct load of the same destination.
      await plainLink.click();
      await page.waitForURL((url) => url.pathname === href);
      for (const reload of [false, true]) {
        if (reload) await page.reload({ waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        await expect(plainLink).toHaveAttribute("aria-current", "page");
        // Hover must not mask a missing current-page style.
        await page.mouse.move(0, 899);
        const originalTheme = await page.locator("html").getAttribute("data-theme");
        for (const theme of ["staedteChallemgeTheme", "staedteChallengeDark"]) {
          await page.evaluate((value) => {
            document.documentElement.dataset.theme = value;
          }, theme);
          await expect
            .poll(() =>
              plainLink.evaluate((element) => {
                const probe = document.createElement("span");
                probe.style.backgroundColor = "var(--slk-surface-subdued)";
                element.append(probe);
                const expected = getComputedStyle(probe).backgroundColor;
                probe.remove();
                return getComputedStyle(element).backgroundColor === expected;
              }),
            )
            .toBe(true);
        }
        await page.evaluate((theme) => {
          if (theme) document.documentElement.dataset.theme = theme;
          else delete document.documentElement.dataset.theme;
        }, originalTheme);
      }
      await page.goto(`${origin}/news`, { waitUntil: "domcontentloaded" });
      await waitForHydration(page);
      await expect(plainLink).not.toHaveAttribute("aria-current", "page");
      await expect(plainLink).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await page.evaluate(() => window.scrollTo(0, 0));
      const input = page.locator(".slk-header-surface input").first();
      await expect
        .poll(async () => page.locator(".slk-header-surface").evaluate((el) => el.getBoundingClientRect().height))
        .toBeGreaterThan(120);
      // Wait for the logo transition rather than sampling an intermediate frame.
      await page.waitForTimeout(350);
      const assertHeaderAlignment = async () => {
        const centers = await page
          .locator(".slk-header-surface > div")
          .first()
          .evaluate((row) => {
            const [logo, search, actions] = Array.from(row.children);
            if (!logo || !search || !actions) throw new Error("Header row must have three columns");
            return [logo, search, actions, ...actions.querySelectorAll("button, a")]
              .map((element) => element.getBoundingClientRect())
              .filter((rect) => rect.width > 0 && rect.height > 0)
              .map((rect) => rect.top + rect.height / 2);
          });
        assert(
          Math.max(...centers) - Math.min(...centers) < 1,
          `Logo, search and actions share a vertical center at ${width}: ${JSON.stringify(centers)}`,
        );
      };
      await assertHeaderAlignment();
      const before = await input.boundingBox();
      assert(before);
      await page.evaluate(() => window.scrollTo(0, 600));
      await expect
        .poll(async () => page.locator(".slk-header-surface").evaluate((el) => el.getBoundingClientRect().height))
        .toBeLessThan(100);
      await page.waitForTimeout(350);
      await assertHeaderAlignment();
      const after = await input.boundingBox();
      assert(after);
      // Controls move upward together as the logo shrinks; input size and horizontal position stay fixed.
      for (const dimension of ["x", "width", "height"] as const)
        assert(
          Math.abs(before[dimension] - after[dimension]) < 1,
          `Stable input ${dimension} at ${width}: ${JSON.stringify({ before, after })}`,
        );
      const reveal = page.locator(".header-nav-reveal");
      await expect(reveal).toHaveAttribute("data-navigation-visible", "false");
      await page.evaluate(async () => {
        for (const step of [-2, 2, -2, 2]) {
          window.scrollTo({ top: window.scrollY + step, behavior: "instant" });
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      });
      await expect(reveal).toHaveAttribute("data-navigation-visible", "false");
      const fullHeight = await reveal
        .locator(".header-nav-content")
        .evaluate((element) => element.getBoundingClientRect().height);
      const heights = await page.evaluate(async () => {
        const strip = document.querySelector(".header-nav-reveal")!;
        const samples: number[] = [];
        for (let index = 0; index < 20; index++) {
          window.scrollTo({ top: window.scrollY - 2, behavior: "instant" });
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          samples.push(strip.getBoundingClientRect().height);
        }
        return samples;
      });
      await expect(reveal).toHaveAttribute("data-navigation-visible", "true");
      assert(
        heights.some((height) => height > 0 && height < fullHeight - 0.1),
        `Slow scrolling reveals intermediate animation frames at ${width}: ${JSON.stringify({ fullHeight, heights })}`,
      );
      for (let index = 1; index < heights.length; index++)
        assert(
          heights[index]! >= heights[index - 1]! - 0.1,
          "Reveal progresses without reversing on small scroll events",
        );
      await expect.poll(async () => (await reveal.boundingBox())?.height ?? 0).toBeGreaterThan(fullHeight - 0.5);
      assert.equal(await reveal.evaluate((element) => getComputedStyle(element).overflow), "hidden");
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(350);
      await input.fill("Berlin");
      const palette = page.locator(".palette-panel");
      const backdrop = page.locator(".slk-modal-backdrop:visible");
      await expect(palette).toBeVisible();
      await expect(backdrop).toBeVisible();
      const triggers = page.locator("[data-nav-trigger]");
      assert(await triggers.count(), "Published navigation must include a dropdown");
      await triggers.first().hover();
      await expect(page.locator(".navigation-panel")).toBeVisible();
      await expect(palette).toBeHidden();
      await expect(backdrop).toBeVisible();
      // The tint remains at full opacity and below the dropdown in both themes.
      const originalTheme = await page.locator("html").getAttribute("data-theme");
      for (const theme of ["staedteChallemgeTheme", "staedteChallengeDark"]) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme);
        const tint = await backdrop.evaluate((element) => {
          const style = getComputedStyle(element);
          return { color: style.backgroundColor, opacity: style.opacity };
        });
        assert.match(tint.color, /[,/]\s*0\.5\)$/, `Translucent search tint stays visible during navigation: ${theme}`);
        assert.equal(tint.opacity, "1", "Hovering navigation must not fade the backdrop");
      }
      await page.evaluate((theme) => {
        if (theme) document.documentElement.dataset.theme = theme;
      }, originalTheme);
      await page.locator(".navigation-panel").hover();
      await expect(input).toHaveValue("Berlin");
      if ((await triggers.count()) > 1) {
        await triggers.nth(1).hover();
        await expect(palette).toBeHidden();
        await expect(backdrop).toBeVisible();
      }
      // Escape from the still-focused embedded input dismisses navigation first.
      await page.keyboard.press("Escape");
      await expect(page.locator(".navigation-panel")).toBeHidden();
      await expect(palette).toBeVisible();
      await expect(backdrop).toBeVisible();
      await expect(input).toHaveValue("Berlin");
      await triggers.first().hover();
      await expect(palette).toBeHidden();
      await expect(backdrop).toBeVisible();
      await input.hover();
      await expect(palette).toBeVisible();
      await expect(input).toHaveValue("Berlin");
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(await palette.evaluate((element) => getComputedStyle(element).transitionDuration), "0s");
      assert.equal(await reveal.evaluate((element) => getComputedStyle(element).transitionDuration), "0s");
      assert.equal(
        await page.locator(".header-logo").evaluate((element) => getComputedStyle(element).transitionDuration),
        "0s",
      );
      await page.keyboard.press("Escape");
      await expect(palette).toBeHidden();
      await expect(page.locator(".slk-modal-backdrop:visible")).toHaveCount(0);
    }
    await page.screenshot({ path: new URL(`news-${width}.png`, report).pathname });
    await context.close();
    console.log(`Header and timeline acceptance passed at ${width}px`);
  }
} finally {
  await browser.close();
}
