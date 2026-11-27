import { JobsListResponseSchema, JobsDetailResponseSchema } from "../../../../src/frontend/shared/contracts/jobs.js";
import { JOB_SHARE_FORMATS } from "../../../../src/frontend/shared/jobSharing.js";
import type { Browser } from "playwright";
import { assert, assertIncludes, assertNotIncludes } from "../lib/assert.js";
import { newContext, waitForHydration, collectPublicPageErrors } from "../lib/browser.js";
import type { TestFixture } from "../lib/fixture.js";
import type { TestRunner } from "../lib/runner.js";

type RecordId = { id: string | number; slug?: string };

async function pageHtml(url: string): Promise<string> {
  const response = await fetch(url);
  assert(response.ok, `${url} should return 200, received ${response.status}`);
  return (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

export async function runJobsFlow(runner: TestRunner, fixture: TestFixture, browser: Browser): Promise<void> {
  const { admin, config } = fixture;
  const slug = `automated-job-${config.runId}`;
  const ids: { organisation?: RecordId; job?: RecordId; draft?: RecordId; sparse?: RecordId } = {};

  try {
    await runner.step("Jobs: published job appears in list and detail", async () => {
      ids.organisation = await admin.createItem<RecordId>("organisations", {
        name: `Automated org ${config.runId}`,
        link: "https://example.org",
      });
      ids.job = await admin.createItem<RecordId>("job_offers", {
        slug,
        role_title: `Automated role ${config.runId}`,
        type: "full_time",
        status: "published",
        tasks: "Build climate solutions",
        qualifications: "Experience with TypeScript",
        benefits: "Remote work",
        salary: "45000 €",
        weekly_hours: "40",
        start_date: "2027-01-01T00:00:00Z",
        end_date: null,
        application_url: "https://example.org/apply",
        organisation: ids.organisation.id,
      });

      // Verify list API
      const listResponse = await fetch(`${config.frontendUrl}/api/public/jobs`);
      assert(listResponse.ok, "Jobs list API should return 200");
      const listData = JobsListResponseSchema.parse(await listResponse.json());
      assert(listData.jobs.length >= 1, "Jobs list should contain at least one job");
      const listedJob = listData.jobs.find((j) => j.slug === slug);
      assert(listedJob, "Listed jobs should include our fixture");
      assert(listedJob.role_title === `Automated role ${config.runId}`, "Role title should match");
      assert(listedJob.type === "full_time", "Type should be full_time");
      assert(listedJob.organisation?.name === `Automated org ${config.runId}`, "Organisation should be included");
      assert(listedJob.start_date !== null, "Start date should be present");
      assert(listedJob.end_date === null, "End date should be null");

      // Verify detail API
      const detailResponse = await fetch(`${config.frontendUrl}/api/public/jobs/${slug}`);
      assert(detailResponse.ok, "Jobs detail API should return 200");
      const detailData = JobsDetailResponseSchema.parse(await detailResponse.json());
      assert(detailData.job.role_title === `Automated role ${config.runId}`, "Detail role title should match");
      assert(detailData.job.tasks === "Build climate solutions", "Tasks should be present");
      assert(detailData.job.qualifications === "Experience with TypeScript", "Qualifications should be present");
      assert(detailData.job.benefits === "Remote work", "Benefits should be present");
      assert(detailData.job.salary === "45000 €", "Salary should be present");
      assert(detailData.job.weekly_hours === "40", "Weekly hours should be present");
      assert(detailData.job.application_url === "https://example.org/apply", "Application URL should be present");
      assert(detailData.job.contact_notes === null, "Contact notes should be null when not set");
      assert(
        detailData.organisation?.name === `Automated org ${config.runId}`,
        "Organisation should be included in detail",
      );

      // Verify 404 for non-existent job
      const notFound = await fetch(`${config.frontendUrl}/api/public/jobs/non-existent-slug`);
      assert(notFound.status === 404, "Non-existent job should return 404");

      // Verify SSR page renders
      const listPage = await pageHtml(`${config.frontendUrl}/jobs`);
      assertIncludes(listPage, `Automated role ${config.runId}`, "Jobs list page should render the job title");
      assertIncludes(listPage, `Automated org ${config.runId}`, "Jobs list page should render the organisation");
      assertIncludes(listPage, "45000 €", "Jobs list cards should render salary beside weekly hours");

      const detailPage = await pageHtml(`${config.frontendUrl}/jobs/${slug}`);
      assertIncludes(detailPage, `Automated role ${config.runId}`, "Detail page should render the job title");
      assertIncludes(detailPage, "Build climate solutions", "Detail page should render tasks");
      assertIncludes(detailPage, "Experience with TypeScript", "Detail page should render qualifications");
      assertIncludes(detailPage, "Remote work", "Detail page should render benefits");
      assertIncludes(detailPage, "45000 €", "Detail page should render salary");
      assertIncludes(detailPage, `Automated org ${config.runId}`, "Detail page should render organisation name");
      assertIncludes(detailPage, "https://example.org/apply", "Detail page should render application URL");

      // Verify draft jobs are hidden
      const draftJob = (ids.draft = await admin.createItem<RecordId>("job_offers", {
        slug: `${slug}-draft`,
        role_title: `Draft job ${config.runId}`,
        type: "volunteer",
        status: "draft",
        organisation: ids.organisation.id,
      }));
      const draftList = await pageHtml(`${config.frontendUrl}/jobs`);
      assertNotIncludes(draftList, `Draft job ${config.runId}`, "Draft jobs must not appear in list");
      const draftDetail = await fetch(`${config.frontendUrl}/api/public/jobs/${slug}-draft`);
      assert(draftDetail.status === 404, "Draft jobs must return 404 via API");
      const draftImage = await fetch(`${config.frontendUrl}/api/public/jobs/${slug}-draft/social-image`);
      assert(draftImage.status === 404, "Draft jobs must not produce public share images");
      await admin.deleteItem("job_offers", draftJob.id);
      delete ids.draft;

      // Browser navigation test
      const context = await newContext(browser);
      try {
        const page = await context.newPage();
        await page.goto(`${config.frontendUrl}/jobs`, { waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        const bodyText = await page.locator("body").innerText();
        assertIncludes(bodyText, `Automated role ${config.runId}`, "Browser should render job title");

        // Click through to detail and wait for content
        await page.getByRole("link", { name: new RegExp(`Automated role ${config.runId}`, "i") }).click();
        await page.waitForURL(`**/jobs/${slug}`);
        // Wait for the detail content to appear
        await page.waitForFunction((text) => document.body.innerText.includes(text), "Build climate solutions", {
          timeout: 10000,
        });
        assertIncludes(
          await page.locator("body").innerText(),
          "Build climate solutions",
          "Detail page should render in browser",
        );
      } finally {
        await context.close();
      }
    });
    await runner.step("Jobs: generated share images, safe format switching and sharing fallbacks", async () => {
      for (const [format, dimensions] of Object.entries(JOB_SHARE_FORMATS)) {
        const response = await fetch(
          `${config.frontendUrl}/api/public/jobs/${slug}/social-image?format=${format}&lang=de-DE`,
        );
        assert(response.ok, `${format} share image should return 200, received ${response.status}`);
        assertIncludes(response.headers.get("content-type") ?? "", "image/png", "Share image content type");
        const png = Buffer.from(await response.arrayBuffer());
        assert(
          png.readUInt32BE(16) === dimensions.width && png.readUInt32BE(20) === dimensions.height,
          `${format} PNG dimensions`,
        );
      }
      const invalid = await fetch(`${config.frontendUrl}/api/public/jobs/${slug}/social-image?format=invalid`);
      assert(invalid.status === 400, "Image format must be allowlisted");
      const duplicate = await fetch(`${config.frontendUrl}/api/public/jobs/${slug}/social-image?lang=de-DE&lang=it-IT`);
      assert(duplicate.status === 400, "Duplicate image options must be rejected");
      const linkImage = `${config.frontendUrl}/api/public/jobs/${slug}/social-image?format=link&lang=de-DE`;
      const initial = await fetch(linkImage);
      const etag = initial.headers.get("etag");
      await initial.arrayBuffer();
      assert(etag, "Images provide a content ETag");
      await admin.updateItem("job_offers", ids.job!.id, { status: "draft" });
      try {
        const withdrawn = await fetch(linkImage, { headers: { "If-None-Match": etag } });
        assert(withdrawn.status === 404, "Withdrawn jobs cannot return cached images or 304");
      } finally {
        await admin.updateItem("job_offers", ids.job!.id, { status: "published" });
      }
      const html = await pageHtml(`${config.frontendUrl}/jobs/${slug}`);
      assertIncludes(
        html,
        `/api/public/jobs/${slug}/social-image?format=link`,
        "Crawler SSR exposes the job link image",
      );
      const context = await newContext(browser);
      try {
        // Use a script string so the TS runner cannot capture naming helpers in browser callbacks.
        await context.addInitScript({
          content: `
          window.jobShareCalls = 0;
          Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {
            window.jobShareCalls++; throw new DOMException('Canceled', 'AbortError');
          } });
          Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText: async (text) => { window.jobCopied = text; }
          } });
        `,
        });
        const page = await context.newPage();
        await page.goto(`${config.frontendUrl}/jobs/${slug}`, { waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        const trigger = page.getByRole("button", { name: "Job teilen", exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog");
        const image = dialog.getByTestId("job-share-preview").locator("img");
        await image.waitFor();
        const share = dialog.getByRole("button", { name: "Bild für Instagram teilen", exact: true });
        await page.waitForFunction(() =>
          [...document.querySelectorAll<HTMLButtonElement>("dialog button")].some(
            (el) => el.textContent?.includes("Bild für Instagram teilen") && !el.disabled,
          ),
        );
        let downloads = 0;
        page.on("download", () => {
          downloads++;
        });
        await share.click();
        await page.waitForFunction(() => (window as Window & { jobShareCalls?: number }).jobShareCalls === 1);
        assert(downloads === 0, "Canceled native shares must not trigger downloads");
        assert((await dialog.getByRole("alert").count()) === 0, "Canceled sharing is not an error");
        await dialog.getByRole("button", { name: "Link kopieren", exact: true }).click();
        const copied = await page.evaluate(() => (window as Window & { jobCopied?: string }).jobCopied);
        assert(copied?.endsWith(`/jobs/${slug}`), "Copy uses the canonical job detail URL");
        const downloadEvent = page.waitForEvent("download");
        await dialog.getByRole("button", { name: "Bild herunterladen", exact: true }).click();
        const download = await downloadEvent;
        const stream = await download.createReadStream();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const png = Buffer.concat(chunks);
        assert(png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1920, "Story download is full resolution");
        await page.evaluate("Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined })");
        const fallbackDownload = page.waitForEvent("download");
        await share.click();
        assert(
          (await fallbackDownload).suggestedFilename().endsWith("-story.png"),
          "Unsupported file sharing downloads the selected image",
        );
        await page.evaluate(
          "Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('Denied'); } } })",
        );
        await dialog.getByRole("button", { name: "Link kopieren", exact: true }).click();
        assert(
          (await dialog.locator("textarea").inputValue()).endsWith(`/jobs/${slug}`),
          "Clipboard denial exposes selectable copy text",
        );
        const previous = await image.getAttribute("src");
        const frame = await dialog.getByTestId("job-share-preview").boundingBox();
        let release!: () => void;
        const hold = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route(
          (url) => url.pathname.endsWith("/social-image") && url.searchParams.get("format") === "feed",
          async (route) => {
            await hold;
            await route.continue();
          },
        );
        await dialog.getByLabel("Bildformat").selectOption("feed");
        assert((await image.getAttribute("src")) === previous, "Retain the decoded image while replacement loads");
        assert(await share.isDisabled(), "Image actions cannot share a stale format");
        release();
        await page.waitForFunction(
          (old) =>
            document.querySelector<HTMLImageElement>('[data-testid="job-share-preview"] img')?.getAttribute("src") !==
            old,
          previous,
        );
        const nextFrame = await dialog.getByTestId("job-share-preview").boundingBox();
        assert(
          frame?.width === nextFrame?.width && frame?.height === nextFrame?.height,
          "Format changes preserve the preview frame",
        );
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "detached" });
        assert(await trigger.evaluate((el) => el === document.activeElement), "Closing restores keyboard focus");
        let limited = false;
        for (let count = 0; count < 11 && !limited; count++) limited = (await fetch(linkImage)).status === 429;
        assert(limited, "Expensive image requests enforce their rate-limit result");
      } finally {
        await context.close();
      }
    });
    await runner.step("Jobs: nullable relations, dates and content work on SSR and direct browser entry", async () => {
      ids.sparse = await admin.createItem<RecordId>("job_offers", {
        slug: `${slug}-sparse`,
        role_title: `Sparse role ${config.runId}`,
        type: "volunteer",
        status: "published",
        organisation: ids.organisation!.id,
        start_date: null,
        end_date: null,
      });
      const api = await fetch(`${config.frontendUrl}/api/public/jobs/${slug}-sparse`);
      assert(api.ok, "Sparse job API must succeed");
      const data = JobsDetailResponseSchema.parse(await api.json());
      assert(
        data.job.organisation?.logo === null && data.job.start_date === null && data.job.tasks === null,
        "Missing logo, dates and content remain null",
      );
      const html = await pageHtml(`${config.frontendUrl}/jobs/${slug}-sparse`);
      assertIncludes(html, `Sparse role ${config.runId}`, "Sparse detail must render on SSR");
      const context = await newContext(browser);
      try {
        const page = await context.newPage();
        const errors = collectPublicPageErrors(page);
        await page.goto(`${config.frontendUrl}/jobs/${slug}-sparse`, { waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        assertIncludes(
          await page.locator("body").innerText(),
          `Sparse role ${config.runId}`,
          "Direct entry hydrates with nullable fields",
        );
        const contactAction = page.locator('main aside a.canonical-button[href^="/contact?"]');
        const contactHref = await contactAction.getAttribute("href");
        assert(contactHref, "Jobs without an application URL must offer contact");
        const contactUrl = new URL(contactHref, config.frontendUrl);
        assert(
          contactUrl.searchParams.get("title") === `Sparse role ${config.runId}`,
          "Contact subject identifies the job",
        );
        assert(contactUrl.searchParams.get("type") === "cooperation", "Contact category is preselected");
        assertIncludes(
          contactUrl.searchParams.get("content") || "",
          `/jobs/${slug}-sparse`,
          "Contact message includes the job URL",
        );
        assert((await contactAction.getAttribute("target")) === null, "Contact form opens in the current tab");
        await contactAction.click();
        await page.waitForURL("**/contact?**");
        await waitForHydration(page);
        assert(
          (await page.locator('form input[type="text"]').first().inputValue()) === `Sparse role ${config.runId}`,
          "Contact form keeps the job subject",
        );
        assert((await page.locator("form select").inputValue()) === "cooperation", "Contact form keeps its category");
        assertIncludes(
          await page.locator("form textarea").inputValue(),
          `/jobs/${slug}-sparse`,
          "Contact form keeps the job context",
        );

        // The CMS requires organisation on writes; simulate an unavailable
        // relation through the public contract without changing that constraint.
        await page.goto(`${config.frontendUrl}/jobs`, { waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        await page.route(
          (url) => url.pathname === `/api/public/jobs/${slug}-sparse`,
          (route) =>
            route.fulfill({
              json: { job: { ...data.job, organisation: null }, organisation: null },
            }),
        );
        await page.getByRole("link", { name: new RegExp(`Sparse role ${config.runId}`, "i") }).click();
        await page.waitForURL(`**/jobs/${slug}-sparse`);
        assertIncludes(
          await page.locator("body").innerText(),
          `Sparse role ${config.runId}`,
          "Missing organisation must work through client navigation",
        );
        assert(errors.length === 0, `Jobs hydration must have no page errors: ${errors.join(", ")}`);
      } finally {
        await context.close();
      }
    });

    await runner.step("Jobs: client navigation fetches the contract and handles an empty list", async () => {
      const context = await newContext(browser);
      try {
        const page = await context.newPage();
        await page.goto(`${config.frontendUrl}/jobs/${slug}`, { waitUntil: "domcontentloaded" });
        await waitForHydration(page);
        // The back link is a real NuxtLink: keep the same document to prove this
        // executes the browser data path rather than another SSR request.
        await page.evaluate(() => {
          (window as Window & { jobsDocument?: boolean }).jobsDocument = true;
        });
        await page.route(
          (url) => url.pathname === "/api/public/jobs",
          (route) => route.fulfill({ json: { jobs: [] } }),
        );
        const response = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/public/jobs");
        await page.locator('a[href="/jobs"]').first().click();
        await response;
        await page.waitForURL("**/jobs");
        assert(
          await page.evaluate(() => (window as Window & { jobsDocument?: boolean }).jobsDocument === true),
          "Jobs navigation must stay in the hydrated app",
        );
        await page.getByText(`Automated role ${config.runId}`, { exact: false }).first().waitFor({ state: "detached" });
        assert((await page.locator('a[href^="/jobs/"]').count()) === 0, "Empty list must not render stale job cards");
        assertNotIncludes(
          await page.locator("body").innerText(),
          `Automated role ${config.runId}`,
          "Empty-state navigation clears previous jobs",
        );
      } finally {
        await context.close();
      }
    });
  } finally {
    const ignore = async (run: () => Promise<unknown>) => {
      try {
        await run();
      } catch (error) {
        process.stderr.write(`Jobs fixture cleanup: ${String(error)}\n`);
      }
    };
    if (ids.draft) await ignore(() => admin.deleteItem("job_offers", ids.draft!.id));
    if (ids.sparse) await ignore(() => admin.deleteItem("job_offers", ids.sparse!.id));
    if (ids.job) await ignore(() => admin.deleteItem("job_offers", ids.job!.id));
    if (ids.organisation) await ignore(() => admin.deleteItem("organisations", ids.organisation!.id));
  }
}
