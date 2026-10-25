import { loadConfig } from "./lib/config.js";
import { createAdminClient } from "./lib/directus.js";
import { TestFixture } from "./lib/fixture.js";
import { TestRunner } from "./lib/runner.js";
import { launchBrowser } from "./lib/browser.js";
import { runMunicipalityDisclosureFlow } from "./flows/municipalityDisclosureFlow.js";

const config = loadConfig(process.argv.slice(2));
const runner = new TestRunner();
const fixture = new TestFixture(config, await createAdminClient(config.backendUrl, config.env));
const browser = await launchBrowser(config.headless);
try {
  await runner.step("Initialise disposable preview fixture", () => fixture.setup());
  await runMunicipalityDisclosureFlow(runner, fixture, browser);
} catch (error) {
  if (!runner.results.some((result) => result.status === "failed")) {
    try {
      await runner.step("Prepare preview security fixture data", async () => {
        throw error;
      });
    } catch {
      // Already recorded
    }
  }
  process.exitCode = 1;
} finally {
  try {
    await runner.step("Cleanup disposable preview fixture", () => fixture.cleanup());
  } catch {
    process.exitCode = 1;
  }
  await browser.close();
  runner.printSummary();
}
