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
      const defaults = await createTopic({ title: defaultTitle });
      const master = await createTopic({
        title: masterTitle,
        short_description: preview,
        categories: ["computer_and_data_science", "climate_and_environmental_engineering"],
        levels: ["master"],
      });
      const withdrawn = await createTopic({ title: `Thesis C ${config.runId}` });
      const malformed = await createTopic({ title: `Thesis D ${config.runId}`, categories: ["unknown"] });

      const topics = await listTopics();
      assert(defaults.status === "published", "New thesis topics should be public by default");
      const listedDefault = topics.find(({ id }) => id === defaults.id);
      assert(listedDefault?.levels.join(",") === "bachelor,master,phd", "All three degree levels should be selected");
      assert(listedDefault.short_description === null, "Older topics can omit the short description");
      assert(
        topics.find(({ id }) => id === master.id)?.short_description === preview,
        "The published topic should include the short description",
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

    await runner.step("Thesis topics: combined filters, keyboard disclosure and protected contact", async () => {
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
          const politics = page.getByRole("button", { name: "Politikwissenschaft" });
          const computing = page.getByRole("button", { name: "Informatik & Data Science" });
          const level = page.getByLabel("Abschlussniveau");

          await politics.click();
          assert(!(await masterTopic.count()), "A selected category filters out unrelated topics");
          await computing.click();
          assert(
            (await masterTopic.count()) && (await defaultTopic.count()),
            "Multiple categories match any selection",
          );
          await level.selectOption("bachelor");
          assert(
            !(await masterTopic.count()) && (await defaultTopic.count()),
            "The degree filter combines with categories",
          );
          await politics.click();
          assert(!(await masterTopic.count()) && !(await defaultTopic.count()), "Both filters must match");
          await level.selectOption("master");
          await masterTopic.waitFor();
          assert(!(await defaultTopic.count()), "Deselecting a category removes nonmatching topics");

          const summary = masterTopic.locator("summary");
          const degree = masterTopic.locator("dd").filter({ hasText: /^Master$/ });
          const description = masterTopic.getByText("local climate action", { exact: true });
          assert(await summary.getByText(preview, { exact: true }).isVisible(), "The short preview should be visible");
          assert(!(await summary.getByText("Master", { exact: true }).count()), "The title row should omit levels");
          assert(!(await degree.isVisible()), "Degree levels should start collapsed");
          assert(!(await description.isVisible()), "Markdown should start collapsed");
          await level.focus();
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
