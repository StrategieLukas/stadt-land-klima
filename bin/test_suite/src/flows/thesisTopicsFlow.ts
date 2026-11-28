import { rejects } from "node:assert/strict";
import type { Browser } from "playwright";
import { ThesisTopicsResponseSchema } from "../../../../src/frontend/shared/contracts/thesisTopics.js";
import { assert, assertNotIncludes } from "../lib/assert.js";
import { newContext, waitForHydration } from "../lib/browser.js";
import type { TestFixture } from "../lib/fixture.js";
import type { TestRunner } from "../lib/runner.js";

export async function runThesisTopicsFlow(runner: TestRunner, fixture: TestFixture, browser: Browser): Promise<void> {
  const { admin, config } = fixture;
  const collection = "thesis_topics";
  const path = "/abschlussarbeiten";
  const defaultTitle = `Thesis A ${config.runId}`;
  const masterTitle = `Thesis B ${config.runId}`;
  const preview = "Compare local climate plans.";
  const ids: string[] = [];

  async function createTopic(input: Record<string, unknown>) {
    const item = await admin.createItem<{ id: string; status: string }>(collection, {
      description:
        "Explore **local climate action**.\n\n- First step\n- Second step\n\n<span data-raw-html>Text</span>",
      categories: ["political_science"],
      ...input,
    });
    ids.push(item.id);
    return item;
  }

  async function listTopics() {
    const response = await fetch(`${config.frontendUrl}/api/public/thesis-topics`);
    assert(response.ok, `Thesis topics API should return 200, got ${response.status}`);
    const body: unknown = await response.json();
    assertNotIncludes(JSON.stringify(body), '"status":', "The list DTO should omit publication status");
    return ThesisTopicsResponseSchema.parse(body).topics;
  }

  try {
    await runner.step("Thesis topics: defaults and publication boundaries", async () => {
      await rejects(
        () => createTopic({ title: `Thesis without a category ${config.runId}`, categories: [] }),
        /failed with 400/,
      );
      const defaults = await createTopic({
        title: defaultTitle,
        categories: ["public_administration", "political_science"],
      });
      const master = await createTopic({
        title: masterTitle,
        short_description: preview,
        categories: ["computer_and_data_science", "climate_and_environmental_engineering", "climate_action_management"],
        levels: ["master"],
      });
      const withdrawn = await createTopic({ title: `Thesis C ${config.runId}` });
      const malformed = await createTopic({ title: `Thesis D ${config.runId}`, categories: ["unknown"] });

      const topics = await listTopics();
      assert(defaults.status === "published", "New thesis topics should be public by default");
      const listedDefault = topics.find(({ id }) => id === defaults.id);
      const listedMaster = topics.find(({ id }) => id === master.id);
      assert(listedDefault?.levels.join(",") === "bachelor,master,phd", "All three degree levels should be selected");
      assert(listedDefault.short_description === null, "Older topics can omit the short description");
      assert(listedDefault.categories.join(",") === "political_science", "Politics and administration merge once");
      assert(listedMaster?.short_description === preview, "The published topic should include the short description");
      assert(
        listedMaster.categories.join(",") === "data_science,climate_action_management",
        "Engineering and climate management merge once",
      );
      assert(
        topics.some(({ id }) => id === withdrawn.id),
        "The topic should be listed before a status change",
      );
      const direct = await fetch(`${config.backendUrl}/items/${collection}`);
      assert(!topics.some(({ id }) => id === malformed.id), "Malformed imports should be omitted from the listing");
      assert(direct.status === 403, "Anonymous Directus readers should have no access to thesis topics");

      await admin.updateItem(collection, withdrawn.id, { status: "completed" });
      assert(!(await listTopics()).some(({ id }) => id === withdrawn.id), "Completed topics should be hidden");
      await admin.updateItem(collection, withdrawn.id, { status: "in_progress" });
      assert(!(await listTopics()).some(({ id }) => id === withdrawn.id), "In-progress topics should be hidden");
    });

    await runner.step("Thesis topics: category filters, keyboard disclosure and protected contact", async () => {
      for (const [theme, width] of [
        ["light", 1440],
        ["dark", 390],
      ] as const) {
        const context = await newContext(browser, { viewport: { width, height: 900 }, reducedMotion: "reduce" });
        try {
          await context.addInitScript((mode) => localStorage.setItem("slk_theme_preference", mode), theme);
          const page = await context.newPage();
          const response = await page.goto(`${config.frontendUrl}${path}`, { waitUntil: "domcontentloaded" });
          assert(response !== null && response.ok(), "Thesis landing page should return 200");
          assertNotIncludes(await response.text(), "abschlussarbeiten@stadt-land-klima.de", "Mailbox is server-side");
          await waitForHydration(page);
          await page.getByRole("heading", { name: "Abschlussarbeiten" }).waitFor();
          await page.getByText(/Wir unterstützen dich gerne bei deiner Abschlussarbeit/).waitFor();
          await page.waitForFunction((mode) => {
            const expected = mode === "dark" ? "staedteChallengeDark" : "staedteChallemgeTheme";
            return document.documentElement.dataset.theme === expected;
          }, theme);
          const defaultTopic = page.locator("details").filter({ hasText: defaultTitle });
          const masterTopic = page.locator("details").filter({ hasText: masterTitle });
          const politics = page.getByRole("button", { name: "Politik- und Verwaltungswissenschaften" });
          const computing = page.getByRole("button", { name: "Informatik & Data Science" });
          const climate = page.getByRole("button", { name: "Klimaschutzmanagement & Umwelttechnik" });
          const pills = page.locator(".thesis-category-filter");
          assert((await pills.count()) === 3, "Only the three merged categories should be offered");
          assert(!(await page.locator(".slk-page-main select").count()), "Degree levels should not be a filter");
          const filterColors = await pills.evaluateAll((elements) => elements.map((el) => getComputedStyle(el).color));
          const expectedColors =
            theme === "dark"
              ? ["rgb(255, 160, 166)", "rgb(74, 184, 212)", "rgb(191, 233, 164)"]
              : ["rgb(165, 28, 42)", "rgb(0, 110, 148)", "rgb(31, 111, 49)"];
          assert(filterColors.join() === expectedColors.join(), "Politics is red, informatics blue and climate green");
          const politicsBadge = defaultTopic.locator("summary .thesis-category-badge");
          assert(
            (await politicsBadge.evaluate((element) => getComputedStyle(element).color)) === filterColors[0],
            "The politics badge matches its filter color",
          );

          await politics.click();
          assert(!(await masterTopic.count()), "A selected category filters out unrelated topics");
          await computing.click();
          assert(
            (await masterTopic.count()) && (await defaultTopic.count()),
            "Multiple categories match any selection",
          );
          await politics.click();
          await climate.click();
          await computing.click();
          await masterTopic.waitFor();
          assert(!(await defaultTopic.count()), "Climate matches topics assigned to either merged category");

          const summary = masterTopic.locator("summary");
          const degree = masterTopic.locator("dd").filter({ hasText: /^Master$/ });
          const description = masterTopic.getByText("local climate action", { exact: true });
          assert(await summary.getByText(preview, { exact: true }).isVisible(), "The short preview should be visible");
          assert(!(await summary.getByText("Master", { exact: true }).count()), "The title row should omit levels");
          assert(!(await degree.isVisible()), "Degree levels should start collapsed");
          assert(!(await description.isVisible()), "Markdown should start collapsed");
          const badgeColors = await summary
            .locator(".thesis-category-badge")
            .evaluateAll((elements) => elements.map((el) => getComputedStyle(el).color));
          assert(badgeColors.join() === filterColors.slice(1).join(), "Card badges match their filter colors");
          await climate.focus();
          await page.keyboard.press("Tab");
          // Move to our fixture if other published Master topics are also present.
          await summary.focus();
          assert(
            await summary.evaluate(
              (element) => element.matches(":focus-visible") && getComputedStyle(element).outlineWidth === "2px",
            ),
            "A keyboard-focused topic should have a visible outline",
          );
          await page.keyboard.press("Enter");
          await description.waitFor();
          await degree.waitFor();
          assert((await masterTopic.locator("strong").count()) === 1, "Markdown emphasis should render");
          assert((await masterTopic.locator("ul li").count()) === 2, "Markdown lists should render");
          assert(!(await masterTopic.locator("[data-raw-html]").count()), "Raw markup should remain inactive");
          assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
            "Expanded topics should fit within the viewport",
          );
          await masterTopic.getByRole("link", { name: "Zum Thema schreiben" }).click();
          await page.waitForURL("**/contact?*");
          assert(
            (await page.locator("#feedback-type").inputValue()) === "thesis",
            "Contact category should be preselected",
          );
          assert(
            (await page.locator('form input[type="text"]').first().inputValue()) === masterTitle,
            "Contact subject should contain the selected topic",
          );
        } finally {
          await context.close();
        }
      }
    });
  } finally {
    await Promise.all(ids.map((id) => admin.deleteItem(collection, id)));
  }
}
