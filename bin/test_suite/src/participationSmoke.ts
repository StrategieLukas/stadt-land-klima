import { launchBrowser } from "./lib/browser.js";
import { TestRunner } from "./lib/runner.js";
import { runParticipationFlow } from "./flows/participationFlow.js";
const base = new URL(process.argv[2] ?? "http://localhost:8080").origin;
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Participation UI checks require a local development frontend");
const browser = await launchBrowser(true);
const runner = new TestRunner();
try {
  await runParticipationFlow(runner, base, browser);
} finally {
  await browser.close();
  runner.printSummary();
}
