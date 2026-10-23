import { newContext } from "../lib/browser.js";
import type { Browser } from "playwright";
import { assert, assertIncludes, assertNotIncludes } from "../lib/assert.js";
import type { TestFixture } from "../lib/fixture.js";
import type { TestRunner } from "../lib/runner.js";

export async function runDataAvailabilityFlow(
  runner: TestRunner,
  fixture: TestFixture,
  browser: Browser,
): Promise<void> {
  const { admin, config } = fixture;
  const original = await admin.request<{
    id?: string;
    under_construction?: boolean;
    under_construction_explanation?: string | null;
  } | null>("GET", "/items/data_page_config");
  let createdId: string | undefined;
  try {
    await runner.step("Data analyses: translated construction notice and temporary route gates", async () => {
      const updated = await admin.request<{ id: string }>("PATCH", "/items/data_page_config", {
        body: { under_construction: true, under_construction_explanation: null },
      });
      if (!original?.id) createdId = updated.id;
      for (const [locale, title] of [
        ["de-DE", "Datenanalysen sind bald verfügbar"],
        ["en-GB", "Data analyses are coming soon"],
        ["it-IT", "Le analisi dei dati saranno presto disponibili"],
      ]) {
        const context = await newContext(browser);
        try {
          await context.addCookies([{ name: "slk_locale", value: locale, url: config.frontendUrl }]);
          const page = await context.newPage();
          const requests: string[] = [];
          page.on("request", (request) => {
            if (/\/api\/(stadtlandzahl|area-by-slug)/.test(request.url())) requests.push(request.url());
          });
          const response = await page.goto(`${config.frontendUrl}/data`);
          assert(response?.status() === 200, "The construction notice should be a usable page");
          assertIncludes(
            await page.locator(".data-construction-notice").innerText(),
            title,
            `Construction notice should be translated for ${locale}`,
          );
          assert(
            (await page.locator("#data-map, #data-collections").count()) === 0,
            "Unavailable maps and collections should not be mounted",
          );
          assert(requests.length === 0, "The construction page should not request area or data APIs");
        } finally {
          await context.close();
        }
      }
      for (const path of ["/data/bundesland-berlin", "/data/invalid-area/invalid-product"]) {
        const response = await fetch(`${config.frontendUrl}${path}`, { redirect: "manual" });
        assert(
          response.status === 302 && response.headers.get("location") === "/data",
          "Area and product routes should temporarily redirect before loading analysis data",
        );
      }
    });
    await runner.step("Data analyses: custom explanation, themes and restored availability", async () => {
      const explanation = "We are preparing new analyses.\n<em>Back soon.</em>";
      await admin.request("PATCH", "/items/data_page_config", {
        body: { under_construction_explanation: explanation },
      });
      for (const theme of ["light", "dark"]) {
        const context = await newContext(browser, { viewport: { width: theme === "light" ? 390 : 1440, height: 900 } });
        try {
          await context.addInitScript((value) => localStorage.setItem("slk_theme_preference", value), theme);
          const page = await context.newPage();
          await page.goto(`${config.frontendUrl}/data`);
          const notice = page.locator(".data-construction-notice");
          assertIncludes(await notice.innerText(), explanation, "Custom text should retain line breaks");
          assert(
            (await notice.locator("em").count()) === 0,
            "Custom explanations should be rendered safely as plain text",
          );
          assert(
            await notice.evaluate((el) => getComputedStyle(el).backgroundColor !== "rgb(255, 255, 255)"),
            "The notice should use a tinted theme surface",
          );
          assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
            "Construction notices should fit mobile and desktop widths",
          );
        } finally {
          await context.close();
        }
      }
      await admin.request("PATCH", "/items/data_page_config", { body: { under_construction: false } });
      const response = await fetch(`${config.frontendUrl}/data`);
      assert(response.ok, "Disabling construction mode should restore the data page");
      const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
      assertIncludes(html, 'id="data-map"', "Normal map presentation should return");
      assertIncludes(html, 'id="data-collections"', "Normal collections should return");
      assertNotIncludes(
        html,
        'id="data-construction-title"',
        "The custom explanation should be hidden when the toggle is off",
      );
    });
  } finally {
    if (createdId) await admin.deleteItem("data_page_config", createdId);
    else
      await admin.request("PATCH", "/items/data_page_config", {
        body: {
          under_construction: original?.under_construction ?? false,
          under_construction_explanation: original?.under_construction_explanation ?? null,
        },
      });
  }
}
