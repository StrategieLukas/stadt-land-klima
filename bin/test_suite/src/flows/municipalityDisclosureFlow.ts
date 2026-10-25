import { randomBytes } from "node:crypto";
import type { Browser } from "playwright";
import { assert, assertIncludes } from "../lib/assert.js";
import { newContext } from "../lib/browser.js";
import {
  assertNoCredentialFields,
  assertNoDisclosure,
  captureBrowserBodies,
  configuredSecrets,
} from "../lib/disclosure.js";
import type { TestFixture } from "../lib/fixture.js";
import type { TestRunner } from "../lib/runner.js";
import { waitFor } from "../lib/wait.js";

export async function runMunicipalityDisclosureFlow(runner: TestRunner, fixture: TestFixture, browser: Browser) {
  const original = await fixture.admin.readItem<Record<string, unknown>>("municipalities", fixture.municipality.id, [
    "description",
    "preview_token",
    "creator_verified",
  ]);
  const member = await fixture.admin.request<{ verified: boolean }>("GET", `/users/${fixture.localteamMember.id}`, {
    query: { fields: "verified" },
  });
  const scores = await fixture.admin.readItems<{ id: string; preview_enabled: boolean }>("municipality_scores", {
    filter: { municipality: { _eq: fixture.municipality.id }, catalog_version: { hidden: { _neq: true } } },
    fields: ["id", "preview_enabled"],
    limit: -1,
  });
  const originalTeam = await fixture.admin.readItem<Record<string, unknown>>("localteams", fixture.localteam.id, [
    "internal_comment",
  ]);
  const draftText = `Hidden municipality draft ${fixture.config.runId}`;
  const internalText = `Hidden team comment ${fixture.config.runId}`;
  const token = String(original.preview_token);
  const otherToken = randomBytes(32).toString("hex");
  const catalogs = await fixture.admin.readItems<{ id: string; name: string }>("measure_catalog", {
    filter: { isCurrentFrontend: { _eq: true }, hidden: { _eq: false } },
    fields: ["id", "name"],
    limit: 1,
  });
  assert(catalogs[0], "A current public catalog is required for preview regression");
  const slug = fixture.municipality.slug;
  assert(slug, "Fixture municipality must have a slug");
  const query = `v=${encodeURIComponent(catalogs[0].name)}`;
  const base = fixture.config.frontendUrl;
  const publicUrl = `${base}/api/public/municipalities/${slug}?${query}`;
  const previewUrl = `${base}/api/previews/municipality/${slug}?${query}`;
  const hiddenAlways = [
    { label: "stored preview credential", value: token },
    { label: "private team comment", value: internalText },
  ];
  const request = (url: string, credential?: string) =>
    fetch(url, {
      headers: credential ? { "x-preview-token": credential } : {},
      redirect: "manual",
    });
  try {
    await fixture.admin.updateUser(fixture.localteamMember.id, { verified: true });
    for (const score of scores)
      await fixture.localteamMember.client.updateItem("municipality_scores", score.id, { preview_enabled: true });
    await fixture.admin.updateItem("municipalities", fixture.municipality.id, {
      description: draftText,
      creator_verified: false,
    });
    await fixture.admin.updateItem("localteams", fixture.localteam.id, { internal_comment: internalText });
    const otherTeam = await fixture.admin.createItem<{ id: string }>("localteams", {
      name: `Other preview team ${fixture.config.runId}`,
      slug: `other-preview-${fixture.config.runId}`,
      municipality_name: `Other preview ${fixture.config.runId}`,
      status: "published",
    });
    const other = await waitFor("second preview municipality", async () => {
      const rows = await fixture.admin.readItems<{ id: string }>("municipalities", {
        filter: { localteam_id: { _eq: otherTeam.id } },
        fields: ["id"],
        limit: 1,
      });
      return rows[0];
    });
    await fixture.admin.updateItem("municipalities", other.id, { preview_token: otherToken });

    await runner.step("Disclosure: preview verifier can read only credential fields and cannot write", async () => {
      const credential =
        configuredSecrets(fixture.config).find((secret) => secret.label === "NUXT_DIRECTUS_PREVIEW_TOKEN") ||
        configuredSecrets(fixture.config).find((secret) => secret.label === "DIRECTUS_PREVIEW_TOKEN");
      assert(credential, "Preview verifier must be configured for effective permission checks");
      const headers = { Authorization: `Bearer ${credential.value}` };
      const read = await fetch(
        `${fixture.config.backendUrl}/items/municipalities/${fixture.municipality.id}?fields=id,preview_token`,
        { headers },
      );
      assert(
        read.status === 200 && (await read.json()).data.preview_token === token,
        "Verifier must be able to read the fixture credential",
      );
      for (const path of [
        `/items/municipalities/${fixture.municipality.id}?fields=description`,
        "/items/candidate?fields=access_token",
        "/users?fields=email",
      ]) {
        const denied = await fetch(`${fixture.config.backendUrl}${path}`, { headers });
        assert(
          [401, 403].includes(denied.status),
          "Verifier must not read content, candidate credentials or user lists",
        );
      }
      const deniedWrite = await fetch(`${fixture.config.backendUrl}/items/municipalities/${fixture.municipality.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ description: draftText }),
      });
      assert([401, 403].includes(deniedWrite.status), "Verifier must not modify records");
    });

    await runner.step("Disclosure: public municipality response excludes draft data and credentials", async () => {
      const response = await request(publicUrl);
      assert(response.status === 200, "Public municipality operation must exist and succeed");
      const data = await response.json();
      assert(
        data.selectedCatalogVersion?.id === catalogs[0].id,
        "Response must be the municipality JSON contract, not an HTML fallback",
      );
      assert(!data.directusData?.municipalityScore, "Unpublished score must not be returned publicly");
      assertNoCredentialFields(data, "Public municipality response");
      assertNoDisclosure(
        data,
        [...hiddenAlways, { label: "unpublished description", value: draftText }],
        "Public municipality response",
      );
    });

    await runner.step(
      "Disclosure: preview requires its own credential and rejects flags and arbitrary query fields",
      async () => {
        for (const [index, credential] of [undefined, "true", randomBytes(32).toString("hex"), otherToken].entries()) {
          const response = await request(previewUrl, credential);
          assert(
            response.status === 404,
            `Preview credential case ${index} must be rejected with 404 (received ${response.status})`,
          );
          assertNoDisclosure(
            await response.text(),
            [...hiddenAlways, { label: "draft text", value: draftText }],
            "Denied preview response",
          );
        }
        for (const extra of ["preview=true", "fields=*", "filter[published]=false"]) {
          const response = await request(`${publicUrl}&${extra}`);
          assert(response.status === 400, "Public endpoint must reject unsupported privilege-bearing queries");
        }
      },
    );

    await runner.step(
      "Disclosure: valid preview returns scoped data without stored credentials or private relations",
      async () => {
        const response = await request(previewUrl, token);
        assert(response.status === 200, `Valid preview must load successfully (received ${response.status})`);
        assert(
          response.headers.get("cache-control")?.includes("no-store"),
          "Preview must disable shared response storage",
        );
        const data = await response.json();
        assert(data.previewAuthorized === true, "The server must authorize the preview");
        assert(
          data.directusData?.municipalityScore?.municipality?.description === draftText,
          "Authorized preview must return its draft content",
        );
        assertNoCredentialFields(data, "Authorized preview");
        assertNoDisclosure(
          data,
          [...hiddenAlways, { label: "other preview credential", value: otherToken }],
          "Authorized preview",
        );
        const publicAfter = await request(publicUrl, token);
        assertNoDisclosure(
          await publicAfter.text(),
          [{ label: "draft after preview/cache warmup", value: draftText }],
          "Public response after preview",
        );
      },
    );

    await runner.step("Disclosure: administrator verification does not publish draft data", async () => {
      await fixture.admin.updateItem("municipalities", fixture.municipality.id, { creator_verified: true });
      const response = await request(publicUrl);
      const data = await response.json();
      assert(!data.directusData?.municipalityScore, "Verification alone must not publish an unpublished score");
      assertNoDisclosure(
        data,
        [{ label: "verified but unpublished description", value: draftText }],
        "Verified municipality public response",
      );
      await fixture.admin.updateItem("municipalities", fixture.municipality.id, { creator_verified: false });
    });

    await runner.step(
      "Disclosure: preview survives hydration and client navigation without browser municipality queries",
      async () => {
        const context = await newContext(browser);
        const page = await context.newPage();
        const directReads: string[] = [];
        page.on("request", (req) => {
          const url = new URL(req.url());
          if (
            url.origin === new URL(fixture.config.backendUrl).origin &&
            /^\/items\/(municipalities|municipality_scores|ratings_measures|measure_catalog)(\/|$)/.test(url.pathname)
          )
            directReads.push(url.pathname);
        });
        try {
          // The caller's own URL credential is allowed in route state. An unrelated
          // stored credential and private relations must never reach this browser.
          const finish = captureBrowserBodies(page, [
            { label: "unrelated preview credential", value: otherToken },
            { label: "private team comment", value: internalText },
          ]);
          const path = `/municipalities/${slug}?${query}&preview=${encodeURIComponent(token)}`;
          const documentResponse = await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
          assert(
            documentResponse?.headers()["cache-control"]?.includes("no-store"),
            "Preview HTML/payload must also disable shared caching",
          );
          assert(
            documentResponse?.headers()["referrer-policy"] === "no-referrer",
            "Preview URL must not leak through the Referer header",
          );
          assertIncludes(
            await page.locator("body").innerText(),
            "Vorschau",
            "Hydrated preview must retain the preview banner",
          );
          assertIncludes(
            await page.locator("body").innerText(),
            fixture.municipalityName,
            "Preview must retain the municipality",
          );
          const publicPath = `/municipalities/${slug}?${query}`;
          await page.evaluate(async (target) => {
            const app = (document.querySelector("#__nuxt, #nuxt-root") as any)?.__vue_app__;
            if (!app) throw new Error("Nuxt application not hydrated");
            await app.config.globalProperties.$router.push(target);
          }, publicPath);
          await page
            .getByText("Diese Gemeinde wird aktuell durch ein Lokalteam eingerichtet", { exact: false })
            .waitFor({ timeout: 15_000 });
          assert(
            !(await page.locator("body").innerText()).includes(draftText),
            "Client navigation to public view must remove private draft content",
          );
          await page.evaluate(async (target) => {
            await (
              document.querySelector("#__nuxt, #nuxt-root") as any
            ).__vue_app__.config.globalProperties.$router.push(target);
          }, path);
          await page.getByText(`Vorschau: „${fixture.municipalityName}“`, { exact: true }).waitFor({ timeout: 15_000 });
          await page.waitForLoadState("networkidle");
          assertIncludes(
            await page.locator("body").innerText(),
            "Vorschau",
            "Client navigation must load an authorized preview",
          );
          // A header is not included in Nuxt's default fetch key. A new invalid
          // credential on the same endpoint must not reuse that authorized data.
          await page.evaluate(async (target) => {
            await (
              document.querySelector("#__nuxt, #nuxt-root") as any
            ).__vue_app__.config.globalProperties.$router.push(target);
          }, `${publicPath}&preview=${otherToken}`);
          await page
            .getByText("Diese Gemeinde wird aktuell durch ein Lokalteam eingerichtet", { exact: false })
            .waitFor({ timeout: 15_000 });
          assert(
            !(await page.locator("body").innerText()).includes(draftText),
            "Changing preview credentials must reauthorize and remove the draft",
          );
          await page.evaluate(
            async (target) => {
              await (
                document.querySelector("#__nuxt, #nuxt-root") as any
              ).__vue_app__.config.globalProperties.$router.push(target);
            },
            `${publicPath}&preview=true&preview_token=${encodeURIComponent(token)}`,
          );
          await page.getByText(`Vorschau: „${fixture.municipalityName}“`, { exact: true }).waitFor({ timeout: 15_000 });
          assert(
            directReads.length === 0,
            "Municipality detail data must be fetched through Nuxt after hydration/navigation",
          );
          await finish();
        } finally {
          await context.close();
        }
      },
    );

    await runner.step("Disclosure: rotated preview credentials stop working", async () => {
      await fixture.admin.updateItem("municipalities", fixture.municipality.id, {
        preview_token: randomBytes(32).toString("hex"),
      });
      const response = await request(previewUrl, token);
      assert(response.status === 404, "A previously valid preview credential must fail after rotation");
      assertNoDisclosure(await response.text(), hiddenAlways, "Revoked preview response");
    });
  } finally {
    await fixture.admin.updateUser(fixture.localteamMember.id, { verified: true });
    for (const score of scores)
      await fixture.localteamMember.client.updateItem("municipality_scores", score.id, {
        preview_enabled: score.preview_enabled,
      });
    await fixture.admin.updateUser(fixture.localteamMember.id, { verified: member.verified });
    await fixture.admin.updateItem("municipalities", fixture.municipality.id, original);
    await fixture.admin.updateItem("localteams", fixture.localteam.id, originalTeam);
    // Both teams contain runId; TestFixture.cleanup removes their dependent
    // scores/ratings before deleting either municipality/team.
  }
}
