import {
  assert,
  assertEqual,
  assertIncludes,
  assertNotIncludes,
} from '../lib/assert.js';
import { DirectusClient } from '../lib/directus.js';
import type { TestFixture } from '../lib/fixture.js';
import type { TestRunner } from '../lib/runner.js';

interface Role {
  id: string;
  name: string;
}

interface DirectusUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  role: { name?: string } | string;
}

interface InviteResponse {
  mailSent: boolean;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    status: string;
  };
}

interface Dashboard {
  id: string;
  name: string;
}

function roleName(user: DirectusUser): string | undefined {
  return typeof user.role === 'object' ? user.role.name : undefined;
}

async function createRoleClient(
  fixture: TestFixture,
  roleNameToCreate: string,
  email: string,
  password: string,
): Promise<DirectusClient> {
  const role = fixture.roles.get(roleNameToCreate) as Role | undefined;
  assert(role, `Required role is missing: ${roleNameToCreate}`);

  await fixture.admin.createUser<DirectusUser>({
    email,
    password,
    role: role.id,
    status: 'active',
    first_name: 'Automated',
    last_name: roleNameToCreate,
  });

  const client = new DirectusClient(fixture.config.backendUrl);
  await client.login(email, password);
  return client;
}

export async function runErfolgsprojekteInviteDashboardFlow(
  runner: TestRunner,
  fixture: TestFixture,
): Promise<void> {
  const password = 'Test-Password-2026!';
  const planningEmail = `automated-planning-${fixture.config.runId}@stadt-land-klima.de`;
  const measuresEmail = `automated-measures-${fixture.config.runId}@stadt-land-klima.de`;
  const invitedEmail = `automated-editorial-invite-${fixture.config.runId}@stadt-land-klima.de`;
  let planningClient: DirectusClient;
  let measuresClient: DirectusClient;

  await runner.step(
    'Erfolgsprojekte dashboard: create restricted test users',
    async () => {
      planningClient = await createRoleClient(
        fixture,
        'Planungsteam',
        planningEmail,
        password,
      );
      measuresClient = await createRoleClient(
        fixture,
        'Maßnahmenteam',
        measuresEmail,
        password,
      );
    },
  );

  await runner.step(
    'Erfolgsprojekte dashboard: only planning team sees the invitation dashboard',
    async () => {
      const planningDashboards = await planningClient.request<Dashboard[]>(
        'GET',
        '/dashboards',
        {
          query: { fields: 'id,name', limit: -1 },
        },
      );
      const measuresDashboards = await measuresClient.request<Dashboard[]>(
        'GET',
        '/dashboards',
        {
          query: { fields: 'id,name', limit: -1 },
        },
      );
      const planningNames = planningDashboards
        .map((dashboard) => dashboard.name)
        .join(', ');
      const measuresNames = measuresDashboards
        .map((dashboard) => dashboard.name)
        .join(', ');

      assertIncludes(
        planningNames,
        'Erfolgsprojekte-Redaktion',
        'Planungsteam must see the invitation dashboard',
      );
      assertNotIncludes(
        measuresNames,
        'Erfolgsprojekte-Redaktion',
        'Maßnahmenteam must not see the invitation dashboard',
      );
      assertIncludes(
        measuresNames,
        'Maßnahmen',
        'Maßnahmenteam must retain its own dashboard',
      );
    },
  );

  await runner.step(
    'Erfolgsprojekte dashboard: unauthorized users cannot invite editors',
    async () => {
      let failure = '';
      try {
        await fixture.localteamAdmin.client.request(
          'POST',
          '/erfolgsprojekte-users/invite',
          {
            body: {
              email: invitedEmail,
              first_name: 'Erika',
              last_name: 'Redaktion',
            },
          },
        );
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      }

      assertIncludes(
        failure,
        '403',
        'Unauthorized invitation must return HTTP 403',
      );
    },
  );

  await runner.step(
    'Erfolgsprojekte dashboard: planning team invites an editorial user',
    async () => {
      const response = await planningClient.request<InviteResponse>(
        'POST',
        '/erfolgsprojekte-users/invite',
        {
          body: {
            email: invitedEmail,
            first_name: 'Erika',
            last_name: 'Redaktion',
          },
        },
      );

      assertEqual(
        response.user.email,
        invitedEmail,
        'Invitation response must preserve the email',
      );
      assertEqual(
        response.user.role,
        'ErfolgsprojekteRedaktion',
        'Invitation response must expose the assigned role',
      );
      assertEqual(
        response.user.status,
        'invited',
        'Invitation response must expose invited status',
      );

      const users = await fixture.admin.readUsers<DirectusUser>({
        filter: { email: { _eq: invitedEmail } },
        fields: [
          'id',
          'email',
          'first_name',
          'last_name',
          'status',
          'role.name',
        ],
        limit: 1,
      });
      const invitedUser = users[0];
      assert(invitedUser, 'Invited editorial user must exist');
      assertEqual(
        invitedUser.first_name,
        'Erika',
        'Invited user must retain the first name',
      );
      assertEqual(
        invitedUser.last_name,
        'Redaktion',
        'Invited user must retain the last name',
      );
      assertEqual(
        invitedUser.status,
        'invited',
        'Invited user must have invited status',
      );
      assertEqual(
        roleName(invitedUser),
        'ErfolgsprojekteRedaktion',
        'Invited user must receive the ErfolgsprojekteRedaktion role',
      );
    },
  );

  runner.addManualCheck(
    'erfolgsprojekte_invite_dashboard',
    `Verify an invitation email to ${invitedEmail} with subject "Einladung zur Erfolgsprojekte-Redaktion" and an accept-invite link for ${fixture.config.backendUrl}.`,
  );
}
