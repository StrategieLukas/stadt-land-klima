/** Browser regression with checked fixtures; no CMS writes. */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { assert, assertEqual } from "./lib/assert.js";
import { launchBrowser, newContext } from "./lib/browser.js";
import { WahlcheckSchema } from "../../../src/frontend/shared/contracts/elections.js";
const origin = process.env.SLK_TEST_FRONTEND_URL || "http://localhost:8080";
const questionId = "00000000-0000-4000-8000-000000000001";
const election = {
  id: "00000000-0000-4000-8000-000000000002",
  descriptor: "Automated Wahlcheck",
  is_party_election: false,
  custom_logo: null,
  response_cutoff_date: null,
  localteam: null,
};
const fixture = WahlcheckSchema.parse({
  municipality: { slug: "theme-test", name: "Automated Municipality" },
  election,
  questions: [
    { id: questionId, title: "Automated question", thesis: "Automated thesis", background_information: null },
  ],
  candidates: [
    {
      id: "00000000-0000-4000-8000-000000000003",
      name: "Automated candidate",
      party: null,
      has_answered: true,
      time_first_submitted: null,
      time_last_edited: null,
      answers: [{ question: questionId, response: 4, explanation: "Automated explanation" }],
    },
  ],
});
const browser = await launchBrowser(true);
const directory = resolve("../../.reports/wahlcheck-theme");
mkdirSync(directory, { recursive: true });
try {
  for (const mode of ["light", "dark"] as const) {
    const context = await newContext(browser);
    await context.addInitScript((preference) => localStorage.setItem("slk_theme_preference", preference), mode);
    await context.route(/\/api\/public\/wahlcheck\/theme-test(?:\?|$)/, (route) => route.fulfill({ json: fixture }));
    await context.route(/\/api\/public\/wahlcheck(?:\?|$)/, (route) =>
      route.fulfill({
        json: [
          {
            ...election,
            date_created: "2026-01-01T00:00:00Z",
            municipalitySlug: "theme-test",
            candidateCount: 1,
            questionCount: 1,
          },
        ],
      }),
    );
    await context.route("**/api/wahlcheck-complete", (route) => route.fulfill({ json: { success: true } }));
    const page = await context.newPage();
    page.on("pageerror", (error) => console.log("Browser error:", error.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.log("Console:", message.text());
    });
    await page.emulateMedia({ colorScheme: mode });
    const styles = () =>
      page
        .locator(".elections-flow h2")
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element);
          return { color: style.color, font: style.fontFamily, size: style.fontSize };
        });
    await page.goto(`${origin}/elections/wahlcheck`, { waitUntil: "domcontentloaded" });
    await page.getByText("Automated Wahlcheck", { exact: true }).waitFor();
    const normal = await styles();
    assertEqual(
      await page.locator('link[href="/wahlcheck/localzero.css"]').count(),
      0,
      "Normal view does not load theme CSS",
    );
    await page.goto(`${origin}/elections/wahlcheck?theme=localzero`, { waitUntil: "domcontentloaded" });
    await page.getByText("Automated Wahlcheck", { exact: true }).waitFor();
    const themed = await styles();
    assertEqual(themed.color, "rgb(1, 22, 51)", "LocalZero navy heading");
    assert(themed.font.includes("Wahlcheck Fabrikat"), "LocalZero font applied");
    assertEqual(themed.size, normal.size, "Theme preserves text size");
    await page.getByText("Automated Wahlcheck", { exact: true }).click();
    await page.locator(`input[name="question-${questionId}"]`).first().waitFor();
    assertEqual(new URL(page.url()).searchParams.get("theme"), "localzero", "Overview link preserves theme");
    const root = page.locator('.elections-flow[data-wahlcheck-theme="localzero"]');
    assertEqual(
      await root.evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(255, 255, 255)",
      "Light surface with either site preference",
    );
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.fonts.check('16px "Wahlcheck Fabrikat"')), "Self-hosted font loads");
    await page.addStyleTag({
      content: ".elections-flow * { transition: none !important; animation: none !important; }",
    });
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await page.locator(`input[name="question-${questionId}"][value="3"]`).check({ force: true });

    const selected = root.locator(".bg-rating-3").first();
    assertEqual(
      await selected.evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(163, 216, 105)",
      "LocalZero green answer",
    );
    assertEqual(
      await selected.locator("span").evaluate((element) => getComputedStyle(element).color),
      "rgb(1, 22, 51)",
      "Contrasting answer checkmark",
    );
    await page.clock.runFor(400);
    await page.locator(".weight-toggle-checkbox").first().check();
    assertEqual(
      await page
        .locator(".weight-toggle-checkbox")
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor),
      "rgb(255, 200, 12)",
      "LocalZero weighting yellow",
    );
    await page.clock.resume();
    await root.locator(".btn-primary").click();
    await page.locator('[data-testid="wahlcheck-results-overview"]').waitFor();
    await page.waitForURL((url) => url.searchParams.has("share"));
    assertEqual(new URL(page.url()).searchParams.get("theme"), "localzero", "Result URL preserves theme");
    assert(new URL(page.url()).searchParams.has("share"), "Shared answers are encoded");
    await page.screenshot({ path: resolve(directory, `results-${mode}.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/embed/wahlcheck/theme-test?theme=localzero`, { waitUntil: "domcontentloaded" });
    await page.locator(`input[name="question-${questionId}"]`).first().waitFor();
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "Mobile embed does not overflow",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/elections/wahlcheck`, { waitUntil: "domcontentloaded" });
    await page.getByText("Automated Wahlcheck", { exact: true }).waitFor();
    assertEqual(JSON.stringify(await styles()), JSON.stringify(normal), "Removing parameter restores normal view");
    assertEqual(
      await page.evaluate(() => localStorage.getItem("slk_theme_preference")),
      mode,
      "Site theme preference unchanged",
    );
    await context.close();
    console.log(`PASS: LocalZero flow, mobile embed and unchanged normal ${mode} view`);
  }
} finally {
  await browser.close();
}
