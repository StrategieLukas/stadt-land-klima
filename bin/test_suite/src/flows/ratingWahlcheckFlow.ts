import type { Browser, BrowserContextOptions, Page } from 'playwright';
import { assert, assertEqual, assertIncludes, assertNear, assertNotIncludes } from '../lib/assert.js';
import {
  gotoDirectusContent,
  loginDirectus,
  newContext,
  visibleText,
} from '../lib/browser.js';
import type { JsonRecord } from '../lib/directus.js';
import type { TestFixture } from '../lib/fixture.js';
import type { TestRunner } from '../lib/runner.js';
import { waitFor } from '../lib/wait.js';

interface CatalogVersion {
  id: string;
  name?: string | null;
  isCurrentFrontend?: boolean | null;
  isCurrentBackend?: boolean | null;
}

interface Score {
  id: string;
  catalog_version: string | CatalogVersion | null;
  municipality: string;
  published: boolean | null;
  score_total: string | number | null;
  percentage_rated: string | number | null;
}

interface Rating {
  id: string;
  choices?: string | null;
  measure_id?: {
    id: string;
    measure_id?: string | null;
    name?: string | null;
    sector?: string | null;
    catalog_version?: CatalogVersion | string | null;
  } | string | null;
}

interface Election {
  id: string;
  descriptor: string;
  already_generated_questions?: boolean | null;
  already_sent_mails?: boolean | null;
  review_requested?: boolean | null;
  is_approved?: boolean | null;
  is_public?: boolean | null;
}

interface Question {
  id: string;
  title: string;
  thesis: string;
  sector?: string | null;
  status?: string | null;
}

interface Candidate {
  id: string;
  name: string;
  salutation?: 'frau' | 'herr' | 'neutral' | null;
  email: string;
  party?: string | null;
  access_token?: string | null;
  has_answered?: boolean | null;
}

interface Answer {
  id: string;
  candidate: string;
  question: string;
  response: number;
  explanation?: string | null;
}

const DETAIL_SECTORS = [
  'energy',
  'transport',
  'agriculture',
  'industry',
  'buildings',
  'management',
] as const;

const DETAIL_SECTOR_LABELS: Record<(typeof DETAIL_SECTORS)[number], string> = {
  energy: 'Energie',
  transport: 'Verkehr',
  agriculture: 'Landwirtschaft, Natur & Ernährung',
  industry: 'Industrie, Wirtschaft & Konsum',
  buildings: 'Gebäude & Wärme',
  management: 'Klimaschutzmanagement & Verwaltung',
};

const DETAIL_ERROR_PATTERNS = [
  /Es ist ein Fehler/i,
  /Fehler beim Laden/i,
  /Loading error/i,
  /Server error/i,
  /PDF generation failed/i,
  /No scores found/i,
  /access denied/i,
];

function numeric(value: string | number | null | undefined): number {
  return typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
}

function catalog(value: Score['catalog_version']): CatalogVersion | null {
  return typeof value === 'object' && value !== null ? value : null;
}

function catalogName(score: Score): string {
  return catalog(score.catalog_version)?.name ?? String(score.catalog_version ?? '');
}

function isCurrentFrontendScore(score: Score): boolean {
  return catalog(score.catalog_version)?.isCurrentFrontend === true;
}

function relationCatalogId(rating: Rating): string | null {
  const measure = rating.measure_id;
  if (!measure || typeof measure !== 'object') return null;
  const version = measure.catalog_version;
  if (!version) return null;
  return typeof version === 'object' ? version.id : version;
}

function relationSector(rating: Rating): string | null {
  const measure = rating.measure_id;
  return measure && typeof measure === 'object' ? measure.sector ?? null : null;
}

function futureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

async function currentScore(fixture: TestFixture): Promise<Score> {
  const scores = await fixture.getScores() as Score[];
  const score = scores.find(isCurrentFrontendScore) ?? scores[0];
  assert(score, 'No municipality score exists for fixture municipality');
  return score;
}

async function waitForCurrentScore(
  fixture: TestFixture,
  predicate: (score: Score) => boolean,
  label: string,
): Promise<Score> {
  return waitFor(
    label,
    async () => {
      const score = await currentScore(fixture);
      return predicate(score) ? score : false;
    },
    { timeoutMs: 60_000, intervalMs: 1_500 },
  );
}

async function openFrontendPage(page: Page, url: string): Promise<string> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1_000);
  return visibleText(page);
}

function watchPageErrors(page: Page, label: string): () => void {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    const text = message.text();
    const isIgnoredDevtoolsSocketError = text.includes('vite_devtools_auth_token')
      || text.includes('ws://localhost:7812/');
    if (message.type() === 'error' && !isIgnoredDevtoolsSocketError) {
      errors.push(`console.error: ${text}`);
    }
  });

  return () => {
    assert(errors.length === 0, `${label} must not emit browser errors:\n${errors.join('\n')}`);
  };
}

function assertNoVisibleErrorMessages(text: string, label: string): void {
  const match = DETAIL_ERROR_PATTERNS.find((pattern) => pattern.test(text));
  assert(!match, `${label} must not show an error message matching ${String(match)}`);
}

async function visibleElementTexts(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluateAll((elements) => elements
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map((element) => String((element as HTMLElement).innerText ?? '')));
}

async function assertPdfButtonGeneratesValidPdf(
  page: Page,
  fixture: TestFixture,
  label: string,
): Promise<void> {
  assert(fixture.municipality.slug, 'Fixture municipality must have a slug before PDF generation');
  const responsePromise = page.waitForResponse(
    (response) => (
      response.request().method() === 'POST'
      && response.url().includes(`/pdf-service/municipality/${fixture.municipality.slug}/`)
    ),
    { timeout: 90_000 },
  );

  const pdfButton = page.getByRole('button', { name: /^PDF$/ }).first();
  await pdfButton.waitFor({ state: 'visible', timeout: 20_000 });
  await pdfButton.click();

  const response = await responsePromise;
  const contentType = response.headers()['content-type'] ?? '';
  const advertisedLength = Number.parseInt(response.headers()['content-length'] ?? '0', 10);
  assert(response.ok(), `${label} PDF response must be successful. Got HTTP ${response.status()}.`);
  assert(
    contentType.toLowerCase().includes('application/pdf'),
    `${label} PDF response must be application/pdf. Got "${contentType}".`,
  );
  assert(
    advertisedLength > 1_000,
    `${label} PDF button response must advertise a non-empty PDF. Got ${advertisedLength} byte(s).`,
  );

  const requestHeaders = response.request().headers();
  const authorization = requestHeaders.authorization ?? requestHeaders.Authorization;
  assert(authorization, `${label} PDF button request must include an authorization header`);
  const pdfResponse = await page.request.post(response.url(), {
    headers: { Authorization: authorization },
    data: { slug: fixture.municipality.slug },
  });
  const body = await pdfResponse.body();
  const apiContentType = pdfResponse.headers()['content-type'] ?? '';
  assert(pdfResponse.ok(), `${label} PDF byte validation request must be successful. Got HTTP ${pdfResponse.status()}.`);
  assert(
    apiContentType.toLowerCase().includes('application/pdf'),
    `${label} PDF byte validation response must be application/pdf. Got "${apiContentType}".`,
  );
  assert(body.length > 1_000, `${label} PDF must not be empty. Got ${body.length} byte(s).`);
  assertEqual(body.subarray(0, 4).toString('ascii'), '%PDF', `${label} PDF must start with a PDF header`);
}

async function assertMunicipalityDetailPageFeatures(
  browser: Browser,
  fixture: TestFixture,
  versionName: string,
  label: string,
  contextOptions: BrowserContextOptions,
): Promise<void> {
  assert(fixture.municipality.slug, 'Fixture municipality must have a slug before opening detail page');
  const context = await newContext(browser, contextOptions);
  const page = await context.newPage();
  const assertNoBrowserErrors = watchPageErrors(page, label);

  try {
    const text = await openFrontendPage(
      page,
      `${fixture.config.frontendUrl}/municipalities/${fixture.municipality.slug}?v=${encodeURIComponent(versionName)}`,
    );
    assertIncludes(text, fixture.municipalityName, `${label} detail page must show the municipality`);
    assertIncludes(text, 'PDF', `${label} detail page must show the PDF button`);
    assertNoVisibleErrorMessages(text, label);

    for (const sector of DETAIL_SECTORS) {
      const sectorCardTexts = await visibleElementTexts(page, `[name="sector-${sector}"]`);
      assert(sectorCardTexts.length >= 1, `${label} detail page must show the ${sector} sector card`);
      assert(
        sectorCardTexts.some((sectorText) => sectorText.includes(DETAIL_SECTOR_LABELS[sector])),
        `${label} detail page must show the ${DETAIL_SECTOR_LABELS[sector]} sector heading`,
      );
    }

    await assertPdfButtonGeneratesValidPdf(page, fixture, label);
    await page.waitForTimeout(500);
    assertNoVisibleErrorMessages(await visibleText(page), label);
    assertNoBrowserErrors();
  } finally {
    await context.close();
  }
}

async function assertRankingVisibility(
  browser: Browser,
  fixture: TestFixture,
  versionName: string,
  shouldContainMunicipality: boolean,
): Promise<void> {
  const context = await newContext(browser);
  const page = await context.newPage();
  try {
    const text = await openFrontendPage(
      page,
      `${fixture.config.frontendUrl}/municipalities?v=${encodeURIComponent(versionName)}`,
    );
    if (shouldContainMunicipality) {
      assertIncludes(text, fixture.municipalityName, `Ranking ${versionName} must show the published municipality`);
    } else {
      assertNotIncludes(text, fixture.municipalityName, `Ranking ${versionName} must not show the unpublished municipality`);
    }
  } finally {
    await context.close();
  }
}

async function clickScoreCheckbox(page: Page, catalogLabel: string): Promise<void> {
  const publisher = page.locator('.municipality-scores-publisher');
  await publisher.waitFor({ state: 'visible', timeout: 25_000 });
  const row = publisher.locator('.scores-row').filter({ hasText: catalogLabel }).first();
  await row.waitFor({ state: 'visible', timeout: 25_000 });
  const checkbox = row.locator('input[type="checkbox"]').first();
  await checkbox.waitFor({ state: 'attached', timeout: 10_000 });
  await checkbox.click({ force: true });
}

async function clickDirectusAction(page: Page, label: string): Promise<void> {
  const buttons = page.locator('button').filter({ hasText: label });
  const buttonCount = await buttons.count();
  if (buttonCount > 0) {
    await buttons.nth(buttonCount - 1).click({ force: true });
    return;
  }

  await page.getByText(label).last().click({ force: true });
}

async function renderedControlValues(page: Page): Promise<string[]> {
  return page
    .locator('input, textarea')
    .evaluateAll((elements) => elements.map((element) => String((element as any).value ?? '')));
}

async function readElection(fixture: TestFixture, electionId: string): Promise<Election> {
  return fixture.admin.readItem<Election>('elections', electionId, [
    'id',
    'descriptor',
    'already_generated_questions',
    'already_sent_mails',
    'review_requested',
    'is_approved',
    'is_public',
  ]);
}

async function readQuestions(fixture: TestFixture, electionId: string): Promise<Question[]> {
  return fixture.admin.readItems<Question>('questions', {
    filter: { election: { _eq: electionId } },
    fields: ['id', 'title', 'thesis', 'sector', 'status'],
    sort: ['date_created'],
    limit: -1,
  });
}

async function readCandidates(fixture: TestFixture, electionId: string): Promise<Candidate[]> {
  return fixture.admin.readItems<Candidate>('candidate', {
    filter: { election: { _eq: electionId } },
    fields: ['id', 'name', 'salutation', 'email', 'party', 'access_token', 'has_answered'],
    limit: -1,
  });
}

async function readAnswersForCandidate(fixture: TestFixture, candidateId: string): Promise<Answer[]> {
  return fixture.admin.readItems<Answer>('answers', {
    filter: { candidate: { _eq: candidateId } },
    fields: ['id', 'candidate', 'question', 'response', 'explanation'],
    limit: -1,
  });
}

async function submitCandidateAnswers(
  browser: Browser,
  fixture: TestFixture,
  candidate: Candidate,
  questions: Question[],
  responseValue: number,
): Promise<void> {
  assert(candidate.access_token, `Candidate ${candidate.name} is missing an access token`);
  const context = await newContext(browser);
  const page = await context.newPage();
  let submitAlert: string | null = null;
  try {
    page.on('dialog', (dialog) => {
      submitAlert = dialog.message();
      dialog.accept().catch(() => undefined);
    });
    await openFrontendPage(page, `${fixture.config.frontendUrl}/elections/thesen/${candidate.access_token}`);
    await page.getByText(candidate.name).waitFor({ state: 'visible', timeout: 30_000 });

    for (const question of questions) {
      const radio = page.locator(`input[name="question-${question.id}"][value="${responseValue}"]`);
      await radio.check({ force: true });
      await page.locator(`#explanation-${question.id}`).fill(
        `Automated explanation ${fixture.config.runId} for ${candidate.name}`,
      );
    }

    await page.locator('button.btn-primary').last().click();
    await page.getByText(/Vielen Dank|erfolgreich übermittelt|Thank you|successfully submitted|Grazie/i).first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    assert(!submitAlert, `Candidate answer form raised an alert: ${submitAlert}`);
  } finally {
    await context.close();
  }
}

async function completePublicWahlcheck(
  browser: Browser,
  fixture: TestFixture,
  questions: Question[],
  candidateNames: string[],
): Promise<void> {
  const context = await newContext(browser);
  const page = await context.newPage();
  try {
    await openFrontendPage(
      page,
      `${fixture.config.frontendUrl}/elections/wahlcheck/${fixture.municipality.slug}`,
    );
    await page.getByText('Klimawahlcheck').first().waitFor({ state: 'visible', timeout: 30_000 });

    for (let i = 0; i < questions.length; i += 1) {
      await page.locator('input[type="radio"]').first().check({ force: true });
      await page.locator('button.btn-primary').last().click();
      await page.waitForTimeout(250);
    }

    const weightCheckbox = page.locator('input[type="checkbox"].checkbox-primary').first();
    await weightCheckbox.waitFor({ state: 'visible', timeout: 30_000 });
    await weightCheckbox.check({ force: true });
    await page.locator('button.btn-primary').last().click();

    for (const name of candidateNames) {
      await page.getByText(name).first().waitFor({ state: 'visible', timeout: 30_000 });
    }
    const text = await visibleText(page);
    assertIncludes(text, 'Klimawahlcheck', 'Public Wahlcheck result page must render');
    assertIncludes(text, '1.', 'Public Wahlcheck result page must rank candidates');
    await waitFor(
      'public Wahlcheck share URL generated',
      async () => page.url().includes('share='),
      { timeoutMs: 10_000, intervalMs: 500 },
    );
  } finally {
    await context.close();
  }
}

export async function runRatingWahlcheckFlow(
  runner: TestRunner,
  fixture: TestFixture,
  browser: Browser,
): Promise<void> {
  let currentCatalogName = 'beta';
  let election: Election;
  let generatedQuestions: Question[] = [];
  let extraQuestion: Question;
  let candidates: Candidate[] = [];

  await runner.step('Ratings: municipality is hidden before scores are published', async () => {
    const score = await currentScore(fixture);
    currentCatalogName = catalogName(score) || currentCatalogName;
    await assertRankingVisibility(browser, fixture, currentCatalogName, false);
  });

  await runner.step('Ratings: fill current catalog ratings including not-applicable measures', async () => {
    const score = await currentScore(fixture);
    const currentCatalogId = catalog(score.catalog_version)?.id;
    assert(currentCatalogId, 'Current catalog score must include a catalog version id');

    const ratings = await fixture.localteamMember.client.readItems<Rating>('ratings_measures', {
      fields: [
        'id',
        'choices',
        'measure_id.id',
        'measure_id.measure_id',
        'measure_id.name',
        'measure_id.sector',
        'measure_id.catalog_version.id',
      ],
      limit: -1,
    });
    const currentRatings = ratings.filter((rating) => relationCatalogId(rating) === currentCatalogId);
    assert(currentRatings.length >= 10, 'Current catalog must expose enough ratings to complete the flow');
    const currentSectors = new Set(currentRatings.map(relationSector).filter((sector): sector is string => Boolean(sector)));
    for (const sector of DETAIL_SECTORS) {
      assert(currentSectors.has(sector), `Current catalog must include the ${sector} sector`);
    }

    for (let i = 0; i < currentRatings.length; i += 1) {
      const rating = currentRatings[i];
      const body: JsonRecord = i < 3
        ? {
          applicable: false,
          rating: null,
          why_not_applicable: `Automated not applicable reason ${fixture.config.runId}`,
          current_progress: null,
          source: null,
          status: 'published',
        }
        : {
          applicable: true,
          rating: '1',
          why_not_applicable: null,
          current_progress: `Automated progress ${fixture.config.runId} for rating ${i + 1}`,
          source: `https://stadt-land-klima.de/automated-test/${fixture.config.runId}/${i + 1}`,
          status: 'published',
        };
      await fixture.localteamMember.client.updateItem('ratings_measures', rating.id, body);
    }

    const updated = await waitForCurrentScore(
      fixture,
      (item) => numeric(item.percentage_rated) >= 95 && numeric(item.score_total) >= 99,
      'score recalculated after rating updates',
    );
    assertNear(numeric(updated.score_total), 100, 1, 'All applicable automated green ratings should produce a full score');
  });

  await runner.step('Ratings: preview is token-protected and not part of the public ranking', async () => {
    await assertRankingVisibility(browser, fixture, currentCatalogName, false);

    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      const lockedText = await openFrontendPage(
        page,
        `${fixture.config.frontendUrl}/municipalities/${fixture.municipality.slug}?v=${encodeURIComponent(currentCatalogName)}`,
      );
      assertIncludes(
        lockedText,
        'Diese Gemeinde wird aktuell durch ein Lokalteam eingerichtet',
        'Unverified unpublished municipality must be locked without preview token',
      );

      assert(fixture.municipality.preview_token, 'Fixture municipality must have a preview token');
      const previewText = await openFrontendPage(
        page,
        `${fixture.config.frontendUrl}/municipalities/${fixture.municipality.slug}?v=${encodeURIComponent(currentCatalogName)}&preview=${fixture.municipality.preview_token}`,
      );
      assertIncludes(previewText, fixture.municipalityName, 'Preview token must unlock municipality detail page');
      assertIncludes(previewText, 'Vorschau', 'Preview page must identify itself as unpublished preview');
      assertIncludes(previewText, '100', 'Preview page must show the current score');
    } finally {
      await context.close();
    }
  });

  await runner.step('Ratings: unverified localteam member cannot publish via Directus checkbox', async () => {
    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        fixture.localteamMember.email,
        fixture.localteamMember.password,
      );
      await gotoDirectusContent(page, fixture.config.backendUrl, 'municipalities', fixture.municipality.id);
      await clickScoreCheckbox(page, currentCatalogName);
      await page.getByText('Account nicht verifiziert').waitFor({ state: 'visible', timeout: 20_000 });
      const score = await currentScore(fixture);
      assertEqual(score.published, false, 'Unverified checkbox click must not publish score');
    } finally {
      await context.close();
    }
  });

  await runner.step('Ratings: verified localteam member can publish and unpublish via Directus checkbox', async () => {
    await fixture.admin.updateUser(fixture.localteamMember.id, { verified: true });
    await fixture.refreshUserClients();

    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        fixture.localteamMember.email,
        fixture.localteamMember.password,
      );
      await gotoDirectusContent(page, fixture.config.backendUrl, 'municipalities', fixture.municipality.id);

      await clickScoreCheckbox(page, currentCatalogName);
      await waitForCurrentScore(fixture, (item) => item.published === true, 'score published by verified user');
      await assertRankingVisibility(browser, fixture, currentCatalogName, true);

      await clickScoreCheckbox(page, currentCatalogName);
      await waitForCurrentScore(fixture, (item) => item.published === false, 'score unpublished by verified user');
      await assertRankingVisibility(browser, fixture, currentCatalogName, false);

      await clickScoreCheckbox(page, currentCatalogName);
      await waitForCurrentScore(fixture, (item) => item.published === true, 'score republished by verified user');
    } finally {
      await context.close();
    }

    const scores = await fixture.getScores() as Score[];
    for (const score of scores) {
      if (catalogName(score) !== currentCatalogName) {
        assertEqual(score.published, false, `Non-current catalog ${catalogName(score)} must remain unpublished`);
      }
    }
  });

  await runner.step('Ratings: municipality detail page sector cards and PDF work on desktop and mobile', async () => {
    await assertMunicipalityDetailPageFeatures(
      browser,
      fixture,
      currentCatalogName,
      'Desktop municipality detail',
      { viewport: { width: 1440, height: 1000 } },
    );
    await assertMunicipalityDetailPageFeatures(
      browser,
      fixture,
      currentCatalogName,
      'Mobile municipality detail',
      {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    );
  });

  await runner.step('Wahlcheck: template collection is visible and has the expected amount of entries', async () => {
    const templates = await fixture.localteamMember.client.readItems<{ id: string }>('measure_questions_template', {
      fields: ['id'],
      limit: -1,
    });
    assert(
      templates.length >= 30 && templates.length <= 50,
      `Expected 30 to 50 measure question templates, found ${templates.length}`,
    );

    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        fixture.localteamMember.email,
        fixture.localteamMember.password,
      );
      const text = await gotoDirectusContent(page, fixture.config.backendUrl, 'measure_questions_template');
      assertIncludes(text, 'Vorlagen', 'Template collection must be visible in the Directus app');
    } finally {
      await context.close();
    }
  });

  await runner.step('Wahlcheck: create election and generate ten theses from Directus action UI', async () => {
    election = await fixture.localteamMember.client.createItem<Election>('elections', {
      descriptor: `AutomatedElectionTest ${fixture.config.runId}`,
      localteam: fixture.localteam.id,
      candidate_email_cc: fixture.localteamMember.email,
      candidate_email_reply_to: fixture.localteamMember.email,
    });

    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        fixture.localteamMember.email,
        fixture.localteamMember.password,
      );
      let text = await gotoDirectusContent(page, fixture.config.backendUrl, 'elections', election.id);
      assertIncludes(text, 'Thesen generieren', 'Election action interface must expose thesis generation');
      assertIncludes(text, 'Review der Thesen anfragen', 'Election action interface must expose review request');
      assertNotIncludes(text, 'E-Mails versenden', 'Candidate email action must be hidden before approval');

      await clickDirectusAction(page, 'Thesen generieren');
      await page.getByText('Thesen wurden erfolgreich generiert.').waitFor({ state: 'visible', timeout: 60_000 });
      await waitFor(
        'ten generated Wahlcheck questions',
        async () => {
          generatedQuestions = await readQuestions(fixture, election.id);
          return generatedQuestions.length === 10 ? generatedQuestions : false;
        },
        { timeoutMs: 60_000, intervalMs: 1_000 },
      );
      text = await visibleText(page);
      assertIncludes(text, 'Thesen generiert', 'Election action interface must mark generated theses');
    } finally {
      await context.close();
    }

    generatedQuestions = await readQuestions(fixture, election.id);
    assertEqual(generatedQuestions.length, 10, 'Generate action must create exactly ten questions');
    for (const question of generatedQuestions) {
      assert(question.title, 'Generated question must have a title');
      assert(question.thesis, 'Generated question must have a thesis');
      assert(question.sector, 'Generated question must have a sector');
      assertEqual(question.status, 'published', 'Generated question must be published');
    }
  });

  await runner.step('Wahlcheck: add an extra thesis and verify question visibility', async () => {
    extraQuestion = await fixture.localteamMember.client.createItem<Question>('questions', {
      election: election.id,
      title: `Automated Extra Thesis ${fixture.config.runId}`,
      thesis: `Automated extra thesis body ${fixture.config.runId}`,
      sector: 'energy',
      status: 'published',
    });
    generatedQuestions = await readQuestions(fixture, election.id);
    assertEqual(generatedQuestions.length, 11, 'Election must have ten generated and one custom question');

    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        fixture.localteamMember.email,
        fixture.localteamMember.password,
      );
      const text = await gotoDirectusContent(page, fixture.config.backendUrl, 'questions');
      assertIncludes(text, extraQuestion.title, 'Questions list must show the custom thesis to the localteam user');
    } finally {
      await context.close();
    }
  });

  await runner.step('Wahlcheck: create candidates and verify the empty answers collection', async () => {
    await fixture.localteamMember.client.createItem<Candidate>('candidate', {
      election: election.id,
      name: `AutomatedCandidateA ${fixture.config.runId}`,
      salutation: 'frau',
      email: fixture.candidateAEmail,
      party: 'Gruene',
    });
    await fixture.localteamMember.client.createItem<Candidate>('candidate', {
      election: election.id,
      name: `AutomatedCandidateB ${fixture.config.runId}`,
      salutation: 'herr',
      email: fixture.candidateBEmail,
      party: `AutomatedParty ${fixture.config.runId}`,
    });

    candidates = await readCandidates(fixture, election.id);
    assertEqual(candidates.length, 2, 'Election must have exactly two candidates');
    assert(candidates.some((candidate) => candidate.email === fixture.candidateAEmail), 'Candidate A must exist');
    assert(candidates.some((candidate) => candidate.email === fixture.candidateBEmail), 'Candidate B must exist');
    assert(
      candidates.some((candidate) => candidate.salutation === 'frau'),
      'Candidate A must retain the selected salutation',
    );
    assert(
      candidates.some((candidate) => candidate.salutation === 'herr'),
      'Candidate B must retain the selected salutation',
    );

    const answers = await fixture.localteamMember.client.readItems<Answer>('answers', {
      fields: ['id'],
      limit: -1,
    });
    assertEqual(answers.length, 0, 'Answers collection must be visible but empty before candidate responses');

    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        fixture.localteamMember.email,
        fixture.localteamMember.password,
      );
      let text = await gotoDirectusContent(page, fixture.config.backendUrl, 'candidate');
      assertIncludes(text, `AutomatedCandidateA ${fixture.config.runId}`, 'Candidate list must show candidate A');
      assertIncludes(text, `AutomatedCandidateB ${fixture.config.runId}`, 'Candidate list must show candidate B');
      text = await gotoDirectusContent(page, fixture.config.backendUrl, 'answers');
      assertNotIncludes(text, `AutomatedCandidateA ${fixture.config.runId}`, 'Answers list must not show answers before responses');
      assertNotIncludes(text, `AutomatedCandidateB ${fixture.config.runId}`, 'Answers list must not show answers before responses');
    } finally {
      await context.close();
    }
  });

  await runner.step('Wahlcheck: request thesis review and approve with WahlcheckAdmin', async () => {
    await fixture.localteamMember.client.updateItem('elections', election.id, {
      response_cutoff_date: futureDate(7),
    });

    const memberContext = await newContext(browser);
    const memberPage = await memberContext.newPage();
    try {
      await loginDirectus(
        memberPage,
        fixture.config.backendUrl,
        fixture.localteamMember.email,
        fixture.localteamMember.password,
      );
      let text = await gotoDirectusContent(memberPage, fixture.config.backendUrl, 'elections', election.id);
      assertNotIncludes(text, 'E-Mails versenden', 'Send emails button must not be available before approval');
      await clickDirectusAction(memberPage, 'Review der Thesen anfragen');
      await memberPage.getByText('Review der Thesen wurde angefragt.').waitFor({ state: 'visible', timeout: 30_000 });
      election = await waitFor(
        'review_requested flag set',
        async () => {
          const item = await readElection(fixture, election.id);
          return item.review_requested ? item : false;
        },
        { timeoutMs: 30_000 },
      );
      text = await visibleText(memberPage);
      assertIncludes(text, 'Review angefragt', 'Election action interface must show review-requested state');
    } finally {
      await memberContext.close();
    }

    const adminContext = await newContext(browser);
    const adminPage = await adminContext.newPage();
    try {
      await loginDirectus(
        adminPage,
        fixture.config.backendUrl,
        fixture.wahlcheckAdmin.email,
        fixture.wahlcheckAdmin.password,
      );
      const text = await gotoDirectusContent(adminPage, fixture.config.backendUrl, 'elections', election.id);
      assertIncludes(text, 'Review angefragt', 'WahlcheckAdmin must see the review-requested state');
      const values = await renderedControlValues(adminPage);
      assert(
        values.some((value) => value.includes(election.descriptor)),
        'WahlcheckAdmin must see the review-requested election descriptor in the Directus form',
      );
    } finally {
      await adminContext.close();
    }

    election = await fixture.wahlcheckAdmin.client.updateItem<Election>('elections', election.id, {
      is_approved: true,
    });
    assertEqual(election.is_approved, true, 'WahlcheckAdmin must be able to approve the Wahlcheck');

    runner.addManualCheck(
      'rating_wahlcheck_flow',
      `Verify the review request email for "${election.descriptor}" arrived at ${fixture.config.env.WAHLCHECK_EMAIL || 'info@stadt-land-klima.de'} and links to ${fixture.config.backendUrl}/admin/content/elections/${election.id}.`,
    );
  });

  await runner.step('Wahlcheck: send candidate emails from Directus action UI and generate stable tokens', async () => {
    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      page.on('dialog', (dialog) => dialog.accept());
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        fixture.localteamMember.email,
        fixture.localteamMember.password,
      );
      const text = await gotoDirectusContent(page, fixture.config.backendUrl, 'elections', election.id);
      assertIncludes(text, 'E-Mails versenden', 'Send emails action must be available after approval');
      await clickDirectusAction(page, 'E-Mails versenden');
      await page.getByText('Versandübersicht').waitFor({ state: 'visible', timeout: 60_000 });
    } finally {
      await context.close();
    }

    candidates = await waitFor(
      'candidate access tokens generated',
      async () => {
        const items = await readCandidates(fixture, election.id);
        return items.length === 2 && items.every((candidate) => candidate.access_token) ? items : false;
      },
      { timeoutMs: 30_000 },
    );
    const tokens = new Set(candidates.map((candidate) => candidate.access_token));
    assertEqual(tokens.size, 2, 'Each candidate must have a unique stable access token');

    runner.addManualCheck(
      'rating_wahlcheck_flow',
      `Verify candidate invitation emails to ${fixture.candidateAEmail} and ${fixture.candidateBEmail}. Each should include a personal thesis link. In local dev, SMTP is usually disabled, so the test verifies generated tokens and uses ${fixture.config.frontendUrl}/elections/thesen/<token>.`,
    );
  });

  await runner.step('Wahlcheck: candidates answer all theses through their public links', async () => {
    generatedQuestions = await readQuestions(fixture, election.id);
    assertEqual(generatedQuestions.length, 11, 'Candidate answer form must be backed by eleven questions');

    const candidateA = candidates.find((candidate) => candidate.email === fixture.candidateAEmail);
    const candidateB = candidates.find((candidate) => candidate.email === fixture.candidateBEmail);
    assert(candidateA, 'Candidate A missing before answer submission');
    assert(candidateB, 'Candidate B missing before answer submission');

    await submitCandidateAnswers(browser, fixture, candidateA, generatedQuestions, 4);
    await submitCandidateAnswers(browser, fixture, candidateB, generatedQuestions, 0);

    for (const candidate of [candidateA, candidateB]) {
      await waitFor(
        `${candidate.name} answer persistence`,
        async () => {
          const [fresh] = (await readCandidates(fixture, election.id))
            .filter((item) => item.id === candidate.id);
          const answers = await readAnswersForCandidate(fixture, candidate.id);
          return fresh?.has_answered === true && answers.length === generatedQuestions.length
            ? { fresh, answers }
            : false;
        },
        { timeoutMs: 45_000, intervalMs: 1_000 },
      );
      const answers = await readAnswersForCandidate(fixture, candidate.id);
      assertEqual(answers.length, generatedQuestions.length, `${candidate.name} must have one answer per thesis`);
      for (const answer of answers) {
        assert(typeof answer.response === 'number', 'Each candidate answer must have a numeric response');
        assertIncludes(answer.explanation ?? '', fixture.config.runId, 'Each candidate answer must keep its explanation');
      }
    }
  });

  await runner.step('Wahlcheck: public election appears and public wizard produces ranked results', async () => {
    election = await fixture.localteamMember.client.updateItem<Election>('elections', election.id, {
      is_public: true,
    });
    assertEqual(election.is_public, true, 'Localteam member must be able to publish an approved Wahlcheck');

    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      const overviewText = await openFrontendPage(page, `${fixture.config.frontendUrl}/elections/wahlcheck`);
      assertIncludes(overviewText, election.descriptor, 'Public Wahlcheck overview must list the published election');
      assertIncludes(overviewText, fixture.municipalityName, 'Public Wahlcheck overview must show the municipality/localteam');
    } finally {
      await context.close();
    }

    await completePublicWahlcheck(
      browser,
      fixture,
      generatedQuestions,
      candidates.map((candidate) => candidate.name),
    );
  });
}
