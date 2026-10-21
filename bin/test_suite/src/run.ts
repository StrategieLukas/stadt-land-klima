import { launchBrowser } from './lib/browser.js';
import { loadConfig } from './lib/config.js';
import { createAdminClient } from './lib/directus.js';
import { TestFixture } from './lib/fixture.js';
import { TestRunner } from './lib/runner.js';
import { runAddUserFlow } from './flows/addUserFlow.js';
import { runRegisterLocalteamFlow } from './flows/registerLocalteamFlow.js';
import { runRatingWahlcheckFlow } from './flows/ratingWahlcheckFlow.js';
import { runRatingsImportExportFlow } from './flows/ratingsImportExportFlow.js';
import { runErfolgsprojekteArticlesFlow } from './flows/erfolgsprojekteArticlesFlow.js';
import { runErfolgsprojekteInviteDashboardFlow } from './flows/erfolgsprojekteInviteDashboardFlow.js';
import { runTourSeriesFlow } from './flows/tourSeriesFlow.js';
import { runDataAvailabilityFlow } from './flows/dataAvailabilityFlow.js';
import { runMailWebhookSecurityFlow } from './flows/mailWebhookSecurityFlow.js';
import { runContactSpamSecurityFlow } from './flows/contactSpamSecurityFlow.js';
import { runMunicipalityDisclosureFlow } from './flows/municipalityDisclosureFlow.js';

async function main(): Promise<void> {
  const config = loadConfig(process.argv.slice(2));
  const runner = new TestRunner();
  const admin = await createAdminClient(config.backendUrl, config.env);
  const fixture = new TestFixture(config, admin);
  const browser = await launchBrowser(config.headless);
  let exitCode = 0;

  process.stdout.write(`Test run: ${config.runId}\n`);
  process.stdout.write(`Backend: ${config.backendUrl}\n`);
  process.stdout.write(`Frontend: ${config.frontendUrl}\n`);

  try {
    await runner.step('Initialise disposable Directus fixture', async () => {
      await fixture.setup();
    });

    // Wrap each flow in try-catch so one failing flow doesn't skip subsequent flows
    try { await runMailWebhookSecurityFlow(runner, fixture); } catch (e) { runner.results.push({ name: 'Mail webhook security flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
    try { await runContactSpamSecurityFlow(runner, fixture); } catch (e) { runner.results.push({ name: 'Contact spam security flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
    try { await runAddUserFlow(runner, fixture, browser); } catch (e) { runner.results.push({ name: 'Add user flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
    try { await runErfolgsprojekteInviteDashboardFlow(runner, fixture); } catch (e) { runner.results.push({ name: 'Erfolgsprojekte invite dashboard flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
    try { await runRatingsImportExportFlow(runner, fixture); } catch (e) { runner.results.push({ name: 'Ratings import/export flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
    try { await runMunicipalityDisclosureFlow(runner, fixture, browser); } catch (e) { runner.results.push({ name: 'Municipality disclosure flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
    try { await runRatingWahlcheckFlow(runner, fixture, browser); } catch (e) { runner.results.push({ name: 'Rating wahlcheck flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
    try { await runRegisterLocalteamFlow(runner, fixture, browser); } catch (e) { runner.results.push({ name: 'Register localteam flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
    try { await runTourSeriesFlow(runner, fixture, browser); } catch (e) { runner.results.push({ name: 'Tour series flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
    try { await runDataAvailabilityFlow(runner, fixture, browser); } catch (e) { runner.results.push({ name: 'Data availability flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
    try { await runErfolgsprojekteArticlesFlow(runner, fixture, browser); } catch (e) { runner.results.push({ name: 'Erfolgsprojekte articles flow', status: 'failed', error: e instanceof Error ? e : new Error(String(e)) }); }
  } finally {
    // Set exit code based on any failed tests
    const hasFailures = runner.results.some((r) => r.status === 'failed');
    if (hasFailures) {
      exitCode = 1;
    }
    try {
      await runner.step('Cleanup disposable Directus fixture', async () => {
        await fixture.cleanup();
      });
    } catch {
      exitCode = 1;
    }
    await browser.close();
    runner.printSummary();
  }

  process.exitCode = exitCode;
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});
