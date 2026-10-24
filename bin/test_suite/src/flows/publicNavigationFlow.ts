import { solveMathChallenge, solveNativeAltcha } from "../lib/captcha.js";
import { randomUUID } from "node:crypto";
import type { Browser, Page } from "playwright";
import { assert, assertIncludes, assertNotIncludes } from "../lib/assert.js";
import { waitFor } from "../lib/wait.js";
import { newContext, waitForHydration, collectPublicPageErrors } from "../lib/browser.js";
import { assertNoCredentialFields } from "../lib/disclosure.js";
import type { TestFixture } from "../lib/fixture.js";
import type { TestRunner } from "../lib/runner.js";

/** Exercise the public read paths removed from the browser SDK, with real CMS data. */
export async function runPublicNavigationFlow(runner: TestRunner, fixture: TestFixture, browser: Browser) {
  const { admin, config } = fixture;
  const created: { collection: string; id: string | number }[] = [];
  async function create(collection: string, data: Record<string, unknown>) {
    const row = await admin.createItem<{ id: string | number }>(
      collection,
      collection === "measures"
        ? {
            weight: 1,
            description_about: "Public regression description",
            description_evaluation_criteria: "Public regression criteria",
            description_verification: "Public regression verification",
            choices_rating: "0",
            ...data,
          }
        : data,
    );
    created.push({ collection, id: row.id });
    if ((collection === "measures" || collection === "pages") && typeof data.slug === "string") {
      await admin.updateItem(collection, row.id, { slug: data.slug });
    }
    return row;
  }
  async function json(path: string) {
    const response = await fetch(`${config.frontendUrl}${path}`);
    assert(response.ok, `${path} must succeed, got ${response.status}`);
    const result = await response.json();
    assertNoCredentialFields(result, path);
    return result;
  }
  async function clientNavigate(page: Page, path: string) {
    await page.evaluate(async (target) => {
      const root = document.querySelector("#nuxt-root") as Element & {
        __vue_app__?: { config: { globalProperties: { $router?: { push: (path: string) => Promise<unknown> } } } };
      };
      const router = root?.__vue_app__?.config.globalProperties.$router;
      if (!router) throw new Error("Hydrated Nuxt router is required for client navigation");
      await router.push(target);
    }, path);
    await page.waitForURL((url) => url.pathname + url.search === path);
    assert(
      await page.evaluate(() => Boolean((window as unknown as Record<string, unknown>).publicNavigationMarker)),
      "Navigation must preserve the browser document",
    );
  }
  const slug = `public-regression-${config.runId}`;
  const firstTitle = `Public energy ${config.runId}`;
  const secondTitle = `Public buildings ${config.runId}`;
  const newsTitle = `Public news ${config.runId}`;
  const timelineDay = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const hidden = `PRIVATE-CONTENT-${config.runId}`;
  const context = await newContext(browser);
  try {
    await admin.updateUser(fixture.localteamAdmin.id, { verified: true });
    const catalog = await create("measure_catalog", {
      name: slug,
      hidden: false,
      isCurrentFrontend: false,
      isCurrentBackend: false,
    });
    const secondCatalog = await create("measure_catalog", {
      name: `${slug}-second`,
      hidden: false,
      isCurrentFrontend: false,
      isCurrentBackend: false,
    });
    const measure = await create("measures", {
      slug,
      name: firstTitle,
      measure_id: "EN-PUBLIC",
      sector: "energy",
      status: "published",
      catalog_version: catalog.id,
      description_about: "Public regression measure description",
    });
    await create("measures", {
      slug: `${slug}-buildings`,
      name: secondTitle,
      measure_id: "GB-PUBLIC",
      sector: "buildings",
      status: "published",
      catalog_version: catalog.id,
    });
    await create("measures", {
      slug,
      name: `Second version ${config.runId}`,
      measure_id: "EN-PUBLIC",
      sector: "energy",
      status: "published",
      catalog_version: secondCatalog.id,
    });
    await create("measures", {
      slug: `${slug}-draft`,
      name: hidden,
      measure_id: "EN-DRAFT",
      sector: "energy",
      status: "draft",
      catalog_version: catalog.id,
    });
    const score = await create("municipality_scores", {
      municipality: fixture.municipality.id,
      catalog_version: catalog.id,
      published: true,
      percentage_rated: 100,
      score_total: 75,
    });
    const generatedRatings = await waitFor("generated public comparison ratings", async () => {
      const rows = await admin.readItems<{ id: string }>("ratings_measures", {
        filter: {
          localteam_id: { _eq: fixture.localteam.id },
          measure_id: { catalog_version: { _eq: catalog.id }, status: { _eq: "published" } },
        },
        fields: ["id"],
        limit: -1,
      });
      return rows.length === 2 ? rows : false;
    });
    for (const rating of generatedRatings)
      await admin.updateItem("ratings_measures", rating.id, {
        rating: "0.75",
        applicable: true,
        approved: true,
        status: "published",
      });
    await admin.updateItem("municipalities", fixture.municipality.id, {
      municipality_type: "big_city",
      ars: "110000000001",
      geolocation: { type: "Point", coordinates: [13.405, 52.52] },
    });
    await waitFor("complete public comparison score", async () => {
      const row = await admin.readItem<{ percentage_rated: string | number }>("municipality_scores", score.id, [
        "percentage_rated",
      ]);
      return Number(row.percentage_rated) === 100 ? row : false;
    });
    await fixture.localteamAdmin.client.updateItem("municipality_scores", score.id, { published: true });
    await create("climate_tools", {
      title: `Public tool ${config.runId}`,
      description: "Public climate tool description",
      category: "Regression",
      link: "https://example.org/tool",
      status: "published",
    });
    const projectImage = await admin.uploadFile<{ id: string }>(
      `${slug}.svg`,
      "image/svg+xml",
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="green"/></svg>',
      ),
      `Public project ${config.runId}`,
    );
    await create("articles", {
      title: `Public project ${config.runId}`,
      slug,
      status: "published",
      abstract: "Public carousel project abstract",
      author: "Public regression",
      municipality_name: fixture.municipalityName,
      image: projectImage.id,
      image_credits: "Public regression image",
      sectors: ["energy"],
      article_text: "Public regression project content",
    });
    await create("organisation_teams", {
      team_key: slug,
      label: `Public team ${config.runId}`,
      email: "public@example.org",
      tasks: [],
      color: "#505050",
    });
    const news = await create("news_items", {
      title: newsTitle,
      slug,
      status: "published",
      is_tour_redirect: false,
      date_published: `${timelineDay}T12:00:00`,
    });
    await create("events", {
      title: `Public timeline event ${config.runId}`,
      slug: `${slug}-timeline`,
      status: "published",
      event_category: "own_public",
      event_type: "other",
      start_date: `${timelineDay}T11:30:00.000Z`,
    });
    const ordinarySeries = await create("event_series", {
      title: `Public ordinary series ${config.runId}`,
      slug: `${slug}-series`,
      status: "published",
      format: "standard",
    });
    await create("events", {
      title: `Published ordinary event ${config.runId}`,
      slug: `${slug}-series-visible`,
      status: "published",
      series: ordinarySeries.id,
      start_date: `${timelineDay}T12:00:00`,
    });
    await create("events", {
      title: hidden,
      slug: `${slug}-series-draft`,
      status: "draft",
      series: ordinarySeries.id,
      start_date: `${timelineDay}T12:00:00`,
    });
    const draft = await create("news_items", {
      title: hidden,
      slug: `${slug}-draft`,
      status: "draft",
      is_tour_redirect: false,
    });
    const pageRecord = await create("pages", {
      name: `Public blocks ${config.runId}`,
      slug,
      status: "published",
      contents: "",
    });
    const privatePage = await create("pages", {
      name: `Private page ${config.runId}`,
      slug: `${slug}-private`,
      status: "draft",
      contents: hidden,
    });
    await create("blocks", {
      uuid: randomUUID(),
      entity_type: "pages",
      entity_uuid: privatePage.id,
      field_name: "content",
      bundle: "heading",
      props: { text: hidden },
      options: {},
      status: "published",
    });
    await create("blocks", {
      uuid: randomUUID(),
      entity_type: "pages",
      entity_uuid: pageRecord.id,
      field_name: "content",
      bundle: "heading",
      props: { text: hidden },
      options: {},
      status: "draft",
    });
    await create("pages", {
      name: `Embedded page ${config.runId}`,
      slug: `${slug}-embedded`,
      status: "published",
      contents: "<p>Embedded public page content</p>",
    });
    await create("blocks", {
      uuid: randomUUID(),
      entity_type: "news_items",
      entity_uuid: news.id,
      field_name: "content",
      bundle: "heading",
      props: { text: "Scoped public news block" },
      options: {},
      status: "published",
    });
    await create("blocks", {
      uuid: randomUUID(),
      entity_type: "news_items",
      entity_uuid: draft.id,
      field_name: "content",
      bundle: "heading",
      props: { text: hidden },
      options: {},
      status: "published",
    });
    const chartUuid = randomUUID();
    const chartQuery = JSON.stringify({
      collection: "ratings_measures",
      query: { fields: ["id", "rating", "measure_id.sector"], filter: { measure_id: { _eq: measure.id } }, limit: -1 },
    });
    for (const [bundle, props, uuid] of [
      ["directus_page", { pageSlug: `${slug}-embedded` }, randomUUID()],
      ["projects_carousel", { heading: "Public project carousel" }, randomUUID()],
      ["municipality_search_hero", {}, randomUUID()],
      ["vega_chart", { query: chartQuery }, chartUuid],
    ] as const) {
      await create("blocks", {
        uuid,
        entity_type: "pages",
        entity_uuid: pageRecord.id,
        field_name: "content",
        bundle,
        props,
        options: {},
        status: "published",
      });
    }

    const nestedChartUuid = randomUUID();
    await create("blocks", {
      uuid: randomUUID(),
      entity_type: "pages",
      entity_uuid: pageRecord.id,
      field_name: "content",
      bundle: "container",
      props: { blocks: [{ uuid: nestedChartUuid, bundle: "vega_chart", props: { query: chartQuery }, options: {} }] },
      options: {},
      status: "published",
    });

    await runner.step("Public reads: catalog measures, projections, comparisons and publication gates", async () => {
      assert(
        Array.isArray((await json("/api/public/elections")).elections),
        "Public elections must select actual schema fields",
      );
      const catalogs = await json("/api/public/catalogs");
      for (const catalog of catalogs) {
        const stats = await json(`/api/public/stats/${encodeURIComponent(catalog.name)}`);
        assert(
          stats.catalogVersion.id === catalog.id,
          "Every visible catalog, including dotted version names, must work",
        );
      }
      const search = await json(
        `/api/public/municipalities?search=${encodeURIComponent(fixture.municipalityName)}&v=${slug}`,
      );
      assert(
        search.municipalities[0]?.ars === "110000000001" &&
          search.municipalities[0]?.localteam_id === fixture.localteam.id,
        "Search DTO must retain ARS identity and localteam detection",
      );
      assert(
        search.municipalities[0]?.scores.some(
          (score: { catalog_version: { name: string } }) => score.catalog_version.name === slug,
        ),
        "Search DTO must retain published catalog metadata for current/older score classification",
      );
      const list = await json(`/api/public/measures?v=${slug}`);
      assert(list.measures.length === 2, "Catalog must include both published measures without drafts");
      assertNotIncludes(JSON.stringify(list), hidden, "Draft measures must remain private");
      const detail = await json(`/api/public/measures/${slug}?v=${slug}`);
      assert(
        detail.measure.description_about === "Public regression measure description",
        "Description must survive the public projection",
      );
      assert(detail.versions.length === 2, "Both visible catalog versions must remain available");
      const stats = await json(`/api/public/stats/${slug}`);
      assert(
        stats.scores.some((row: { id: string }) => row.id === score.id),
        "Published score must reach statistics/map",
      );
      assert(
        stats.ratings.some((row: { measure_id: string }) => row.measure_id === measure.id),
        "Published approved ratings must reach statistics",
      );
      const ratings = await json(`/api/public/measure-ratings?measureId=${measure.id}`);
      assert(
        ratings.ratings.length === 1 &&
          ratings.ratings[0].localteam_id.municipality_id[0].slug === fixture.municipality.slug,
        "Comparison includes municipality identity",
      );
      const chart = await json(`/api/public/chart-data/${chartUuid}`);
      assert(
        chart.length === 1 && Number(chart[0].rating) === 0.75,
        "Published chart executes its stored public query",
      );
      const nestedChart = await json(
        `/api/public/chart-data/${nestedChartUuid}?entityType=pages&entityUuid=${pageRecord.id}`,
      );
      assert(nestedChart.length === 1, "Nested charts must retain their published parent scope");
      await fixture.localteamAdmin.client.updateItem("municipality_scores", score.id, { published: false });
      try {
        assert(
          (await json(`/api/public/measure-ratings?measureId=${measure.id}`)).ratings.length === 0,
          "Unpublished municipal assessment must not leak through comparisons",
        );
        assert(
          (await json(`/api/public/ratings?localteamId=${fixture.localteam.id}&v=${slug}`)).ratings.length === 0,
          "Alternate ratings operation must also require a published score",
        );
        const lookup = await json(
          `/api/public/municipality-by-name?name=${encodeURIComponent(fixture.municipalityName)}`,
        );
        assert(
          !lookup.municipality?.scores.some((row: { catalog_version: string }) => row.catalog_version === catalog.id),
          "Project municipality lookup must not expose unpublished score progress",
        );
        assert(
          (await json(`/api/public/chart-data/${chartUuid}`)).length === 0,
          "Unpublished score must also be excluded from chart data",
        );
      } finally {
        await fixture.localteamAdmin.client.updateItem("municipality_scores", score.id, { published: true });
      }
      const legacyElection = await fetch(`${config.frontendUrl}/elections/${fixture.municipality.slug}`);
      assert(legacyElection.ok, "Legacy election information route must remain available");
      assertIncludes(
        await legacyElection.text(),
        fixture.municipalityName,
        "Legacy election information must retain the selected municipality",
      );
      const area = await json(`/api/public/area-municipalities?slugs=${fixture.municipality.slug}&v=${slug}`);
      assert(
        area.municipalities[0]?.scores[0]?.score_total === "75.00" ||
          Number(area.municipalities[0]?.scores[0]?.score_total) === 75,
        "Area enrichment resolves scores through the municipality relation",
      );
    });

    await runner.step("Public blocks: parent scope, drafts, news isolation and embedded content", async () => {
      for (const path of ["/api/public/blocks", `/api/public/blocks?entityUuid=${news.id}`]) {
        assert((await fetch(`${config.frontendUrl}${path}`)).status === 400, "Unscoped block listing must fail");
      }
      assert(
        (await fetch(`${config.frontendUrl}/api/public/blocks?entityType=news_items&entityUuid=${draft.id}`)).status ===
          404,
        "A published block on a draft parent remains private",
      );
      assert(
        (await fetch(`${config.frontendUrl}/api/public/news/${slug}-draft`)).status === 404,
        "Draft news metadata must remain private",
      );
      const ordinary = await json(`/api/public/event-series/${slug}-series`);
      assert(
        ordinary.events.length === 1 && ordinary.events[0].slug === `${slug}-series-visible`,
        "A public ordinary series includes only its published events",
      );
      assertNotIncludes(
        JSON.stringify(ordinary),
        hidden,
        "Draft child metadata must not escape through an event series",
      );
      assert(
        (await fetch(`${config.frontendUrl}/api/public/blocks?entityType=pages&entityUuid=${privatePage.id}`))
          .status === 404,
        "Published blocks on draft pages must remain private",
      );
      const pageBlocks = await json(`/api/public/blocks?entityType=pages&entityUuid=${pageRecord.id}`);
      assertNotIncludes(JSON.stringify(pageBlocks), hidden, "Draft blocks on published pages must remain private");
      const blocks = await json(`/api/public/blocks?entityType=news_items&entityUuid=${news.id}`);
      assert(blocks.blocks.length === 1, "News must receive only its own blocks");
      const response = await fetch(`${config.frontendUrl}/news/${slug}`);
      assert(response.ok, "News detail must render");
      const html = await response.text();
      assertIncludes(html, "Scoped public news block", "Published news block must render on SSR");
      assertNotIncludes(html, hidden, "Unrelated private block must not appear");
      const embedded = await fetch(`${config.frontendUrl}/${slug}`);
      assert(embedded.ok, "CMS block page must render");
      assertIncludes(
        await embedded.text(),
        "Embedded public page content",
        "Directus-page block must include its public HTML on SSR",
      );
    });

    await runner.step("Public news: SSR hydration preserves feed order across browser time zones", async () => {
      for (const timezoneId of ["UTC", "America/Los_Angeles"]) {
        const newsContext = await newContext(browser, { timezoneId });
        try {
          const page = await newsContext.newPage();
          const errors = collectPublicPageErrors(page);
          await page.goto(`${config.frontendUrl}/news`, { waitUntil: "domcontentloaded" });
          await waitForHydration(page);
          await page.getByText(newsTitle, { exact: true }).first().waitFor();
          const order = await page
            .locator(`a[href="/news/${slug}"], a[href="/events/${slug}-timeline"]`)
            .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
          assert(
            order.length === 2 && order[0] === `/events/${slug}-timeline`,
            `Event must sort after Berlin noon news in reverse chronology (${timezoneId}): ${order.join(", ")}`,
          );
          assert(errors.length === 0, `News hydration must be consistent in ${timezoneId}: ${errors.join("; ")}`);
        } finally {
          await newsContext.close();
        }
      }
    });

    await runner.step("Public CAPTCHA: native widget solves challenges with signed purpose and expiry", async () => {
      const page = await context.newPage();
      try {
        await page.goto(`${config.frontendUrl}/contact`, { waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        const payload = await page.evaluate(async () => {
          await customElements.whenDefined("altcha-widget");
          const widget = document.createElement("altcha-widget") as HTMLElement & { verify(): Promise<void> };
          widget.setAttribute("challenge", "/api/altcha?purpose=contact");
          const verified = new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Native CAPTCHA verification timeout")), 15000);
            widget.addEventListener("statechange", (event) => {
              const { state, payload } = (event as CustomEvent<{ state: string; payload: string }>).detail;
              if (state === "verified") {
                clearTimeout(timer);
                resolve(payload);
              }
              if (state === "error") {
                clearTimeout(timer);
                reject(new Error("Native CAPTCHA verification failed"));
              }
            });
          });
          await new Promise<void>((resolve) => {
            widget.addEventListener("load", () => resolve(), { once: true });
            document.body.append(widget);
          });
          void widget.verify();
          try {
            return await verified;
          } finally {
            widget.remove();
          }
        });
        const proof = JSON.parse(Buffer.from(payload, "base64").toString()) as { algorithm: string; salt: string };
        assert(proof.algorithm === "SHA-256", "Native widget must retain the supported algorithm");
        const metadata = new URLSearchParams(proof.salt.split("?")[1]);
        assert(metadata.get("purpose") === "contact", "Native widget must retain cryptographically signed purpose");
        assert(
          Number(metadata.get("expires")) > Date.now(),
          "Native widget must retain cryptographically signed expiry",
        );
      } finally {
        await page.close();
      }
    });

    await runner.step(
      "Public forms: nested saved definition submits with signed proofs and trusted routing",
      async () => {
        const formUuid = randomUUID();
        const formPage = await create("pages", {
          name: `Form ${config.runId}`,
          slug: `${slug}-form`,
          status: "published",
          contents: "",
        });
        await create("blocks", {
          uuid: randomUUID(),
          entity_type: "pages",
          entity_uuid: formPage.id,
          field_name: "content",
          bundle: "container",
          status: "published",
          options: {},
          props: {
            blocks: [
              {
                uuid: formUuid,
                bundle: "form",
                options: { notificationEmail: "form-security@example.invalid", sendCopy: false },
                props: {
                  title: "Saved test form",
                  successMessage: "Saved response accepted",
                  fields: [
                    {
                      uuid: randomUUID(),
                      bundle: "form_field",
                      options: { fieldName: "message", fieldType: "textarea", required: true },
                      props: { label: [{ uuid: randomUUID(), bundle: "form_label", props: { text: "Message" } }] },
                    },
                  ],
                },
              },
            ],
          },
        });
        const page = await context.newPage();
        let responseId: string | number | undefined;
        try {
          await page.goto(`${config.frontendUrl}/${slug}-form`, { waitUntil: "domcontentloaded" });
          await waitForHydration(page);
          await page.locator('[name="message"]').fill("<b>Stored as submitted</b>");
          await solveMathChallenge(page);
          await solveNativeAltcha(page);
          const submitted = page.waitForResponse(
            (response) =>
              response.url().endsWith("/api/submit-form-response") && response.request().method() === "POST",
          );
          await page.locator('.blokkli-block-form button[type="submit"]').click();
          const response = await submitted;
          assert(response.ok(), `Nested form submit must succeed, HTTP ${response.status()}: ${await response.text()}`);
          responseId = (await response.json()).id;
          await page.getByText("Saved response accepted").waitFor();
          const stored = await admin.readItem<{
            notification_email: string;
            send_copy: boolean;
            response_summary: string;
          }>("form_responses", responseId!, ["notification_email", "send_copy", "response_summary"]);
          assert(
            stored.notification_email === "form-security@example.invalid" && stored.send_copy === false,
            "Saved recipient and copy policy must be used",
          );
          assertIncludes(
            stored.response_summary,
            "<b>Stored as submitted</b>",
            "Email escaping must not corrupt stored text",
          );
        } finally {
          if (responseId) await admin.deleteItem("form_responses", responseId);
          await page.close();
        }
      },
    );

    await runner.step(
      "Public navigation: measures, catalog switching, sector filters and detail hydration",
      async () => {
        const page = await context.newPage();
        const errors = collectPublicPageErrors(page);
        await page.goto(`${config.frontendUrl}/tools`, { waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        await page.getByText(`Public tool ${config.runId}`, { exact: true }).first().waitFor();
        assertIncludes(
          await page.locator("body").innerText(),
          `Public tool ${config.runId}`,
          "Tool list must render published CMS tools",
        );
        await page.evaluate(() => {
          (window as unknown as Record<string, unknown>).publicNavigationMarker = true;
        });
        await page.locator('a[href="/measures"]').first().click();
        await page.waitForURL((url) => url.pathname === "/measures" && Boolean(url.searchParams.get("v")));
        await waitForHydration(page);
        await page.evaluate(() => {
          (window as unknown as Record<string, unknown>).publicNavigationMarker = true;
        });
        await page.locator(`a[href="/measures?v=${slug}"]`).first().click();
        await page.waitForURL((url) => url.searchParams.get("v") === slug);
        await page.getByText(firstTitle, { exact: true }).first().waitFor();
        await page.getByText(secondTitle, { exact: true }).first().waitFor();
        await page
          .locator("button")
          .filter({ has: page.locator('img[src="/icons/icon_category_energy.svg"]') })
          .click();
        await page
          .waitForURL((url) => url.searchParams.get("sector") === "energy")
          .catch((error) => {
            throw new Error(`${error.message}; browser errors: ${errors.join("; ")}`);
          });
        await page.getByText(firstTitle, { exact: true }).first().waitFor();
        assert(
          (await page.getByText(secondTitle, { exact: true }).count()) === 0,
          "Sector filtering must hide other sectors",
        );
        await page.locator(`a[href^="/measures/${slug}?"]`).first().click();
        await page.getByRole("heading", { name: firstTitle, exact: true }).waitFor();
        await page.getByText("Public regression measure description", { exact: false }).first().waitFor();
        await page.locator("#section-history svg rect").first().waitFor();
        await page.locator(`a[href*="v=${slug}-second"]`).first().click();
        await page.getByRole("heading", { name: `Second version ${config.runId}`, exact: true }).waitFor();
        // Interrupt chart/detail work with rapid navigation to exercise unmount cleanup.
        await clientNavigate(page, `/stats?v=${slug}`);
        await clientNavigate(page, `/measures/${slug}?v=${slug}`);
        await page.getByRole("heading", { name: firstTitle, exact: true }).waitFor();
        assert(errors.length === 0, `Catalog navigation must not throw browser errors: ${errors.join("; ")}`);
        await page.close();
      },
    );

    await runner.step("Public navigation: map, statistics, organisation, news and CMS blocks", async () => {
      const page = await context.newPage();
      const errors = collectPublicPageErrors(page);
      const browserCmsReads: string[] = [];
      page.on("request", (request) => {
        if (/\/items\//.test(request.url())) browserCmsReads.push(request.url());
      });
      const teams = await json("/api/public/organisation-teams");
      assert(
        teams.some((team: { team_key: string }) => team.team_key === slug),
        "Organisation teams endpoint must return CMS teams",
      );
      // Exercise mounted CMS team labels/tasks without overwriting a shared real team.
      await page.route("**/api/public/organisation-teams", (route) =>
        route.fulfill({
          json: [
            ...teams.filter((team: { team_key: string }) => team.team_key !== "lokalteams"),
            {
              team_key: "lokalteams",
              label: `Public team ${config.runId}`,
              email: "public@example.org",
              tasks: ["Public team regression task"],
              color: "#505050",
            },
          ],
        }),
      );
      await page.goto(`${config.frontendUrl}/tools`, { waitUntil: "domcontentloaded" });
      await waitForHydration(page);
      await page.evaluate(() => {
        (window as unknown as Record<string, unknown>).publicNavigationMarker = true;
      });
      await clientNavigate(page, "/organisation");
      await page.locator(".org-svg-wrapper svg circle").first().waitFor();
      await page.locator('.org-svg-wrapper circle[style*="pointer-events: all"]').first().click();
      await page.locator("#team-detail-panel").getByText(`Public team ${config.runId}`, { exact: true }).waitFor();
      await page.locator("#team-detail-panel").getByText("Public team regression task", { exact: true }).waitFor();
      await page.route("**/api/area-search?*", (route) => route.fulfill({ json: [] }));
      await page.keyboard.press("Control+k");
      await page.keyboard.insertText(fixture.municipalityName);
      await page.getByRole("dialog").getByText(fixture.municipalityName, { exact: true }).first().waitFor();
      await page.keyboard.press("Escape");
      await page.unroute("**/api/area-search?*");
      const current = (await json("/api/public/catalogs")).find(
        (item: { isCurrentFrontend: boolean }) => item.isCurrentFrontend,
      );
      // The cloud reads the global frontend catalog. Supply a deterministic public
      // contract without changing global CMS catalog flags or depending on seed data.
      await page.route(`**/api/public/stats/${encodeURIComponent(current.name)}`, (route) =>
        route.fulfill({
          json: {
            scores: [
              ...Array.from({ length: 12 }, (_, index) => ({
                published: true,
                percentage_rated: 100,
                score_total: 75,
                municipality: {
                  id: `cloud-${index}`,
                  name: `Public cloud ${index}`,
                  slug: fixture.municipality.slug,
                  population: 100000,
                },
              })),
              {
                published: false,
                percentage_rated: 100,
                municipality: { id: "private", name: hidden, slug: "private" },
              },
              {
                published: true,
                percentage_rated: 50,
                municipality: { id: "incomplete", name: hidden, slug: "incomplete" },
              },
            ],
          },
        }),
      );
      await page.evaluate(() => {
        (window as unknown as Record<string, unknown>).publicNavigationMarker = true;
      });
      for (const path of [
        `/municipalities?v=${slug}`,
        `/municipalities?v=${slug}&view=map`,
        `/stats?v=${slug}`,
        `/map?v=${slug}`,
        "/news",
        `/${slug}`,
      ]) {
        await clientNavigate(page, path);
        if (path.includes("view=map") || path.startsWith("/map?"))
          await page.locator(".leaflet-marker-icon").filter({ visible: true }).first().waitFor();
        if (path === `/municipalities?v=${slug}`) {
          // Scope to the actual ranking card, not lingering command-palette results.
          const city = page
            .locator(`a[href^="/municipalities/${fixture.municipality.slug}?v="]`)
            .filter({ visible: true })
            .first();
          await city.waitFor();
          await clientNavigate(page, `/municipalities?v=${slug}-second`);
          await city.waitFor({ state: "hidden", timeout: 5_000 }).catch((error) => {
            throw new Error(`${error.message}; current URL: ${page.url()}; public errors: ${errors.join("; ")}`);
          });
          await clientNavigate(page, path);
          await city.waitFor();
        }
        if (path === `/stats?v=${slug}`)
          await page.locator(".stats-page .vega-embed svg, .stats-page .vega-embed canvas").first().waitFor();
        assert((await page.locator("h1,h2").count()) > 0, `${path} must render content after client navigation`);
      }
      await page
        .getByText("Embedded public page content", { exact: true })
        .waitFor()
        .catch((error) => {
          throw new Error(`${error.message}; URL: ${page.url()}; browser errors: ${errors.join("; ")}`);
        });
      await page.locator(`#block-${chartUuid} canvas, #block-${chartUuid} svg`).first().waitFor();
      await page
        .locator(".blokkli-block-projects-carousel")
        .getByText(`Public project ${config.runId}`, { exact: true })
        .first()
        .waitFor();
      const cloud = page.locator(".blokkli-block-municipality-search-hero");
      await cloud.locator(`a[href="/municipalities/${fixture.municipality.slug}"]`).first().waitFor();
      assertNotIncludes(await cloud.innerText(), hidden, "Word cloud excludes incomplete and unpublished scores");
      assert(errors.length === 0, `Public client navigation must not throw: ${errors.join("; ")}`);
      assert(browserCmsReads.length === 0, "Public widgets must use scoped APIs rather than browser Directus reads");
      const search = await json("/api/content-search?q=Kontakt&types=static_page");
      assert(
        Array.isArray(search.hits) && search.hits.some((hit: { url: string }) => hit.url === "/contact"),
        "Search must return a known published result; HTTP 200 with an empty fallback is not healthy",
      );
      const feed = await json("/api/public/news");
      assert(
        feed.news.some((row: { title: string }) => row.title === newsTitle),
        "News feed must include published news",
      );
      assertNotIncludes(JSON.stringify(feed), hidden, "News feed must exclude draft content");
      await page.close();
    });
  } finally {
    await context.close();
    for (const row of created.reverse()) {
      if (row.collection === "measure_catalog") {
        const generated = await admin.readItems<{ id: string }>("municipality_scores", {
          filter: { catalog_version: { _eq: row.id } },
          fields: ["id"],
          limit: -1,
        });
        for (const score of generated) await admin.deleteItem("municipality_scores", score.id);
      }
      await admin.deleteItem(row.collection, row.id);
    }
  }
}
