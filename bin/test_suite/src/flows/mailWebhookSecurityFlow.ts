import { assert, assertEqual } from '../lib/assert.js';
import { DirectusClient } from '../lib/directus.js';
import type { TestFixture } from '../lib/fixture.js';
import type { TestRunner } from '../lib/runner.js';
import { capturedMail } from '../lib/mail.js';

type Flow = {
  id: string;
  name: string;
  operation: string;
  options: { async?: boolean; error_on_reject?: boolean };
  operations: Array<{
    id: string;
    key: string;
    options: { template?: unknown };
  }>;
};
type Step = { operation: string; status: string };

async function runSteps(
  fixture: TestFixture,
  flow: Flow,
  marker: string,
): Promise<Step[]> {
  const revisions = await fixture.admin.request<
    Array<{
      data: {
        steps: Step[];
        data: { $trigger: { body: { securityProbe?: string } } };
      };
    }>
  >('GET', '/revisions', {
    query: {
      'filter[collection][_eq]': 'directus_flows',
      'filter[item][_eq]': flow.id,
      fields: 'data',
      sort: '-id',
      limit: 20,
    },
  });
  const revision = revisions.find(
    (item) => item.data?.data?.$trigger?.body?.securityProbe === marker,
  );
  assert(revision, 'Security probe must have a recorded flow run');
  return revision.data.steps;
}

export async function runMailWebhookSecurityFlow(
  runner: TestRunner,
  fixture: TestFixture,
): Promise<void> {
  const flows = await fixture.admin.request<Flow[]>('GET', '/flows', {
    query: {
      filter: JSON.stringify({
        name: { _in: ['notifyAdminNewLocalteam', 'sendWelcomeNewLocalteam'] },
      }),
      fields:
        'id,name,operation,options,operations.id,operations.key,operations.options',
      limit: -1,
    },
  });
  assertEqual(flows.length, 2, 'Both registration mail flows must exist');
  // Directus masks stored user tokens, even in administrator read responses.
  // Exercise the credential actually supplied to visitors by Nuxt instead.
  const homepage = await fetch(fixture.config.frontendUrl);
  assert(homepage.ok, 'Frontend configuration must be reachable');
  const match = (await homepage.text()).match(
    /"?directusToken"?\s*:\s*("(?:[^"\\]|\\.)*")/,
  );
  assert(
    match,
    'A browser Frontend credential is required to test its webhook boundary',
  );
  const frontendToken: string = JSON.parse(match[1]);
  assert(frontendToken, 'The browser Frontend credential must be nonempty');

  const callers = [
    ['anonymous', new DirectusClient(fixture.config.backendUrl)],
    ['Frontend', new DirectusClient(fixture.config.backendUrl, frontendToken)],
    ['LokalteamMitglied', fixture.localteamMember.client],
    ['LokalteamAdmin', fixture.localteamAdmin.client],
  ] as const;

  for (const flow of flows) {
    await runner.step(
      `Mail webhooks: ${flow.name} rejects public, Frontend and local-team callers before mail`,
      async () => {
        assert(
          flow.options.error_on_reject === true && flow.options.async === false,
          'Webhook must report synchronous failures',
        );
        for (const [name, client] of callers) {
          const marker = `${fixture.config.runId}-${flow.name}-${name}`;
          let rejected = false;
          try {
            await client.request('POST', `/flows/trigger/${flow.id}`, {
              body: {
                // Empty recipients also prevent delivery if the guard regresses.
                to: [],
                subject: marker,
                body: 'Security regression probe',
                securityProbe: marker,
                $accountability: {
                  admin: true,
                  user: fixture.localteamAdmin.id,
                },
              },
            });
          } catch (error) {
            rejected =
              error instanceof Error &&
              /failed with (400|403):/.test(error.message);
          }
          assert(rejected, `${name} must not invoke the mail flow`);
          const steps = await runSteps(fixture, flow, marker);
          assertEqual(
            steps.length,
            1,
            'Rejected requests must stop before the mail operation',
          );
          assertEqual(
            steps[0].operation,
            flow.operation,
            'The first operation must enforce authentication',
          );
          assertEqual(
            steps[0].status,
            'reject',
            'Forged body accountability must not pass the guard',
          );
        }
      },
    );

    await runner.step(
      `Mail webhooks: ${flow.name} accepts the server administrator and fixes the template`,
      async () => {
        const marker = `${fixture.config.runId}-${flow.name}-authorized`;
        const captureEnabled = Boolean(process.env.TEST_MAILPIT_URL);
        if (flow.name === 'sendWelcomeNewLocalteam') {
          const mail = flow.operations.find(
            (operation) => operation.key === 'send_welcome_email_op',
          );
          assertEqual(
            mail?.options.template,
            'email-template-welcome-new-localteam',
            'Caller-controlled template names must never reach the mail operation',
          );
        }
        try {
          await fixture.admin.request('POST', `/flows/trigger/${flow.id}`, {
            body: {
              to: captureEnabled ? 'webhook-security@example.invalid' : [],
              subject: marker,
              body: 'Authenticated notification regression check',
              securityProbe: marker,
              template: '../../untrusted-template',
              data: {
                firstName: 'Security test',
                municipalityName: marker,
                passwordResetUrl: 'https://example.invalid/reset?token=test',
                backendUrl: 'https://example.invalid',
                tutorialUrl: '',
                calendarUrl: '',
                signalUrl: '',
              },
            },
          });
        } catch (error) {
          // Without a test SMTP inbox, empty recipients intentionally prevent delivery.
          if (captureEnabled) throw error;
        }
        const steps = await runSteps(fixture, flow, marker);
        assertEqual(
          steps.length,
          2,
          'An administrator must reach the mail operation',
        );
        assertEqual(
          steps[0].status,
          'resolve',
          'Verified administrator accountability must pass',
        );
        if (captureEnabled) {
          assertEqual(
            steps[1].status,
            'resolve',
            'Mail must reach the test SMTP server',
          );
          const mail = await capturedMail(
            marker,
            'webhook-security@example.invalid',
          );
          assert(
            mail.HTML.includes(
              flow.name === 'sendWelcomeNewLocalteam'
                ? 'https://example.invalid/reset?token=test'
                : 'Authenticated notification regression check',
            ),
            'The intended template/body must be delivered',
          );
        }
      },
    );
  }
}
