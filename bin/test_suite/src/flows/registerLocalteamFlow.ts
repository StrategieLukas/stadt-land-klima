import type { Browser, Page } from 'playwright';
import { assert, assertEqual, assertIncludes, assertNotIncludes } from '../lib/assert.js';
import {
  newContext,
  visibleText,
} from '../lib/browser.js';
import type { DirectusClient } from '../lib/directus.js';
import type { TestFixture } from '../lib/fixture.js';
import type { TestRunner } from '../lib/runner.js';
import { waitFor } from '../lib/wait.js';

interface DirectusUser {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  verified?: boolean | null;
  role?: string | { id: string; name?: string | null };
}

interface Localteam {
  id: string;
  name: string;
  municipality_name: string;
  admin_id?: string | { id: string } | null;
  status?: string | null;
  slug?: string | null;
}

interface Municipality {
  id: string;
  name: string;
  slug?: string | null;
  ars?: string | null;
  creator_verified?: boolean | null;
  preview_token?: string | null;
  localteam_id?: string | { id: string } | null;
}

interface LocalteamUserJunction {
  id: string;
  directus_users_id: string | { id: string };
  localteam_id: string | { id: string };
}

interface BrowserErrorCollector {
  assertNoErrors: () => void;
}

const REGISTER_PAGE_ERROR_PATTERNS = [
  /Es ist ein Fehler/i,
  /Fehler beim Laden/i,
  /Registration Failed/i,
  /Registrierung ist momentan nicht verfügbar/i,
  /CAPTCHA.*fehlgeschlagen/i,
  /Account konnte nicht erstellt/i,
  /Lokalteam konnte nicht angelegt/i,
  /access denied/i,
];

function relationId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'object' ? value.id : value;
}

function roleName(user: DirectusUser): string | undefined | null {
  return typeof user.role === 'object' ? user.role.name : undefined;
}

function validTestArs(runId: string, offset: number): string {
  let hash = offset;
  for (const char of runId) {
    hash = (hash * 31 + char.charCodeAt(0)) % 10_000_000_000;
  }
  return `16${String(hash).padStart(10, '0')}`;
}

function watchPageErrors(page: Page, label: string): BrowserErrorCollector {
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

  return {
    assertNoErrors: () => {
      assert(errors.length === 0, `${label} must not emit browser errors:\n${errors.join('\n')}`);
    },
  };
}

function assertNoVisibleErrorMessages(text: string, label: string): void {
  const match = REGISTER_PAGE_ERROR_PATTERNS.find((pattern) => pattern.test(text));
  assert(!match, `${label} must not show an error message matching ${String(match)}`);
}

async function openRegisterPage(page: Page, frontendUrl: string, ars?: string, name?: string): Promise<string> {
  const url = new URL('/register_localteam', frontendUrl);
  if (ars) url.searchParams.set('ars', ars);
  if (name) url.searchParams.set('name', name);

  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(750);
  return visibleText(page);
}

async function mockStadtlandzahlArea(page: Page, ars: string, name: string): Promise<void> {
  await page.route(
    (url) => url.pathname === `/api/areas/${ars}/` && url.searchParams.get('format') === 'json',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prefix: 'Gemeinde',
          name,
          ars,
          contained_by: [{ level: 2, name: 'Schleswig-Holstein' }],
          data_products: {
            population_data: {
              population: 12_345,
            },
          },
        }),
      });
    },
  );
}

async function solveAltcha(page: Page): Promise<void> {
  await page.locator('altcha-widget').waitFor({ state: 'attached', timeout: 20_000 });
  await page.waitForFunction(
    () => typeof (document.querySelector('altcha-widget') as any)?.verify === 'function',
    { timeout: 20_000 },
  );

  const result = await page.evaluate(async () => {
    const widget = document.querySelector('altcha-widget') as any;
    const verifyResult = await widget.verify();
    return {
      state: widget.getState?.(),
      hasPayload: Boolean(verifyResult?.payload),
    };
  });

  assert(result.hasPayload, `Altcha verification must return a payload. State: ${result.state ?? 'unknown'}`);
  await page.waitForFunction(
    () => (document.querySelector('altcha-widget') as any)?.getState?.() === 'verified',
    { timeout: 60_000 },
  );
}

async function readUserByEmail(admin: DirectusClient, email: string): Promise<DirectusUser | undefined> {
  const users = await admin.readUsers<DirectusUser>({
    filter: { email: { _eq: email } },
    fields: [
      'id',
      'email',
      'first_name',
      'last_name',
      'title',
      'description',
      'status',
      'verified',
      'role.name',
    ],
    limit: 1,
  });
  return users[0];
}

async function readLocalteamByName(admin: DirectusClient, name: string): Promise<Localteam | undefined> {
  const localteams = await admin.readItems<Localteam>('localteams', {
    filter: { name: { _eq: name } },
    fields: ['id', 'name', 'municipality_name', 'admin_id', 'status', 'slug'],
    limit: 1,
  });
  return localteams[0];
}

async function readMunicipalityByLocalteam(admin: DirectusClient, localteamId: string): Promise<Municipality | undefined> {
  const municipalities = await admin.readItems<Municipality>('municipalities', {
    filter: { localteam_id: { _eq: localteamId } },
    fields: [
      'id',
      'name',
      'slug',
      'ars',
      'creator_verified',
      'preview_token',
      'localteam_id',
    ],
    limit: 1,
  });
  return municipalities[0];
}

async function readLocalteamUserJunctions(
  admin: DirectusClient,
  userId: string,
  localteamId: string,
): Promise<LocalteamUserJunction[]> {
  return admin.readItems<LocalteamUserJunction>('junction_directus_users_localteams', {
    filter: {
      directus_users_id: { _eq: userId },
      localteam_id: { _eq: localteamId },
    },
    fields: ['id', 'directus_users_id', 'localteam_id'],
    limit: -1,
  });
}

async function createExistingLocalteamFixture(
  fixture: TestFixture,
  municipalityName: string,
  ars: string,
): Promise<{ localteam: Localteam; municipality: Municipality }> {
  const localteam = await fixture.admin.createItem<Localteam>('localteams', {
    name: `Automated Existing Lokalteam ${fixture.config.runId}`,
    municipality_name: municipalityName,
    slug: `automated-existing-localteam-${fixture.config.runId}`,
    status: 'published',
  });

  const generatedMunicipality = await waitFor(
    'municipality created for existing register_localteam scenario',
    async () => readMunicipalityByLocalteam(fixture.admin, localteam.id) ?? false,
    { timeoutMs: 45_000 },
  );

  await fixture.admin.updateItem<Municipality>('municipalities', generatedMunicipality.id, {
    ars,
  });

  const municipality = await waitFor(
    'frontend-readable existing localteam municipality',
    async () => {
      const rows = await fixture.admin.readItems<Municipality>('municipalities', {
        filter: {
          ars: { _eq: ars },
          localteam_id: { _nnull: true },
        },
        fields: ['id', 'slug', 'ars', 'localteam_id'],
        limit: 1,
      });
      return rows[0] ?? false;
    },
    { timeoutMs: 15_000 },
  );

  return { localteam, municipality };
}

export async function runRegisterLocalteamFlow(
  runner: TestRunner,
  fixture: TestFixture,
  browser: Browser,
): Promise<void> {
  const newArs = validTestArs(fixture.config.runId, 17);
  const existingArs = validTestArs(fixture.config.runId, 31);
  const newMunicipalityName = `Automated Register New ${fixture.config.runId}`;
  const existingMunicipalityName = `Automated Register Existing ${fixture.config.runId}`;
  const newUserEmail = `automated-register-new-${fixture.config.runId}@stadt-land-klima.de`;
  const newLocalteamName = `Stadt.Land.Klima! ${newMunicipalityName}`;
  let newUserId: string | null = null;
  let newLocalteamId: string | null = null;

  await runner.step('Register localteam: frontend page creates a new localteam request', async () => {
    const context = await newContext(browser);
    const page = await context.newPage();
    const browserErrors = watchPageErrors(page, 'Register new localteam page');

    try {
      await mockStadtlandzahlArea(page, newArs, newMunicipalityName);
      const initialText = await openRegisterPage(page, fixture.config.frontendUrl);
      assertIncludes(initialText, 'Lokalteam gründen', 'Register page must render the frontend entry point');
      assertIncludes(initialText, 'Gemeinde / Stadt suchen', 'Register page must expose municipality search');

      const text = await openRegisterPage(page, fixture.config.frontendUrl, newArs, newMunicipalityName);
      assertIncludes(text, newMunicipalityName, 'Register page must show the selected municipality from the frontend URL');
      assertIncludes(text, 'Deine Kontaktdaten', 'New municipality must show the registration form');
      assertNotIncludes(text, 'Lokalteam aktiv - Bewertung läuft', 'New municipality must not show the join-existing-team state');
      assertNoVisibleErrorMessages(text, 'Register new localteam page');

      await page.locator('#reg-firstname').fill('Automated');
      await page.locator('#reg-lastname').fill('Register');
      await page.locator('#reg-email').fill(newUserEmail);
      await page.locator('#reg-org').fill(`Automated Organisation ${fixture.config.runId}`);
      await solveAltcha(page);

      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/register-municipality')
          && response.request().method() === 'POST',
        { timeout: 60_000 },
      );
      await page.getByRole('button', { name: /Lokalteam beantragen/i }).click();
      const response = await responsePromise;
      assert(response.ok(), `Registration submit must succeed. Got HTTP ${response.status()}.`);

      await page.getByText('Durchstarten!').waitFor({ state: 'visible', timeout: 30_000 });
      const successText = await visibleText(page);
      assertIncludes(successText, 'Account erstellen', 'Success state must show the account creation step');
      assertIncludes(successText, 'Lokalteam anlegen', 'Success state must show the localteam creation step');
      assertIncludes(successText, 'Passwort-E-Mail versenden', 'Success state must show the password email step');
      assertIncludes(successText, 'Aktivierungs-E-Mail', 'Success state must explain the activation email');
      assertIncludes(successText, newUserEmail, 'Success state must mention the submitted email address');
      assertIncludes(successText, newMunicipalityName, 'Success state must mention the requested municipality');
      assertNoVisibleErrorMessages(successText, 'Register new localteam success state');
      browserErrors.assertNoErrors();
    } finally {
      await context.close();
    }

    const user = await waitFor(
      'Directus user created by register_localteam frontend submit',
      async () => readUserByEmail(fixture.admin, newUserEmail) ?? false,
      { timeoutMs: 45_000 },
    );
    newUserId = user.id;
    assertEqual(user.status, 'active', 'Register localteam must create an active Directus user');
    assertEqual(user.verified, false, 'Register localteam user must start unverified');
    assertEqual(roleName(user), 'LokalteamAdmin', 'Register localteam user must be a LokalteamAdmin');
    assertEqual(user.first_name, 'Automated', 'Register localteam user must keep the first name');
    assertEqual(user.last_name, 'Register', 'Register localteam user must keep the last name');
    assertEqual(user.title, `Automated Organisation ${fixture.config.runId}`, 'Register localteam user must keep the organisation');
    assertIncludes(user.description ?? '', newArs, 'Register localteam user description must contain the ARS');

    const localteam = await waitFor(
      'localteam created by register_localteam frontend submit',
      async () => readLocalteamByName(fixture.admin, newLocalteamName) ?? false,
      { timeoutMs: 45_000 },
    );
    newLocalteamId = localteam.id;
    assertEqual(localteam.municipality_name, newMunicipalityName, 'Created localteam must keep the municipality name');
    assertEqual(localteam.status, 'draft', 'Created localteam must start as draft');
    assertEqual(relationId(localteam.admin_id), user.id, 'Created localteam must assign the registering user as admin');

    const junctions = await readLocalteamUserJunctions(fixture.admin, user.id, localteam.id);
    assertEqual(junctions.length, 1, 'Register localteam must link the new admin user to the new localteam exactly once');

    const municipality = await waitFor(
      'municipality patched by register_localteam frontend submit',
      async () => {
        const row = await readMunicipalityByLocalteam(fixture.admin, localteam.id);
        return row?.ars === newArs ? row : false;
      },
      { timeoutMs: 45_000 },
    );
    assertEqual(municipality.name, newMunicipalityName, 'Created municipality must keep the selected name');
    assertEqual(municipality.creator_verified, false, 'Created municipality must start unverified');
    assertEqual(relationId(municipality.localteam_id), localteam.id, 'Created municipality must link to the new localteam');
    assert(municipality.preview_token, 'Created municipality must get a preview token');
  });

  await runner.step('Register localteam: frontend page offers contact flow for an existing localteam', async () => {
    const { municipality } = await createExistingLocalteamFixture(
      fixture,
      existingMunicipalityName,
      existingArs,
    );
    assert(municipality.slug, 'Existing localteam fixture municipality must have a slug');

    const context = await newContext(browser, { viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const browserErrors = watchPageErrors(page, 'Join existing localteam page');

    try {
      await mockStadtlandzahlArea(page, existingArs, existingMunicipalityName);
      const text = await openRegisterPage(page, fixture.config.frontendUrl, existingArs, existingMunicipalityName);
      await page.getByText('Lokalteam aktiv - Bewertung läuft').waitFor({ state: 'visible', timeout: 30_000 });
      const visible = await visibleText(page);
      assertIncludes(visible, existingMunicipalityName, 'Existing localteam page must show the selected municipality');
      assertIncludes(visible, 'Lokalteam aktiv - Bewertung läuft', 'Existing localteam page must show the in-progress localteam state');
      assertIncludes(visible, 'Kontakt aufnehmen', 'Existing localteam page must offer a contact action');
      assertNotIncludes(visible, 'Deine Kontaktdaten', 'Existing localteam page must not show the new-team registration form');
      assertNotIncludes(visible, 'Lokalteam beantragen', 'Existing localteam page must not show the submit button');
      assertNoVisibleErrorMessages(text, 'Join existing localteam initial page');
      assertNoVisibleErrorMessages(visible, 'Join existing localteam visible page');

      const contactHref = await page.getByRole('link', { name: /Kontakt aufnehmen/i }).first().getAttribute('href');
      assert(contactHref, 'Existing localteam contact action must be a link');
      assert(contactHref.startsWith('/contact?'), 'Existing localteam contact action must point to the frontend contact page');
      assertIncludes(decodeURIComponent(contactHref), existingMunicipalityName, 'Existing localteam contact link must include municipality context');
      browserErrors.assertNoErrors();
    } finally {
      await context.close();
    }
  });

  runner.addManualCheck(
    'register_localteam_flow',
    `Verify a welcome/activation email to ${newUserEmail} for the newly registered localteam ${newLocalteamName}.`,
  );

  assert(newUserId, 'Register new localteam scenario did not create a user id');
  assert(newLocalteamId, 'Register new localteam scenario did not create a localteam id');
}
