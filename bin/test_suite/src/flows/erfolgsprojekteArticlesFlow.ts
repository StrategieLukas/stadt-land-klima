import type { Browser, BrowserContextOptions, Page } from 'playwright';
import { assert, assertEqual, assertIncludes, assertNotIncludes } from '../lib/assert.js';
import {
  loginDirectus,
  newContext,
  visibleText,
} from '../lib/browser.js';
import { DirectusClient, type JsonRecord } from '../lib/directus.js';
import type { TestFixture } from '../lib/fixture.js';
import { PNG_1X1 } from '../lib/images.js';
import type { TestRunner } from '../lib/runner.js';
import { sleep, waitFor } from '../lib/wait.js';

interface Role {
  id: string;
  name: string;
}

interface DirectusUser {
  id: string;
  email: string;
  role?: string | { id: string; name?: string | null };
  status?: string | null;
}

interface DirectusFile {
  id: string;
  type?: string | null;
  title?: string | null;
}

interface AgreementVersion {
  id: string;
  type: string;
}

interface Organisation {
  id: number;
  name: string;
  link?: string | null;
  logo?: string | DirectusFile | null;
}

interface Measure {
  id: string;
  measure_id?: string | null;
  name?: string | null;
  slug?: string | null;
}

interface Article {
  id: number;
  title: string;
  slug: string;
  status: string;
  subtitle?: string | null;
  author?: string | null;
  municipality_name?: string | null;
  state?: string | null;
  image?: string | DirectusFile | null;
  image_credits?: string | null;
  abstract?: string | null;
  article_text?: string | null;
  link?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  sectors?: string[] | null;
  organisation?: number | Organisation | null;
  can_do_autonomously?: boolean | null;
  is_profitable?: boolean | null;
  public_impact_effects?: string[] | null;
  ghg_savings_level?: string | null;
  measures?: Array<{ measures_id?: Measure | string | null }>;
}

interface ArticleSeed {
  title: string;
  slug: string;
  author: string;
  municipality: string;
  state: string;
  sectors: string[];
  imageId: string;
  organisationId?: number | null;
  status?: 'draft' | 'published';
  subtitle?: string;
  abstract?: string;
  articleText?: string;
  imageCredits?: string;
  link?: string;
  instagram?: string;
  linkedin?: string;
  canDoAutonomously?: boolean;
  isProfitable?: boolean;
  publicImpactEffects?: string[];
  ghgSavingsLevel?: 'none' | 'high' | 'very_high';
  additionalPrefix?: string;
}

interface FlowState {
  redaktionClient: DirectusClient;
  redaktionUser: DirectusUser;
  sampleArticle: Article;
  controlArticle: Article;
  contributorArticle: Article;
  unpublishedArticle: Article;
  sampleOrganisation: Organisation;
  controlOrganisation: Organisation;
  measure: Measure;
  socialInstagram: string;
  socialLinkedin: string;
  projectLink: string;
}

const DETAIL_ERROR_PATTERNS = [
  /Es ist ein Fehler/i,
  /Fehler beim Laden/i,
  /Projekt nicht gefunden/i,
  /Loading error/i,
  /access denied/i,
];

function roleName(user: DirectusUser): string | undefined | null {
  return typeof user.role === 'object' ? user.role.name : undefined;
}

function fileId(file: DirectusFile): string {
  assert(file.id, 'Uploaded Directus file must include an id');
  return file.id;
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

async function openFrontendPage(page: Page, url: string): Promise<string> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(1_000);
  return visibleText(page);
}

async function assertAnyVisible(page: Page, selector: string, message: string): Promise<void> {
  const visible = await page.locator(selector).evaluateAll((elements) => elements.some((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0
      && rect.height > 0
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.opacity !== '0';
  }));
  assert(visible, message);
}

async function createAuthenticatedUser(
  fixture: TestFixture,
  roleNameToCreate: string,
  email: string,
  password: string,
): Promise<{ user: DirectusUser; client: DirectusClient }> {
  const role = fixture.roles.get(roleNameToCreate) as Role | undefined;
  assert(role, `Required role is missing: ${roleNameToCreate}`);

  const user = await fixture.admin.createUser<DirectusUser>({
    email,
    password,
    role: role.id,
    status: 'active',
    first_name: 'Automated',
    last_name: roleNameToCreate,
    verified: true,
  });
  await acceptCurrentAgreementsForUser(fixture, user.id);
  const expandedUsers = await fixture.admin.readUsers<DirectusUser>({
    filter: { id: { _eq: user.id } },
    fields: ['id', 'email', 'status', 'role.name'],
    limit: 1,
  });
  const client = new DirectusClient(fixture.config.backendUrl);
  await client.login(email, password);
  return { user: expandedUsers[0] ?? user, client };
}

async function acceptCurrentAgreementsForUser(fixture: TestFixture, userId: string): Promise<void> {
  const agreements = await fixture.admin.readItems<AgreementVersion>('agreement_versions', {
    filter: {
      isCurrentVersion: { _eq: true },
      type: { _in: ['terms_of_service', 'data_protection'] },
    },
    fields: ['id', 'type'],
    limit: -1,
  });
  const agreementTypes = new Set(agreements.map((agreement) => agreement.type));
  for (const type of ['terms_of_service', 'data_protection']) {
    assert(agreementTypes.has(type), `Current agreement version is missing: ${type}`);
  }
  for (const agreement of agreements) {
    await fixture.admin.createItem('user_consent', {
      user_id: userId,
      consent_target: agreement.id,
    });
  }
}

async function uploadTestImage(
  fixture: TestFixture,
  client: DirectusClient,
  runId: string,
  label: string,
): Promise<DirectusFile> {
  const title = `Automated ${label} ${runId}`;
  const uploaded = await client.uploadFile<DirectusFile | null>(
    `automated-${label}-${runId}.png`,
    'image/png',
    PNG_1X1,
    title,
  );
  if (uploaded?.id) return uploaded;

  return waitFor(
    `uploaded Directus file ${title}`,
    async () => {
      const files = await fixture.admin.request<DirectusFile[]>('GET', '/files', {
        query: {
          filter: JSON.stringify({ title: { _eq: title } }),
          fields: 'id,type,title',
          limit: 1,
        },
      });
      return files[0] ?? false;
    },
    { timeoutMs: 15_000, intervalMs: 500 },
  );
}

async function firstCurrentMeasure(fixture: TestFixture): Promise<Measure> {
  const measures = await fixture.admin.readItems<Measure>('measures', {
    filter: {
      status: { _eq: 'published' },
      catalog_version: { isCurrentFrontend: { _eq: true } },
    },
    fields: ['id', 'measure_id', 'name', 'slug'],
    limit: 1,
  });
  assert(measures[0], 'At least one current published measure is required for article tests');
  return measures[0];
}

async function createOrganisation(
  client: DirectusClient,
  runId: string,
  name: string,
  logoId: string,
): Promise<Organisation> {
  return client.createItem<Organisation>('organisations', {
    name,
    link: `https://example.com/organisation/${encodeURIComponent(runId)}`,
    short_description: `Automatisierte Organisationsbeschreibung ${runId}`,
    instagram: 'https://www.instagram.com/stadt.land.klima',
    linkedin: 'https://www.linkedin.com/company/stadt-land-klima',
    logo: logoId,
  });
}

function articlePayload(seed: ArticleSeed): JsonRecord {
  const prefix = seed.additionalPrefix ?? seed.title;
  const body: JsonRecord = {
    title: seed.title,
    slug: seed.slug,
    author: seed.author,
    municipality_name: seed.municipality,
    state: seed.state,
    subtitle: seed.subtitle ?? `${prefix} Untertitel`,
    image: seed.imageId,
    image_credits: seed.imageCredits ?? `${prefix} Bildnachweis`,
    abstract: seed.abstract ?? `**${prefix} Kurzfassung** mit messbarem Nutzen.`,
    article_text: seed.articleText ?? [
      `# ${prefix} Detailabschnitt`,
      '',
      `Dieser automatisierte Erfolgsprojekt-Text prüft die Detailseite für ${prefix}.`,
      '',
      `- Klimaschutzwirkung`,
      `- Beteiligung der Kommune`,
    ].join('\n'),
    organisation: seed.organisationId ?? null,
    link: seed.link ?? `https://example.com/projects/${encodeURIComponent(seed.slug)}`,
    sectors: seed.sectors,
    additional_examples: `${prefix} zusätzliche Beispiele`,
    sources: `${prefix} Quellenangaben`,
    economic_efficiency: `${prefix} wirtschaftliche Einordnung`,
    public_impact: `${prefix} öffentliche Wirkung`,
    ghg_savings_potential: `${prefix} Einsparpotenzial`,
    other_benefits: `${prefix} weitere Vorteile`,
    ease_of_implementation: `${prefix} Umsetzbarkeit`,
    can_do_autonomously: seed.canDoAutonomously ?? false,
    is_profitable: seed.isProfitable ?? false,
    public_impact_effects: seed.publicImpactEffects ?? [],
    ghg_savings_level: seed.ghgSavingsLevel ?? 'none',
    instagram: seed.instagram ?? null,
    linkedin: seed.linkedin ?? null,
  };
  if (seed.status) body.status = seed.status;
  for (const key of ['organisation', 'link', 'instagram', 'linkedin']) {
    if (body[key] == null) delete body[key];
  }
  return body;
}

async function createArticle(
  client: DirectusClient,
  seed: ArticleSeed,
): Promise<Article> {
  return client.createItem<Article>('articles', articlePayload(seed));
}

async function readArticle(admin: DirectusClient, id: number): Promise<Article> {
  return admin.readItem<Article>('articles', id, [
    'id',
    'title',
    'slug',
    'status',
    'subtitle',
    'author',
    'municipality_name',
    'state',
    'image.id',
    'image.type',
    'image_credits',
    'abstract',
    'article_text',
    'link',
    'instagram',
    'linkedin',
    'sectors',
    'organisation.id',
    'organisation.name',
    'can_do_autonomously',
    'is_profitable',
    'public_impact_effects',
    'ghg_savings_level',
    'measures.measures_id.id',
    'measures.measures_id.measure_id',
    'measures.measures_id.name',
    'measures.measures_id.slug',
  ]);
}

async function expectArticleAbsent(admin: DirectusClient, id: number, label: string): Promise<void> {
  const rows = await admin.readItems<{ id: number }>('articles', {
    filter: { id: { _eq: id } },
    fields: ['id'],
    limit: 1,
  });
  assertEqual(rows.length, 0, label);
}

async function assertDirectusArticleValues(
  fixture: TestFixture,
  articleId: number,
  measure: Measure,
  expected: {
    title: string;
    status: string;
    organisation: Organisation;
    imageId: string;
    sectors: string[];
    publicImpactEffects: string[];
    ghgSavingsLevel: string;
  },
): Promise<Article> {
  const article = await readArticle(fixture.admin, articleId);
  assertEqual(article.title, expected.title, 'Article title must match');
  assertEqual(article.status, expected.status, 'Article status must match');
  assertEqual((article.image as DirectusFile | null)?.id, expected.imageId, 'Article image relation must be set');
  assertEqual((article.organisation as Organisation | null)?.id, expected.organisation.id, 'Article organisation relation must be set');
  for (const sector of expected.sectors) {
    assert(article.sectors?.includes(sector), `Article sectors must include ${sector}`);
  }
  for (const effect of expected.publicImpactEffects) {
    assert(article.public_impact_effects?.includes(effect), `Article public impact effects must include ${effect}`);
  }
  assertEqual(article.ghg_savings_level, expected.ghgSavingsLevel, 'Article savings level must match');
  assert(
    article.measures?.some((entry) => {
      const related = entry.measures_id;
      return typeof related === 'object' && related?.id === measure.id;
    }),
    'Article must link the selected measure through articles_measures',
  );
  return article;
}

async function assertArticleDetailPage(
  browser: Browser,
  fixture: TestFixture,
  state: FlowState,
  label: string,
  contextOptions: BrowserContextOptions,
): Promise<void> {
  const context = await newContext(browser, contextOptions);
  const page = await context.newPage();
  const assertNoBrowserErrors = watchPageErrors(page, label);

  try {
    const text = await openFrontendPage(
      page,
      `${fixture.config.frontendUrl}/projects/${state.sampleArticle.slug}`,
    );
    assertIncludes(text, state.sampleArticle.title, `${label} detail page must show title`);
    assertIncludes(text, state.sampleArticle.subtitle ?? '', `${label} detail page must show subtitle`);
    assertIncludes(text, state.sampleArticle.municipality_name ?? '', `${label} detail page must show municipality`);
    assertIncludes(text, state.sampleArticle.state ?? '', `${label} detail page must show state`);
    assertIncludes(text, state.sampleArticle.author ?? '', `${label} detail page must show author`);
    assertIncludes(text, state.sampleArticle.image_credits ?? '', `${label} detail page must show image credits`);
    assertIncludes(text, 'Kurzfassung', `${label} detail page must show rendered abstract`);
    assertIncludes(text, 'Detailabschnitt', `${label} detail page must show rendered article body`);
    assertIncludes(text, state.sampleOrganisation.name, `${label} detail page must show organisation`);
    assertIncludes(text, state.measure.name ?? '', `${label} detail page must show related measure name`);
    assertIncludes(text, state.measure.measure_id ?? '', `${label} detail page must show related measure id`);
    assertNoVisibleErrorMessages(text, label);

    await page.getByRole('img', { name: state.sampleArticle.title }).first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    await assertAnyVisible(page, `a[href="${state.projectLink}"]`, `${label} detail page must show project link`);
    await assertAnyVisible(
      page,
      `a[href="${state.socialInstagram}"] img[alt="Instagram"]`,
      `${label} detail page must show Instagram link`,
    );
    await assertAnyVisible(
      page,
      `a[href="${state.socialLinkedin}"] img[alt="LinkedIn"]`,
      `${label} detail page must show LinkedIn link`,
    );
    assertNoBrowserErrors();
  } finally {
    await context.close();
  }
}

async function assertProjectOverviewVisibility(
  browser: Browser,
  fixture: TestFixture,
  state: FlowState,
): Promise<void> {
  const context = await newContext(browser);
  const page = await context.newPage();
  const assertNoBrowserErrors = watchPageErrors(page, 'Projects overview');

  try {
    const text = await openFrontendPage(page, `${fixture.config.frontendUrl}/projects`);
    assertIncludes(text, state.sampleArticle.title, 'Projects overview must show the published sample article');
    assertIncludes(text, state.controlArticle.title, 'Projects overview must show the published control article');
    assertIncludes(text, state.contributorArticle.title, 'Projects overview must show the redaktion-published contributor article');
    assertNotIncludes(text, state.unpublishedArticle.title, 'Projects overview must not show unpublished draft articles');
    assertNoVisibleErrorMessages(text, 'Projects overview');
    assertNoBrowserErrors();
  } finally {
    await context.close();
  }
}

async function overviewTextAfter(
  page: Page,
  action: () => Promise<void>,
): Promise<string> {
  await action();
  await page.waitForTimeout(300);
  return visibleText(page);
}

async function assertFilterShowsOnlySample(
  browser: Browser,
  fixture: TestFixture,
  state: FlowState,
  label: string,
  action: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await newContext(browser);
  const page = await context.newPage();
  const assertNoBrowserErrors = watchPageErrors(page, label);

  try {
    await openFrontendPage(page, `${fixture.config.frontendUrl}/projects`);
    const text = await overviewTextAfter(page, () => action(page));
    assertIncludes(text, state.sampleArticle.title, `${label} must keep the matching sample article visible`);
    assertNotIncludes(text, state.controlArticle.title, `${label} must hide the non-matching control article`);
    assertNotIncludes(text, state.unpublishedArticle.title, `${label} must keep unpublished articles hidden`);
    assertNoVisibleErrorMessages(text, label);
    assertNoBrowserErrors();
  } finally {
    await context.close();
  }
}

async function assertMunicipalityQueryFilter(
  browser: Browser,
  fixture: TestFixture,
  state: FlowState,
): Promise<void> {
  const context = await newContext(browser);
  const page = await context.newPage();
  const assertNoBrowserErrors = watchPageErrors(page, 'Projects municipality query filter');

  try {
    const url = new URL('/projects', fixture.config.frontendUrl);
    url.searchParams.set('municipality', state.sampleArticle.municipality_name ?? '');
    const text = await openFrontendPage(page, url.toString());
    assertIncludes(text, state.sampleArticle.title, 'Municipality query filter must show the matching sample article');
    assertNotIncludes(text, state.controlArticle.title, 'Municipality query filter must hide non-matching articles');
    assertNotIncludes(text, state.unpublishedArticle.title, 'Municipality query filter must keep unpublished articles hidden');
    assertNoBrowserErrors();
  } finally {
    await context.close();
  }
}

async function assertSavingsSort(
  browser: Browser,
  fixture: TestFixture,
  state: FlowState,
): Promise<void> {
  const context = await newContext(browser);
  const page = await context.newPage();
  const assertNoBrowserErrors = watchPageErrors(page, 'Projects savings sort');

  try {
    const initialText = await openFrontendPage(page, `${fixture.config.frontendUrl}/projects`);
    assert(
      initialText.indexOf(state.controlArticle.title) < initialText.indexOf(state.sampleArticle.title),
      'Default newest-first sort should show the later control article before the earlier sample article',
    );

    const sortedText = await overviewTextAfter(page, async () => {
      await page.getByRole('button', { name: 'Höchstes Einsparpotenzial' }).click();
    });
    assert(
      sortedText.indexOf(state.sampleArticle.title) < sortedText.indexOf(state.controlArticle.title),
      'Savings sort must move the very-high-savings sample article before the high-savings control article',
    );
    assertNoBrowserErrors();
  } finally {
    await context.close();
  }
}

export async function runErfolgsprojekteArticlesFlow(
  runner: TestRunner,
  fixture: TestFixture,
  browser: Browser,
): Promise<void> {
  const runId = fixture.config.runId;
  const redaktionEmail = `automated-erfolgsredaktion-${runId}@stadt-land-klima.de`;
  const redaktionPassword = `AutomatedErfolgsRedaktion-${runId}-A1!`;
  const socialInstagram = 'https://www.instagram.com/stadt.land.klima';
  const socialLinkedin = 'https://www.linkedin.com/company/stadt-land-klima';
  const sampleTitle = `Automatisiertes Erfolgsprojekt ${runId}`;
  const sampleSlug = `automated-erfolgsprojekt-${runId}`;
  const controlTitle = `Automatisiertes Kontrollprojekt ${runId}`;
  const contributorTitle = `Automatisierter Beitrag ${runId}`;
  const unpublishedTitle = `Automatisierter Entwurf ${runId}`;
  const projectLink = `https://example.com/projects/${sampleSlug}`;

  let state: FlowState | null = null;

  await runner.step('Erfolgsprojekte: create editorial user and shared article fixtures', async () => {
    const { user, client } = await createAuthenticatedUser(
      fixture,
      'ErfolgsprojekteRedaktion',
      redaktionEmail,
      redaktionPassword,
    );
    assertEqual(roleName(user), 'ErfolgsprojekteRedaktion', 'Editorial user must have the ErfolgsprojekteRedaktion role');

    const measure = await firstCurrentMeasure(fixture);
    const sampleImage = await uploadTestImage(fixture, client, runId, 'project-image');
    const logoImage = await uploadTestImage(fixture, client, runId, 'organisation-logo');
    const sampleOrganisation = await createOrganisation(
      client,
      runId,
      `Automated Erfolgsprojekt Organisation ${runId}`,
      fileId(logoImage),
    );
    const controlOrganisation = await createOrganisation(
      client,
      runId,
      `Automated Kontroll Organisation ${runId}`,
      fileId(logoImage),
    );

    state = {
      redaktionClient: client,
      redaktionUser: user,
      sampleArticle: undefined as unknown as Article,
      controlArticle: undefined as unknown as Article,
      contributorArticle: undefined as unknown as Article,
      unpublishedArticle: undefined as unknown as Article,
      sampleOrganisation,
      controlOrganisation,
      measure,
      socialInstagram,
      socialLinkedin,
      projectLink,
    };

    const contributorImage = await uploadTestImage(fixture, fixture.localteamMember.client, runId, 'contributor-project-image');
    const contributorArticle = await createArticle(fixture.localteamMember.client, {
      title: contributorTitle,
      slug: `automated-contributor-project-${runId}`,
      author: `Automated LokalteamMitglied ${runId}`,
      municipality: fixture.municipalityName,
      state: 'Niedersachsen',
      sectors: ['Gebäude'],
      imageId: fileId(contributorImage),
      imageCredits: `Contributor Bildnachweis ${runId}`,
      articleText: `Contributor draft body ${runId}`,
      abstract: `Contributor draft abstract ${runId}`,
    });
    state.contributorArticle = contributorArticle;

    const persistedContributorArticle = await readArticle(fixture.admin, contributorArticle.id);
    assertEqual(persistedContributorArticle.status, 'draft', 'LokalteamMitglied-created article must start as draft');

    let publishRejected = false;
    try {
      await fixture.localteamMember.client.updateItem<Article>('articles', contributorArticle.id, { status: 'published' });
    } catch {
      publishRejected = true;
    }
    const afterPublishAttempt = await readArticle(fixture.admin, contributorArticle.id);
    assertEqual(afterPublishAttempt.status, 'draft', 'LokalteamMitglied must not be able to publish an article');
    assert(publishRejected || afterPublishAttempt.status === 'draft', 'Contributor publish attempt must be rejected or leave status unchanged');
  });

  await runner.step('Erfolgsprojekte: editorial role edits and publishes contributor content', async () => {
    assert(state, 'Shared article state was not initialised');
    const updated = await state.redaktionClient.updateItem<Article>('articles', state.contributorArticle.id, {
      title: `${contributorTitle} redaktionell geprüft`,
      status: 'published',
    });
    assertEqual(updated.status, 'published', 'ErfolgsprojekteRedaktion must be able to publish contributor-created articles');

    state.contributorArticle = await readArticle(fixture.admin, state.contributorArticle.id);
    assertEqual(state.contributorArticle.title, `${contributorTitle} redaktionell geprüft`, 'Editorial update must persist');
    assertEqual(state.contributorArticle.status, 'published', 'Editorial publish must persist');
  });

  await runner.step('Erfolgsprojekte: editorial role creates, edits, deletes, and publishes articles', async () => {
    assert(state, 'Shared article state was not initialised');

    const relatedArticle = await createArticle(state.redaktionClient, {
      title: `Automatisiertes verwandtes Projekt ${runId}`,
      slug: `automated-related-project-${runId}`,
      author: `Automated Redaktion ${runId}`,
      municipality: `Related Municipality ${runId}`,
      state: 'Brandenburg',
      sectors: ['Wärme'],
      imageId: fileId(await uploadTestImage(fixture, state.redaktionClient, runId, 'related-project-image')),
      imageCredits: `Related Bildnachweis ${runId}`,
      articleText: `Related article body ${runId}`,
      status: 'published',
    });
    const externalProject = await state.redaktionClient.createItem<{ id: number }>('external_projects', {
      title: `Automatisiertes externes Projekt ${runId}`,
      link: `https://example.com/external/${encodeURIComponent(runId)}`,
      description: `Externes Erfolgsprojekt ${runId}`,
    });

    const sampleArticle = await createArticle(state.redaktionClient, {
      title: `Entwurf ${sampleTitle}`,
      slug: sampleSlug,
      author: `Automated Redaktion ${runId}`,
      municipality: `Musterstadt ${runId}`,
      state: 'Bayern',
      sectors: ['Verkehr', 'Strom'],
      imageId: fileId(await uploadTestImage(fixture, state.redaktionClient, runId, 'sample-project-image')),
      organisationId: state.sampleOrganisation.id,
      status: 'draft',
      subtitle: `Geprüfter Untertitel ${runId}`,
      abstract: `**Kurzfassung ${runId}** für ein vollständig befülltes Erfolgsprojekt.`,
      articleText: [
        `# Detailabschnitt ${runId}`,
        '',
        `Das Projekt beschreibt eine automatisierte Umsetzung mit allen relevanten Anzeigefeldern.`,
        '',
        `Weitere Beschreibung ${runId}.`,
      ].join('\n'),
      imageCredits: `Bildnachweis ${runId}`,
      link: projectLink,
      instagram: socialInstagram,
      linkedin: socialLinkedin,
      canDoAutonomously: true,
      isProfitable: true,
      publicImpactEffects: ['role_model', 'increase_acceptance'],
      ghgSavingsLevel: 'very_high',
      additionalPrefix: `Vollständiges Erfolgsprojekt ${runId}`,
    });
    await state.redaktionClient.createItem('articles_measures', {
      articles_id: sampleArticle.id,
      measures_id: state.measure.id,
    });
    await state.redaktionClient.createItem('articles_external_projects', {
      articles_id: sampleArticle.id,
      external_projects_id: externalProject.id,
    });
    await state.redaktionClient.createItem('articles_articles', {
      articles_id: sampleArticle.id,
      related_articles_id: relatedArticle.id,
    });

    const publishedSample = await state.redaktionClient.updateItem<Article>('articles', sampleArticle.id, {
      title: sampleTitle,
      status: 'published',
    });
    state.sampleArticle = await readArticle(fixture.admin, publishedSample.id);

    await assertDirectusArticleValues(fixture, state.sampleArticle.id, state.measure, {
      title: sampleTitle,
      status: 'published',
      organisation: state.sampleOrganisation,
      imageId: fileId((state.sampleArticle.image as DirectusFile | null) ?? { id: '' }),
      sectors: ['Verkehr', 'Strom'],
      publicImpactEffects: ['role_model', 'increase_acceptance'],
      ghgSavingsLevel: 'very_high',
    });

    await sleep(1_100);
    state.controlArticle = await createArticle(state.redaktionClient, {
      title: controlTitle,
      slug: `automated-control-project-${runId}`,
      author: `Automated Redaktion ${runId}`,
      municipality: `Kontrollstadt ${runId}`,
      state: 'Sachsen',
      sectors: ['Gebäude'],
      imageId: fileId(await uploadTestImage(fixture, state.redaktionClient, runId, 'control-project-image')),
      organisationId: state.controlOrganisation.id,
      status: 'published',
      imageCredits: `Kontrollbild ${runId}`,
      articleText: `Kontrollprojekt Text ${runId}`,
      abstract: `Kontrollprojekt Kurzfassung ${runId}`,
      canDoAutonomously: false,
      isProfitable: false,
      publicImpactEffects: [],
      ghgSavingsLevel: 'high',
    });

    state.unpublishedArticle = await createArticle(state.redaktionClient, {
      title: unpublishedTitle,
      slug: `automated-unpublished-project-${runId}`,
      author: `Automated Redaktion ${runId}`,
      municipality: `Entwurfsstadt ${runId}`,
      state: 'Hamburg',
      sectors: ['Sonstiges'],
      imageId: fileId(await uploadTestImage(fixture, state.redaktionClient, runId, 'unpublished-project-image')),
      status: 'draft',
      imageCredits: `Entwurfsbild ${runId}`,
      articleText: `Unpublished draft body ${runId}`,
    });

    const deleteArticle = await createArticle(state.redaktionClient, {
      title: `Automatisiertes Löschprojekt ${runId}`,
      slug: `automated-delete-project-${runId}`,
      author: `Automated Redaktion ${runId}`,
      municipality: `Löschstadt ${runId}`,
      state: 'Bremen',
      sectors: ['Sonstiges'],
      imageId: fileId(await uploadTestImage(fixture, state.redaktionClient, runId, 'delete-project-image')),
      status: 'published',
      imageCredits: `Löschbild ${runId}`,
      articleText: `Delete article body ${runId}`,
    });
    const editedDeleteArticle = await state.redaktionClient.updateItem<Article>('articles', deleteArticle.id, {
      title: `Automatisiertes Löschprojekt bearbeitet ${runId}`,
    });
    assertEqual(editedDeleteArticle.title, `Automatisiertes Löschprojekt bearbeitet ${runId}`, 'Editorial role must edit published articles');
    await state.redaktionClient.deleteItem('articles', deleteArticle.id);
    await expectArticleAbsent(fixture.admin, deleteArticle.id, 'Editorial role must delete published articles');
  });

  await runner.step('Erfolgsprojekte: article detail page renders the full published article on desktop and mobile', async () => {
    assert(state, 'Shared article state was not initialised');
    await assertArticleDetailPage(
      browser,
      fixture,
      state,
      'Desktop project detail',
      { viewport: { width: 1440, height: 1000 } },
    );
    await assertArticleDetailPage(
      browser,
      fixture,
      state,
      'Mobile project detail',
      { viewport: { width: 390, height: 900 } },
    );
  });

  await runner.step('Erfolgsprojekte: projects overview shows published articles and excludes drafts', async () => {
    assert(state, 'Shared article state was not initialised');
    await assertProjectOverviewVisibility(browser, fixture, state);
  });

  await runner.step('Erfolgsprojekte: projects overview filters and savings sort work', async () => {
    assert(state, 'Shared article state was not initialised');
    const currentState = state;
    await assertFilterShowsOnlySample(browser, fixture, currentState, 'Projects state filter', async (page) => {
      await page.getByRole('button', { name: 'Alle Bundesländer' }).click();
      await page.getByRole('button', { name: 'Bayern' }).click();
    });
    await assertFilterShowsOnlySample(browser, fixture, currentState, 'Projects sector filter', async (page) => {
      await page.getByRole('button', { name: 'Alle Sektoren' }).click();
      await page.getByRole('button', { name: 'Verkehr' }).click();
    });
    await assertFilterShowsOnlySample(browser, fixture, currentState, 'Projects organisation filter', async (page) => {
      await page.getByRole('button', { name: 'Alle Organisationen' }).click();
      await page.getByRole('button', { name: currentState.sampleOrganisation.name }).click();
    });
    await assertFilterShowsOnlySample(browser, fixture, currentState, 'Projects autonomous filter', async (page) => {
      await page.getByRole('button', { name: 'Eigenständig umsetzbar' }).click();
    });
    await assertFilterShowsOnlySample(browser, fixture, currentState, 'Projects profitable filter', async (page) => {
      await page.getByRole('button', { name: 'Maßnahme amortisiert sich' }).click();
    });
    await assertFilterShowsOnlySample(browser, fixture, currentState, 'Projects role-model filter', async (page) => {
      await page.getByRole('button', { name: 'Vorbildwirkung' }).click();
    });
    await assertFilterShowsOnlySample(browser, fixture, currentState, 'Projects acceptance filter', async (page) => {
      await page.getByRole('button', { name: 'Akzeptanzfördernd' }).click();
    });
    await assertMunicipalityQueryFilter(browser, fixture, currentState);
    await assertSavingsSort(browser, fixture, currentState);
  });

  await runner.step('Erfolgsprojekte: editorial collection is visible in the Directus app', async () => {
    const currentState = state;
    assert(currentState, 'Shared article state was not initialised');
    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        redaktionEmail,
        redaktionPassword,
      );
      await page.goto(`${fixture.config.backendUrl}/admin/content/articles`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.getByText(currentState.sampleArticle.title).waitFor({ state: 'visible', timeout: 30_000 });
      const text = await visibleText(page);
      assertIncludes(text, currentState.sampleArticle.title, 'Directus app must show the published editorial article');
      assertIncludes(text, currentState.unpublishedArticle.title, 'Directus app must show draft articles to Redaktion');
    } finally {
      await context.close();
    }
  });
}
