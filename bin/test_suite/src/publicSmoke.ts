import { chromium } from 'playwright';
import { waitForHydration } from './lib/browser.js';
import { assert } from './lib/assert.js';

/** Anonymous public smoke: no CMS login, env file, fixtures, or write requests. */
const target = new URL(process.argv[2] ?? 'http://localhost:8080');
assert(['http:', 'https:'].includes(target.protocol) && !target.username && !target.password, 'Expected an HTTP(S) origin');
const base = target.origin;
const started = performance.now();
const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'de-DE', serviceWorkers: 'block' });
const failures: string[] = [];
let blockedWrites = 0;
await context.route('**/*', async route => {
  if (!['GET', 'HEAD'].includes(route.request().method())) {
    blockedWrites++;
    await route.abort();
  } else await route.continue();
});

try {
  // Bounded concurrency keeps a staging sanity check inexpensive.
  const paths = ['/', '/measures', '/map', '/stats', '/jobs', '/tools', '/organisation', '/news'];
  let index = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    const page = await context.newPage();
    let errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message.slice(0, 180)));
    page.on('console', message => {
      if (/hydration.*mismatch|mismatch.*hydration/i.test(message.text())) errors.push('Vue hydration mismatch');
    });
    page.on('response', response => {
      const request = response.request();
      const url = new URL(response.url());
      if (url.origin === base && ['fetch', 'xhr'].includes(request.resourceType()) && response.status() >= 400) {
        // Deliberately omit query strings, headers and response bodies.
        errors.push(`HTTP ${response.status()} ${url.pathname}`);
      }
    });
    while (index < paths.length) {
      const path = paths[index++]!;
      errors = [];
      try {
        const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        assert(response?.ok(), `${path}: HTTP ${response?.status()}`);
        await page.locator('h1,h2').first().waitFor({ timeout: 15_000 });
        await waitForHydration(page);
        // Data settling is bounded; do not wait for map tiles/analytics to go idle.
        await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 10_000 });
        if (path === '/measures') {
          await page.locator('a[href^="/measures/"]').first().waitFor({ timeout: 15_000 });
        }
        assert(!/^(500|404)\b/.test((await page.locator('h1,h2').first().innerText()).trim()), `${path}: error page rendered`);
        assert(errors.length === 0, `${path}: ${[...new Set(errors)].join('; ')}`);
        process.stdout.write(`[PASS] ${path}: HTTP ${response?.status()}, hydrated\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${path}: ${message}`);
        process.stdout.write(`[FAIL] ${path}: ${message}\n`);
      }
    }
    await page.close();
  }));
  process.stdout.write(`Public read-only smoke: ${paths.length - failures.length}/${paths.length} passed in ${((performance.now() - started) / 1000).toFixed(2)}s; ${blockedWrites} non-read requests blocked\n`);
  if (failures.length) process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
