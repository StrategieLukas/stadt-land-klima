import type { Browser } from 'playwright';
import { assert, assertIncludes, assertNotIncludes } from '../lib/assert.js';
import { newContext } from '../lib/browser.js';
import type { TestFixture } from '../lib/fixture.js';
import type { TestRunner } from '../lib/runner.js';

type RecordId = { id: string | number; slug?: string };

async function pageHtml(url: string): Promise<string> {
  const response = await fetch(url);
  assert(response.ok, `${url} should return 200, received ${response.status}`);
  return (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

export async function runJobsFlow(runner: TestRunner, fixture: TestFixture, browser: Browser): Promise<void> {
  const { admin, config } = fixture;
  const slug = `automated-job-${config.runId}`;
  const ids: { organisation?: RecordId; job?: RecordId } = {};

  try {
    await runner.step('Jobs: published job appears in list and detail', async () => {
      ids.organisation = await admin.createItem<RecordId>('organisations', {
        name: `Automated org ${config.runId}`,
        link: 'https://example.org',
      });
      ids.job = await admin.createItem<RecordId>('job_offers', {
        slug,
        role_title: `Automated role ${config.runId}`,
        type: 'full_time',
        status: 'published',
        tasks: 'Build climate solutions',
        qualifications: 'Experience with TypeScript',
        benefits: 'Remote work',
        salary: '45000 €',
        weekly_hours: '40',
        start_date: '2027-01-01T00:00:00Z',
        end_date: null,
        application_url: 'https://example.org/apply',
        organisation: ids.organisation.id,
      });

      // Verify list API
      const listResponse = await fetch(`${config.frontendUrl}/api/public/jobs`);
      assert(listResponse.ok, 'Jobs list API should return 200');
      const listData = await listResponse.json() as { jobs: any[] };
      assert(listData.jobs.length >= 1, 'Jobs list should contain at least one job');
      const listedJob = listData.jobs.find((j: any) => j.slug === slug);
      assert(listedJob, 'Listed jobs should include our fixture');
      assert(listedJob.role_title === `Automated role ${config.runId}`, 'Role title should match');
      assert(listedJob.type === 'full_time', 'Type should be full_time');
      assert(listedJob.organisation?.name === `Automated org ${config.runId}`, 'Organisation should be included');
      assert(listedJob.start_date !== null, 'Start date should be present');
      assert(listedJob.end_date === null, 'End date should be null');

      // Verify detail API
      const detailResponse = await fetch(`${config.frontendUrl}/api/public/jobs/${slug}`);
      assert(detailResponse.ok, 'Jobs detail API should return 200');
      const detailData = await detailResponse.json() as { job: any; organisation: any };
      assert(detailData.job.role_title === `Automated role ${config.runId}`, 'Detail role title should match');
      assert(detailData.job.tasks === 'Build climate solutions', 'Tasks should be present');
      assert(detailData.job.qualifications === 'Experience with TypeScript', 'Qualifications should be present');
      assert(detailData.job.benefits === 'Remote work', 'Benefits should be present');
      assert(detailData.job.salary === '45000 €', 'Salary should be present');
      assert(detailData.job.weekly_hours === '40', 'Weekly hours should be present');
      assert(detailData.job.application_url === 'https://example.org/apply', 'Application URL should be present');
      assert(detailData.job.contact_notes === null, 'Contact notes should be null when not set');
      assert(detailData.organisation?.name === `Automated org ${config.runId}`, 'Organisation should be included in detail');

      // Verify 404 for non-existent job
      const notFound = await fetch(`${config.frontendUrl}/api/public/jobs/non-existent-slug`);
      assert(notFound.status === 404, 'Non-existent job should return 404');

      // Verify SSR page renders
      const listPage = await pageHtml(`${config.frontendUrl}/jobs`);
      assertIncludes(listPage, `Automated role ${config.runId}`, 'Jobs list page should render the job title');
      assertIncludes(listPage, `Automated org ${config.runId}`, 'Jobs list page should render the organisation');

      const detailPage = await pageHtml(`${config.frontendUrl}/jobs/${slug}`);
      assertIncludes(detailPage, `Automated role ${config.runId}`, 'Detail page should render the job title');
      assertIncludes(detailPage, 'Build climate solutions', 'Detail page should render tasks');
      assertIncludes(detailPage, 'Experience with TypeScript', 'Detail page should render qualifications');
      assertIncludes(detailPage, 'Remote work', 'Detail page should render benefits');
      assertIncludes(detailPage, '45000 €', 'Detail page should render salary');
      assertIncludes(detailPage, `Automated org ${config.runId}`, 'Detail page should render organisation name');
      assertIncludes(detailPage, 'https://example.org/apply', 'Detail page should render application URL');

      // Verify draft jobs are hidden
      const draftJob = await admin.createItem<RecordId>('job_offers', {
        slug: `${slug}-draft`,
        role_title: `Draft job ${config.runId}`,
        type: 'volunteer',
        status: 'draft',
        organisation: ids.organisation.id,
      });
      const draftList = await pageHtml(`${config.frontendUrl}/jobs`);
      assertNotIncludes(draftList, `Draft job ${config.runId}`, 'Draft jobs must not appear in list');
      const draftDetail = await fetch(`${config.frontendUrl}/api/public/jobs/${slug}-draft`);
      assert(draftDetail.status === 404, 'Draft jobs must return 404 via API');
      await admin.deleteItem('job_offers', draftJob.id);

      // Browser navigation test
      const context = await newContext(browser);
      try {
        const page = await context.newPage();
        await page.goto(`${config.frontendUrl}/jobs`, { waitUntil: 'networkidle' });
        const bodyText = await page.locator('body').innerText();
        assertIncludes(bodyText, `Automated role ${config.runId}`, 'Browser should render job title');

        // Click through to detail and wait for content
        await page.getByRole('link', { name: new RegExp(`Automated role ${config.runId}`, 'i') }).click();
        await page.waitForURL(`**/jobs/${slug}`);
        await page.waitForLoadState('networkidle');
        // Wait for the detail content to appear
        await page.waitForFunction(
          (text) => document.body.innerText.includes(text),
          'Build climate solutions',
          { timeout: 10000 },
        );
        assertIncludes(await page.locator('body').innerText(), 'Build climate solutions', 'Detail page should render in browser');
      } finally {
        await context.close();
      }
    });
  } finally {
    const ignore = async (run: () => Promise<unknown>) => { try { await run(); } catch (error) { process.stderr.write(`Jobs fixture cleanup: ${String(error)}\n`); } };
    if (ids.job) await ignore(() => admin.deleteItem('job_offers', ids.job!.id));
    if (ids.organisation) await ignore(() => admin.deleteItem('organisations', ids.organisation!.id));
  }
}
