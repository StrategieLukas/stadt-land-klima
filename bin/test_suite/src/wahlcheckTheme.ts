/** Browser regression with checked fixtures; no CMS writes. */
import { mkdirSync } from "node:fs";
import type { Page } from "playwright";
import { resolve } from "node:path";
import { assert, assertEqual } from "./lib/assert.js";
import { launchBrowser, newContext } from "./lib/browser.js";
import { WahlcheckSchema } from "../../../src/frontend/shared/contracts/elections.js";
const origin = process.env.SLK_TEST_FRONTEND_URL || "http://localhost:8080";
const questionId = "00000000-0000-4000-8000-000000000001";
const secondQuestionId = "00000000-0000-4000-8000-000000000009";
const election = {
  id: "00000000-0000-4000-8000-000000000002",
  date_created: "2026-11-23T00:00:00+01:00",
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
    {
      id: questionId,
      title: "Automated question",
      thesis: "Automated thesis",
      background_information: null,
      sector: "energy",
    },
    {
      id: secondQuestionId,
      title: "Automated transport question",
      thesis: "Automated transport thesis",
      background_information: null,
      sector: "transport",
    },
  ],
  candidates: Array.from({ length: 5 }, (_, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + 3}`,
    name: `Automated candidate ${index + 1}`,
    party: null,
    has_answered: true,
    time_first_submitted: null,
    time_last_edited: null,
    answers: [
      { question: questionId, response: 4 - index, explanation: "Automated explanation" },
      { question: secondQuestionId, response: 0, explanation: "Automated explanation" },
    ],
  })),
});
async function assertCenteredIntroduction(page: Page) {
  const heading = page.locator(".elections-flow h2").first();
  assertEqual(
    await heading.evaluate((element) => getComputedStyle(element).textAlign),
    "center",
    "Wizard instructions are centered",
  );
  const logoOffset = await heading.evaluate((element) => {
    const header = element.parentElement!;
    const logo = header.querySelector("img")!.getBoundingClientRect();
    const container = header.getBoundingClientRect();
    return Math.abs((logo.left + logo.right) / 2 - (container.left + container.right) / 2);
  });
  assert(logoOffset <= 1, "Wizard logo is centered");
}

async function assertProjectFooter(page: Page) {
  const mobile = page.viewportSize()!.width < 640;
  const footer = page.getByTestId(mobile ? "wahlcheck-footer" : "wahlcheck-desktop-logos");
  assert(await footer.isVisible(), "Project logos are visible in the responsive position");
  assert(
    !(await page.getByTestId(mobile ? "wahlcheck-desktop-logos" : "wahlcheck-footer").isVisible()),
    "Project logos are not duplicated",
  );
  assertEqual(await footer.locator("a img").count(), 2, "Both project logos are present");
  assertEqual(
    await footer.locator("p").innerText(),
    "Dieser Wahlcheck ist entstanden als Kooperation von",
    "Cooperation credit is translated",
  );
  assertEqual(
    await footer.evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgba(0, 0, 0, 0)",
    "Cooperation branding has no background",
  );
  const lightArtwork =
    (await page.locator("html").getAttribute("data-theme")) === "staedteChallengeDark" &&
    (await page.locator(".elections-flow").getAttribute("data-wahlcheck-theme")) !== "localzero";
  assertEqual(
    (await footer.locator('a[href="https://localzero.net/"] img').getAttribute("src"))!.includes("LocalZero-logo.svg"),
    true,
    "LocalZero artwork stays yellow in every theme",
  );
  assertEqual(
    (await footer.locator('a[href="https://www.stadt-land-klima.de/"] img').getAttribute("src"))!.includes("Logo-dark"),
    lightArtwork,
    "SLK artwork follows its surface",
  );
  assertEqual(
    await footer.locator("a").first().getAttribute("href"),
    "https://www.stadt-land-klima.de/",
    "SLK appears before LocalZero",
  );
  await footer
    .locator("img")
    .evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
  const logos = await footer.locator("img").evaluateAll((images) =>
    images.map((image) => ({
      loaded: (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
      label: image.getAttribute("alt"),
      height: image.getBoundingClientRect().height,
    })),
  );
  assert(
    logos.every((logo) => logo.loaded && logo.label && !logo.label.startsWith("elections.")),
    "Translated project logos load",
  );
  assert(
    logos.every((logo) => Math.abs(logo.height - (mobile ? 40 : 32)) <= 1),
    "Project logos retain compact proportions",
  );
  const link = footer.locator("a").first();
  await footer.locator("a").last().focus();
  await page.keyboard.press("Shift+Tab");
  assert(await link.evaluate((element) => element.matches(":focus-visible")), "Project link has keyboard focus");
  const focus = await link.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outline: style.outlineStyle,
      color: style.outlineColor,
      background: getComputedStyle(element.closest(".elections-flow")!).backgroundColor,
    };
  });
  assertEqual(focus.outline, "solid", "Project links retain keyboard focus");
  assert(focus.color !== focus.background, "Project link focus contrasts with its footer");
}

async function assertCompactStatement(page: Page) {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const height = await page
      .locator(".question-content")
      .evaluate((element) => element.getBoundingClientRect().height);
    assert(height < 160, `A short statement must not reserve a large empty area at ${width}px`);
    await assertProjectFooter(page);
    const navigation = page.getByTestId("wahlcheck-question-navigation");
    assertEqual(
      await navigation.evaluate((element) => getComputedStyle(element).borderTopWidth),
      "0px",
      "Question navigation has no separator",
    );
    assert(!/\d+\s*\/\s*\d+/.test(await navigation.innerText()), "Question navigation has no answered counter");
    assert(
      !(await page.getByTestId("wahlcheck-questions-prev").getAttribute("class"))?.includes(
        "canonical-button--outline",
      ),
      "Back action uses the shared filled variant",
    );
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "Project footer fits the viewport",
    );
  }
}

async function assertAnswerFocus(page: Page, value: number) {
  const answer = page.locator(`input[name="question-${questionId}"][value="${value}"]`);
  await answer.check({ force: true });
  assertEqual(
    await answer.evaluate((input) => getComputedStyle(input.parentElement!).outlineStyle),
    "none",
    "Clicking an answer does not outline it",
  );
  await page.locator('.elections-flow input[type="checkbox"]').first().focus();
  await page.keyboard.press("Shift+Tab");
  assert(
    await answer.evaluate((input) => input.matches(":focus-visible")),
    "Keyboard navigation reaches the selected answer",
  );
  assertEqual(
    await answer.evaluate((input) => getComputedStyle(input.parentElement!).outlineStyle),
    "solid",
    "Keyboard navigation retains a visible answer outline",
  );
}

async function assertConfettiViewport(page: Page) {
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const confetti = page.getByTestId("wahlcheck-confetti");
  await confetti.waitFor();
  const results = page.getByTestId("wahlcheck-results-overview");
  const previousTransform = await results.evaluate((element) => {
    const wrapper = element.parentElement!;
    const previous = wrapper.style.transform;
    wrapper.style.transform = "translateX(30px)";
    return previous;
  });
  try {
    for (const scrollTop of [0, 400]) {
      await page.evaluate((top) => window.scrollTo(0, top), scrollTop);
      const coverage = await confetti.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          viewportWidth: document.documentElement.getBoundingClientRect().width,
          viewportHeight: innerHeight,
          pointerEvents: getComputedStyle(element).pointerEvents,
        };
      });
      assert(
        Math.abs(coverage.left) <= 1 && Math.abs(coverage.top) <= 1,
        "Confetti starts at the viewport origin despite the transformed wizard and scrolling",
      );
      assert(
        Math.abs(coverage.width - coverage.viewportWidth) <= 1 &&
          Math.abs(coverage.height - coverage.viewportHeight) <= 1,
        `Confetti covers the full viewport rather than the results panel: ${JSON.stringify(coverage)}`,
      );
      assertEqual(coverage.pointerEvents, "none", "Celebration does not intercept page controls");
    }
    assertEqual(await confetti.locator(".confetti").count(), 100, "Celebration retains all particles");
    await page.clock.runFor(3100);
    assertEqual(await confetti.count(), 0, "Celebration is removed after its existing duration");
  } finally {
    await results.evaluate((element, transform) => {
      element.parentElement!.style.transform = transform;
    }, previousTransform);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.clock.resume();
  }
}

async function assertSectorSummaries(page: Page) {
  await assertCenteredIntroduction(page);
  await page.getByTestId("wahlcheck-result-toggle").first().click();
  const best = page.getByTestId("wahlcheck-sector-best").first();
  const lowest = page.getByTestId("wahlcheck-sector-lowest").first();
  await best.waitFor();
  const colours = await Promise.all(
    [best, lowest].map((box) => box.evaluate((element) => getComputedStyle(element).backgroundColor)),
  );
  assert(
    colours.every((colour) => colour !== "rgba(0, 0, 0, 0)"),
    "Both sector summaries have tinted surfaces",
  );
  assert(colours[0] !== colours[1], "Best and lowest sector summaries use distinct tints");
}

const browser = await launchBrowser(true);
const directory = resolve("../../.reports/wahlcheck-theme");
mkdirSync(directory, { recursive: true });
try {
  for (const mode of ["light", "dark"] as const) {
    const context = await newContext(browser);
    await context.addInitScript((preference) => localStorage.setItem("slk_theme_preference", preference), mode);
    let longStatements = false;
    let dateCreated: string | null = election.date_created;
    await context.route(/\/api\/public\/wahlcheck\/theme-test(?:\?|$)/, (route) =>
      route.fulfill({
        json: {
          ...fixture,
          election: { ...fixture.election, date_created: dateCreated, date_updated: "2027-01-01T00:00:00Z" },
          questions: longStatements
            ? fixture.questions.map((question) => ({
                ...question,
                thesis: "Long statement with enough text to require keyboard scrolling. ".repeat(100),
              }))
            : fixture.questions,
        },
      }),
    );
    await context.route(/\/api\/public\/wahlcheck(?:\?|$)/, (route) =>
      route.fulfill({
        json: [0, 1, 2].map((index) => ({
          ...election,
          id: `${election.id}-${index}`,
          descriptor: index === 0 ? election.descriptor : `Automated election ${index + 1}`,
          date_created: "2026-01-01T00:00:00Z",
          municipalitySlug: "theme-test",
          candidateCount: fixture.candidates.length,
          questionCount: fixture.questions.length,
        })),
      }),
    );
    await context.route("**/api/wahlcheck-complete", (route) => route.fulfill({ json: { success: true } }));
    const page = await context.newPage();
    const hydrationErrors: string[] = [];
    page.on("pageerror", (error) => console.log("Browser error:", error.message));
    page.on("console", (message) => {
      if (message.type() === "error") console.log("Console:", message.text());
      if (/hydration.*mismatch/i.test(message.text())) hydrationErrors.push(message.text());
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
    assertEqual(
      await page.locator('.elections-flow img[src*="Stadt-Land-Klima-Logo"]').count(),
      0,
      "Overview relies on the shared SLK masthead without adding another logo",
    );
    assertEqual(
      await page.getByRole("heading", { level: 1 }).evaluate((element) => getComputedStyle(element).textAlign),
      "center",
      "Overview introduction stays centered",
    );
    assertEqual(await page.locator(".elections-flow ol li svg").count(), 3, "All instruction steps have local icons");
    const columns = await page
      .locator('.elections-flow a[href^="/elections/wahlcheck/theme-test"]')
      .first()
      .evaluate((element) => getComputedStyle(element.parentElement!).gridTemplateColumns.split(" ").length);
    assertEqual(columns, 3, "Desktop overview displays three election columns");
    const normal = await styles();
    assertEqual(
      await page.locator('link[href="/wahlcheck/localzero.css"]').count(),
      0,
      "Normal view does not load theme CSS",
    );
    await page.clock.install();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.goto(`${origin}/elections/wahlcheck/theme-test`, { waitUntil: "domcontentloaded" });
    await page.locator(`input[name="question-${questionId}"]`).first().waitFor();
    await page.addStyleTag({
      content: ".elections-flow * { transition: none !important; animation: none !important; }",
    });
    await assertCenteredIntroduction(page);
    await assertCompactStatement(page);
    assertEqual(
      await page
        .locator('.elections-flow img[src*="Klima-Wahlcheck-Logo"]')
        .evaluate((image) => (image as HTMLImageElement).src.includes("Logo-dark")),
      mode === "dark",
      "Fallback logo lettering follows the normal site theme",
    );
    assert(await page.getByTestId("wahlcheck-questions-prev").isDisabled(), "First question cannot navigate back");
    assert(await page.getByTestId("wahlcheck-questions-next").isEnabled(), "Questions can still be skipped with next");
    for (const value of [4, 2, 0, 4]) await assertAnswerFocus(page, value);
    await page.clock.runFor(700);
    await page.locator(`input[name="question-${secondQuestionId}"][value="4"]`).check({ force: true });
    await page.clock.runFor(700);
    await page.locator(".weight-toggle-checkbox").first().waitFor();
    await assertCenteredIntroduction(page);
    await page.clock.resume();
    await page.getByTestId("wahlcheck-summary-next").click();
    await page.getByTestId("wahlcheck-results-overview").waitFor();
    await assertConfettiViewport(page);
    await assertSectorSummaries(page);
    assertEqual(
      await page.getByTestId("wahlcheck-results-prev").getAttribute("type"),
      "button",
      "Canonical wizard actions remain native buttons",
    );
    await page.getByTestId("wahlcheck-results-prev").click();
    await page.locator(".weight-toggle-checkbox").first().waitFor();
    await page.getByTestId("wahlcheck-summary-prev").click();
    await page.locator(`input[name="question-${secondQuestionId}"]`).first().waitFor();
    await page.getByTestId("wahlcheck-questions-prev").click();
    await page.locator(`input[name="question-${questionId}"]`).first().waitFor();
    await page.evaluate(() => sessionStorage.clear());
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
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
    await assertCenteredIntroduction(page);
    assert(
      !(await page.locator('.elections-flow img[src*="Klima-Wahlcheck-Logo"]').getAttribute("src"))?.includes(
        "Logo-dark",
      ),
      "LocalZero retains the logo with dark lettering",
    );
    await assertCompactStatement(page);
    await assertAnswerFocus(page, 3);

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
    await page.locator(`input[name="question-${secondQuestionId}"][value="4"]`).check({ force: true });
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
    await page.getByTestId("wahlcheck-summary-next").click();
    await page.locator('[data-testid="wahlcheck-results-overview"]').waitFor();
    await assertConfettiViewport(page);
    await assertSectorSummaries(page);
    await page.waitForURL((url) => url.searchParams.has("share"));
    assertEqual(new URL(page.url()).searchParams.get("theme"), "localzero", "Result URL preserves theme");
    assert(new URL(page.url()).searchParams.has("share"), "Shared answers are encoded");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const preview = page.getByTestId("wahlcheck-personal-sharepic");
      assertEqual(
        await preview.getByTestId("wahlcheck-sharepic-matches").locator(":scope > div").count(),
        5,
        "Personal share preview retains all five matches",
      );
      const spacing = await preview.evaluate((element) => {
        const matches = element.querySelector('[data-testid="wahlcheck-sharepic-matches"]');
        const cta = element.querySelector('[data-testid="wahlcheck-sharepic-cta"]');
        if (!matches || !cta) throw new Error("Share preview is missing matches or its call to action");
        return {
          gap: cta.getBoundingClientRect().top - matches.getBoundingClientRect().bottom,
          safeArea: element.getBoundingClientRect().bottom - cta.getBoundingClientRect().bottom,
          clipped: element.scrollHeight > element.clientHeight + 1,
          clippedRows: [...matches.children].some((row) => row.scrollHeight > row.clientHeight + 1),
        };
      });
      assert(spacing.gap >= 0, `Share matches must not overlap the call to action at ${width}px`);
      assert(spacing.safeArea >= 60, `Share preview preserves its story safe area at ${width}px`);
      assert(!spacing.clipped, `Share preview content must fit at ${width}px`);
      assert(!spacing.clippedRows, `All five match cards must fit their content at ${width}px`);
    }
    await page.screenshot({ path: resolve(directory, `results-${mode}.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/embed/wahlcheck/theme-test?theme=localzero`, { waitUntil: "domcontentloaded" });
    await page.locator(`input[name="question-${questionId}"]`).first().waitFor();
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "Mobile embed does not overflow",
    );
    await assertProjectFooter(page);
    const navigation = page.getByTestId("wahlcheck-question-navigation");
    assertEqual(
      await navigation.evaluate((element) => getComputedStyle(element).borderTopWidth),
      "0px",
      "Question navigation has no separator",
    );
    assert(!/\d+\s*\/\s*\d+/.test(await navigation.innerText()), "Question navigation has no answered counter");
    assert(
      !(await page.getByTestId("wahlcheck-questions-prev").getAttribute("class"))?.includes(
        "canonical-button--outline",
      ),
      "Back action uses the shared filled variant",
    );
    await page.clock.resume();
    longStatements = true;
    for (const theme of ["", "?theme=localzero"]) {
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${origin}/embed/wahlcheck/theme-test${theme}`, { waitUntil: "domcontentloaded" });
        const statement = page.locator(".question-content");
        await statement.waitFor();
        const dimensions = await statement.evaluate((element) => ({
          height: element.clientHeight,
          content: element.scrollHeight,
        }));
        assertEqual(dimensions.height, width < 640 ? 320 : 224, "Long statements retain the scrollable height cap");
        assert(dimensions.content > dimensions.height, "Long statements have scrollable content");
        await statement.focus();
        await page.keyboard.press("End");
        await page.waitForFunction(() => (document.querySelector(".question-content")?.scrollTop ?? 0) > 0);
      }
    }
    longStatements = false;
    for (const created of ["2026-11-22T22:59:59.999Z", null, election.date_created]) {
      dateCreated = created;
      const branded = created === election.date_created;
      for (const path of ["/elections/wahlcheck/theme-test", "/embed/wahlcheck/theme-test?theme=localzero"]) {
        await page.evaluate(() => sessionStorage.clear());
        await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
        await page.locator(`input[name="question-${questionId}"]`).first().waitFor();
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          if (branded) await assertProjectFooter(page);
          else {
            assertEqual(
              await page.locator(".wahlcheck-footer").count(),
              0,
              "Old/undated elections omit all cooperation branding despite recent updates",
            );
            if (width === 1440) {
              // Measure in one frame: the wizard may still be sliding into place.
              const rightOffset = await page.getByTestId("wahlcheck-question-navigation").evaluate((element) => {
                const button = element.querySelector('[data-testid="wahlcheck-questions-next"]');
                if (!button) throw new Error("Missing question action");
                return element.getBoundingClientRect().right - button.getBoundingClientRect().right;
              });
              assert(
                Math.abs(rightOffset) <= 1,
                `Unbranded desktop question actions remain right aligned: offset ${rightOffset}`,
              );
            }
          }
        }
        const shared = new URL(`${origin}${path}`);
        shared.searchParams.set(
          "share",
          Buffer.from(
            encodeURIComponent(
              JSON.stringify({ electionId: election.id, answers: { [questionId]: 4 }, doubleWeighted: [] }),
            ),
          ).toString("base64"),
        );
        await page.goto(shared.href, { waitUntil: "domcontentloaded" });
        await page.getByTestId("wahlcheck-results-overview").waitFor();
        assertEqual(
          await page.getByTestId("wahlcheck-footer").count(),
          branded ? 1 : 0,
          "Shared results use the same creation-date cutoff",
        );
        await page.getByTestId("wahlcheck-results-prev").click();
        await page.locator(".weight-toggle-checkbox").first().waitFor();
        assertEqual(
          await page.getByTestId("wahlcheck-footer").count(),
          branded ? 1 : 0,
          "Summary uses the same creation-date cutoff",
        );
      }
    }
    dateCreated = election.date_created;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${origin}/elections/wahlcheck`, { waitUntil: "domcontentloaded" });
    await page.getByText("Automated Wahlcheck", { exact: true }).waitFor();
    assertEqual(JSON.stringify(await styles()), JSON.stringify(normal), "Removing parameter restores normal view");
    assertEqual(
      await page.evaluate(() => localStorage.getItem("slk_theme_preference")),
      mode,
      "Site theme preference unchanged",
    );
    assertEqual(hydrationErrors.length, 0, "Theme-specific artwork hydrates without mismatches");
    await context.close();
    console.log(`PASS: LocalZero flow, mobile embed and unchanged normal ${mode} view`);
  }
} finally {
  await browser.close();
}
