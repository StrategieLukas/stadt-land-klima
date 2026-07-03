import type { Browser } from 'playwright';
import { assert, assertEqual, assertIncludes, assertNotIncludes } from '../lib/assert.js';
import {
  gotoDirectusContent,
  loginDirectus,
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
  status: string;
  role: string | { id: string; name?: string };
}

interface Editor {
  id: string;
  email: string;
  organisation?: string | null;
  localteam_id: string | { id: string; name?: string };
}

interface LocalteamUserJunction {
  id: string;
  directus_users_id: string;
  localteam_id: string;
}

function roleName(user: DirectusUser): string | undefined {
  return typeof user.role === 'object' ? user.role.name : undefined;
}

function relationId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'object' ? value.id : value;
}

async function readInvitedUser(admin: DirectusClient, email: string): Promise<DirectusUser | undefined> {
  const users = await admin.readUsers<DirectusUser>({
    filter: { email: { _eq: email } },
    fields: ['id', 'email', 'status', 'role.name'],
    limit: 1,
  });
  return users[0];
}

export async function runAddUserFlow(
  runner: TestRunner,
  fixture: TestFixture,
  browser: Browser,
): Promise<void> {
  let hiddenLocalteamId: string | null = null;
  const hiddenMunicipalityName = `Hidden Municipality ${fixture.config.runId}`;

  await runner.step('Add user: backend app shows only the permitted localteam', async () => {
    const hiddenLocalteam = await fixture.admin.createItem<{ id: string }>('localteams', {
      name: `AutomatedHidden ${fixture.config.runId}`,
      municipality_name: hiddenMunicipalityName,
      slug: `automated-hidden-${fixture.config.runId}`,
      status: 'published',
    });
    hiddenLocalteamId = hiddenLocalteam.id;

    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        fixture.localteamAdmin.email,
        fixture.localteamAdmin.password,
      );
      await gotoDirectusContent(page, fixture.config.backendUrl, 'localteams');
      await page.getByText(fixture.municipalityName).waitFor({ state: 'visible', timeout: 20_000 });
      const text = await visibleText(page);
      assertIncludes(text, fixture.municipalityName, 'LokalteamAdmin must see their assigned localteam in Directus');
      assertNotIncludes(
        text,
        hiddenMunicipalityName,
        'LokalteamAdmin must not see unassigned localteams in Directus',
      );

      const visibleLocalteams = await fixture.localteamAdmin.client.readItems<{ id: string; name: string }>(
        'localteams',
        {
          fields: ['id', 'name'],
          limit: -1,
        },
      );
      assertEqual(visibleLocalteams.length, 1, 'User API visibility must be restricted to one localteam');
      assertEqual(visibleLocalteams[0]?.id, fixture.localteam.id, 'Visible localteam must be the assigned one');
    } finally {
      await context.close();
    }
  });

  await runner.step('Add user: editor create screen exposes the required visible fields', async () => {
    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        fixture.localteamAdmin.email,
        fixture.localteamAdmin.password,
      );
      const text = await gotoDirectusContent(page, fixture.config.backendUrl, 'editors', '+');
      assertIncludes(text, 'Erstelle Teammitglied', 'Editor create page must render in Directus');
      assertIncludes(text, 'Email', 'Editor create page must expose the email field');
      assertIncludes(text, 'Lokalteam', 'Editor create page must expose the localteam field');
      assertIncludes(text, 'Organisation', 'Editor create page must expose the organisation field');
      assertIncludes(text, 'Element auswählen', 'Localteam field must be selectable in the Directus app');
    } finally {
      await context.close();
    }
  });

  await runner.step('Add user: creating an editor triggers invited user creation and localteam assignment', async () => {
    assert(hiddenLocalteamId, 'Hidden localteam setup did not run');

    const editor = await fixture.localteamAdmin.client.createItem<Editor>('editors', {
      email: fixture.invitedEmail,
      localteam_id: fixture.localteam.id,
      organisation: `Automated Organisation ${fixture.config.runId}`,
    });
    assertEqual(editor.email, fixture.invitedEmail, 'Created editor must keep the invited email');
    assertEqual(relationId(editor.localteam_id), fixture.localteam.id, 'Created editor must target the assigned localteam');

    const invitedUser = await waitFor(
      'invited Directus user created by editor flow',
      async () => {
        const user = await readInvitedUser(fixture.admin, fixture.invitedEmail);
        return user ?? false;
      },
      { timeoutMs: 30_000 },
    );

    assertEqual(invitedUser.status, 'invited', 'Editor flow must create an invited Directus user');
    assertEqual(roleName(invitedUser), 'LokalteamMitglied', 'Editor flow must assign LokalteamMitglied role');

    const junctions = await fixture.admin.readItems<LocalteamUserJunction>(
      'junction_directus_users_localteams',
      {
        filter: {
          directus_users_id: { _eq: invitedUser.id },
          localteam_id: { _eq: fixture.localteam.id },
        },
        fields: ['id', 'directus_users_id', 'localteam_id'],
        limit: -1,
      },
    );
    assertEqual(junctions.length, 1, 'Invited user must be linked to the invited localteam exactly once');

    const visibleEditors = await fixture.localteamAdmin.client.readItems<Editor>('editors', {
      filter: { email: { _eq: fixture.invitedEmail } },
      fields: ['id', 'email', 'localteam_id'],
      limit: 1,
    });
    assertEqual(visibleEditors.length, 1, 'Inviting user must see the new editor record');
  });

  await runner.step('Add user: editor record is visible in the Directus app', async () => {
    const context = await newContext(browser);
    const page = await context.newPage();
    try {
      await loginDirectus(
        page,
        fixture.config.backendUrl,
        fixture.localteamAdmin.email,
        fixture.localteamAdmin.password,
      );
      await gotoDirectusContent(page, fixture.config.backendUrl, 'editors');
      await page.getByText(fixture.invitedEmail).waitFor({ state: 'visible', timeout: 20_000 });
      const text = await visibleText(page);
      assertIncludes(text, fixture.invitedEmail, 'Editors list must show the invited email');
      assertNotIncludes(
        text,
        hiddenMunicipalityName,
        'Editors list must not expose unrelated localteams',
      );
    } finally {
      await context.close();
    }
  });

  runner.addManualCheck(
    'add_user_flows',
    `Verify an invitation email to ${fixture.invitedEmail} with subject "Willkommen bei Stadt.Land.Klima!" and an accept-invite link for the Directus backend ${fixture.config.backendUrl}.`,
  );
}
