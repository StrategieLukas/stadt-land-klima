import { launchBrowser } from './lib/browser.js';
import { loadConfig } from './lib/config.js';
import { createAdminClient } from './lib/directus.js';
import { TestFixture } from './lib/fixture.js';
import { TestRunner } from './lib/runner.js';
import { runTourSeriesFlow } from './flows/tourSeriesFlow.js';

async function main(): Promise<void> {
  const config = loadConfig(process.argv.slice(2));
  const runner = new TestRunner();
  const admin = await createAdminClient(config.backendUrl, config.env);
  const fixture = new TestFixture(config, admin);
  const browser = await launchBrowser(config.headless);
  try {
    await runner.step('Initialise disposable Directus fixture', () => fixture.setup());
    await runTourSeriesFlow(runner, fixture, browser);
  } catch (error) {
    process.exitCode = 1;
    console.error(error instanceof Error ? error.message : String(error));
  } finally {
    try {
      await runner.step('Cleanup disposable Directus fixture', () => fixture.cleanup());
    } finally {
      await browser.close();
      runner.printSummary();
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
