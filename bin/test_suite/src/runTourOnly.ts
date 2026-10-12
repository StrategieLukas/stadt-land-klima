import { loadConfig } from './lib/config.js';
import { DirectusClient } from './lib/directus.js';
import { TestFixture } from './lib/fixture.js';
import { TestRunner } from './lib/runner.js';
import { launchBrowser } from './lib/browser.js';
import { runTourSeriesFlow } from './flows/tourSeriesFlow.js';
const config=loadConfig(process.argv.slice(2));
const admin=new DirectusClient(config.backendUrl,process.env.SLK_TOUR_TEST_ADMIN_TOKEN);
if(!process.env.SLK_TOUR_TEST_ADMIN_TOKEN)await admin.login(config.env.ADMIN_EMAIL,config.env.ADMIN_PASSWORD);
const fixture=new TestFixture(config,admin);
const runner=new TestRunner();
const browser=await launchBrowser(config.headless);
try {await runTourSeriesFlow(runner,fixture,browser);}catch(error){console.error((error as Error).message);process.exitCode=1;}finally{await browser.close();runner.printSummary();}
