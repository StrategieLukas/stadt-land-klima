import { launchBrowser } from './lib/browser.js';
import { loadConfig } from './lib/config.js';
import { createAdminClient } from './lib/directus.js';
import { TestFixture } from './lib/fixture.js';
import { TestRunner } from './lib/runner.js';
import { runAddUserFlow } from './flows/addUserFlow.js';
import { runRegisterLocalteamFlow } from './flows/registerLocalteamFlow.js';
import { runRatingWahlcheckFlow } from './flows/ratingWahlcheckFlow.js';
import { runErfolgsprojekteArticlesFlow } from './flows/erfolgsprojekteArticlesFlow.js';

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

    await runAddUserFlow(runner, fixture, browser);
    await runRatingWahlcheckFlow(runner, fixture, browser);
    await runRegisterLocalteamFlow(runner, fixture, browser);
    await runErfolgsprojekteArticlesFlow(runner, fixture, browser);
  } catch {
    exitCode = 1;
  } finally {
    await runner.step('Cleanup disposable Directus fixture', async () => {
      await fixture.cleanup();
    }).catch(() => {
      exitCode = 1;
    });
    await browser.close();
    runner.printSummary();
  }

  process.exitCode = exitCode;
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});
