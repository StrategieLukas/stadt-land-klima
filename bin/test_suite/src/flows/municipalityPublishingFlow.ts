import type { Browser } from "playwright";
import { assert, assertEqual, assertIncludes } from "../lib/assert.js";
import { gotoDirectusContent, loginDirectus, newContext } from "../lib/browser.js";
import type { TestFixture } from "../lib/fixture.js";
import type { TestRunner } from "../lib/runner.js";
import { waitFor } from "../lib/wait.js";

export async function runMunicipalityPublishingFlow(runner: TestRunner, fixture: TestFixture, browser: Browser) {
  const { admin, localteamMember: member, localteamAdmin: owner } = fixture;
  const originalMember = await admin.request<{ verified: boolean }>("GET", `/users/${member.id}`, {
    query: { fields: "verified" },
  });
  const originalOwner = await admin.request<{ verified: boolean }>("GET", `/users/${owner.id}`, {
    query: { fields: "verified" },
  });
  const catalog = await admin.createItem<{ id: string }>("measure_catalog", {
    name: `publishing-${fixture.config.runId}`,
    hidden: false,
    isCurrentFrontend: false,
    isCurrentBackend: false,
  });
  const ids: string[] = [];
  let scoreId = "";
  const score = () =>
    admin.readItem<{ published: boolean; preview_enabled: boolean; percentage_rated: string | number }>(
      "municipality_scores",
      scoreId,
      ["published", "preview_enabled", "percentage_rated"],
    );
  try {
    for (let index = 0; index < 2; index++) {
      const measure = await admin.createItem<{ id: string }>("measures", {
        name: `Publication measure ${index} ${fixture.config.runId}`,
        measure_id: `PUB-${index}`,
        slug: `publishing-${index}-${fixture.config.runId}`,
        catalog_version: catalog.id,
        status: "published",
        sector: "energy",
        weight: 1,
        choices_rating: "0",
        must_be_rated_again: false,
        description_about: "Publication regression description",
        description_evaluation_criteria: "Publication regression criteria",
        description_verification: "Publication regression verification",
      });
      ids.push(measure.id);
    }
    const initialScores = await admin.readItems<{ id: string }>("municipality_scores", {
      filter: { municipality: { _eq: fixture.municipality.id }, catalog_version: { _eq: catalog.id } },
      fields: ["id"],
      limit: 1,
    });
    if (!initialScores.length)
      await admin.createItem("municipality_scores", {
        municipality: fixture.municipality.id,
        catalog_version: catalog.id,
      });
    scoreId = (
      await waitFor("publication fixture score", async () => {
        const rows = await admin.readItems<{ id: string }>("municipality_scores", {
          filter: { municipality: { _eq: fixture.municipality.id }, catalog_version: { _eq: catalog.id } },
          fields: ["id"],
          limit: 1,
        });
        return rows[0];
      })
    ).id;
    const ratings = await waitFor("publication fixture ratings", async () => {
      const rows = await admin.readItems<{ id: string }>("ratings_measures", {
        filter: { localteam_id: { _eq: fixture.localteam.id }, measure_id: { _in: ids } },
        fields: ["id"],
        limit: 10,
      });
      return rows.length === 2 ? rows : false;
    });
    await admin.updateUser(member.id, { verified: false });
    await admin.updateUser(owner.id, { verified: true });
    await runner.step(
      "Publishing: verified team admin cannot authorize an unverified member; API errors explain verification",
      async () => {
        for (const patch of [{ published: true }, { preview_enabled: true }]) {
          let error = "";
          try {
            await member.client.updateItem("municipality_scores", scoreId, patch);
          } catch (caught) {
            error = String(caught);
          }
          assertIncludes(error, "anti-spam", "API must explain verification");
          assertIncludes(error, "info@stadt-land-klima.de", "API must supply verification contact");
        }
        assertEqual((await score()).published, false, "Unverified writes must not publish");
      },
    );
    await admin.updateUser(owner.id, { verified: false });
    await admin.updateUser(member.id, { verified: true });
    await runner.step(
      "Publishing: verified member can enable incomplete private preview without publishing",
      async () => {
        const url = `${fixture.config.frontendUrl}/api/previews/municipality/${fixture.municipality.slug}?v=${encodeURIComponent(`publishing-${fixture.config.runId}`)}`;
        const headers = { "x-preview-token": fixture.municipality.preview_token! };
        assertEqual((await fetch(url, { headers })).status, 404, "Disabled preview must reject even a valid token");
        await member.client.updateItem("municipality_scores", scoreId, { preview_enabled: true });
        const row = await score();
        assertEqual(row.published, false, "Preview must not publish");
        assertEqual(row.preview_enabled, true, "Verified member may preview regardless of admin verification");
        const response = await fetch(url, { headers });
        assertEqual(response.status, 200, "Enabled incomplete preview must load");
        assert(response.headers.get("cache-control")?.includes("no-store"), "Preview must not be cached");
        const body = await response.json();
        assert(body.previewAuthorized === true, "Token must authorize preview");
        assert(
          !JSON.stringify(body).includes(fixture.municipality.preview_token!),
          "Stored token must not be serialized",
        );
        assertEqual(
          (await fetch(url, { headers: { "x-preview-token": "wrong-token-with-enough-characters" } })).status,
          404,
          "Wrong token must be rejected",
        );
        const previewContext = await newContext(browser);
        try {
          const page = await previewContext.newPage();
          await page.goto(
            `${fixture.config.frontendUrl}/municipalities/${fixture.municipality.slug}?v=${encodeURIComponent(`publishing-${fixture.config.runId}`)}&preview=${fixture.municipality.preview_token}`,
            { waitUntil: "networkidle" },
          );
          await page.getByText(`Vorschau: „${fixture.municipalityName}“`, { exact: true }).waitFor({ timeout: 20_000 });
          assert(
            !(await page.locator("body").innerText()).includes(
              "Diese Gemeinde wird aktuell durch ein Lokalteam eingerichtet",
            ),
            "Enabled incomplete preview must render instead of the locked page",
          );
        } finally {
          await previewContext.close();
        }
      },
    );
    await runner.step(
      "Publishing: direct API cannot bypass completion using cached or submitted percentages",
      async () => {
        // Simulate stale cached completeness; the filter must check actual assessments.
        await admin.updateItem("municipality_scores", scoreId, { percentage_rated: 100 });
        let error = "";
        try {
          await member.client.updateItem("municipality_scores", scoreId, { published: true });
        } catch (caught) {
          error = String(caught);
        }
        assertIncludes(error, "100%", "Server must require complete assessments");
        assertEqual((await score()).published, false, "Cached percentage must not grant publication");
      },
    );
    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(page, fixture.config.backendUrl, member.email, member.password);
      await gotoDirectusContent(page, fixture.config.backendUrl, "municipalities", fixture.municipality.id);
      const row = page
        .locator(".municipality-scores-publisher .scores-row")
        .filter({ hasText: `publishing-${fixture.config.runId}` })
        .first();
      await row.waitFor({ state: "visible" });
      await runner.step(
        "Publishing UI: controls stay clickable and explain incomplete work and revoked verification",
        async () => {
          // Revoke after page load to exercise fresh verification rather than cached UI state.
          await admin.updateUser(member.id, { verified: false });
          await row.locator('[data-publication-control="published"]').click();
          await page.getByRole("dialog").waitFor();
          const message = await page.getByRole("dialog").innerText();
          assertIncludes(message, "Anti-Spam", "Dialog must explain anti-spam verification");
          assertIncludes(message, "info@stadt-land-klima.de", "Dialog must supply verification contact");
          await page.keyboard.press("Escape");
          await admin.updateUser(member.id, { verified: true });
          await admin.updateItem("municipality_scores", scoreId, { percentage_rated: 99 });
          await page.reload();
          await row.locator('[data-publication-control="published"]').click();
          await page.getByRole("dialog").waitFor();
          assertIncludes(
            await page.getByRole("dialog").innerText(),
            "100 %",
            "Incomplete click must explain requirement",
          );
          await page.keyboard.press("Escape");
          await row.locator('[data-publication-control="preview_enabled"]').click();
          await waitFor("preview disabled by checkbox", async () => !(await score()).preview_enabled);
          await row.locator('[data-publication-control="preview_enabled"]').click();
          await waitFor("preview enabled by checkbox", async () => (await score()).preview_enabled);
          const previewLink = row.getByRole("link", { name: "Vorschau öffnen" });
          await previewLink.waitFor({ state: "visible" });
          const target = new URL((await previewLink.getAttribute("href"))!);
          assertEqual(
            target.searchParams.get("v"),
            `publishing-${fixture.config.runId}`,
            "Preview link must select its table row catalogue",
          );
          assertEqual(
            target.searchParams.get("preview"),
            fixture.municipality.preview_token!,
            "Preview link must use only its own municipality credential",
          );
          assertEqual(
            await previewLink.getAttribute("rel"),
            "noopener noreferrer",
            "Preview links must suppress referrers",
          );
        },
      );
    } finally {
      await context.close();
    }
    await runner.step(
      "Publishing: complete preview stays unpublished until explicit publication; clearing preview preserves publication",
      async () => {
        for (const rating of ratings)
          await admin.updateItem("ratings_measures", rating.id, {
            approved: true,
            applicable: true,
            rating: "1",
            status: "published",
          });
        await waitFor("complete assessment", async () => Number((await score()).percentage_rated) === 100);
        assertEqual((await score()).published, false, "Completion must not auto-publish preview");
        await member.client.updateItem("municipality_scores", scoreId, { published: true });
        await member.client.updateItem("municipality_scores", scoreId, { preview_enabled: false });
        assertEqual((await score()).published, true, "Disabling preview must not unpublish complete work");
        await member.client.updateItem("municipality_scores", scoreId, { published: false });
      },
    );
  } finally {
    await admin.updateUser(member.id, { verified: originalMember.verified });
    await admin.updateUser(owner.id, { verified: originalOwner.verified });
    // Fixture teardown removes generated scores/ratings for the owned municipality.
    for (const id of ids) await admin.deleteItem("measures", id);
    await admin.deleteItem("measure_catalog", catalog.id);
  }
}
