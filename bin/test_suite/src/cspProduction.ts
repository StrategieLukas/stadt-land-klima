/** Explicit production-only nonce and browser compatibility gate. */
import assert from 'node:assert/strict';
import {launchBrowser, newContext, waitForHydration} from './lib/browser.js';
const origin = process.argv[2];
if (!origin) throw Error('Usage: cspProduction.ts https://localhost:8443');
const browser = await launchBrowser(true);
const context = await newContext(browser);
try {
  let previousNonce = '';
  for (const path of ['/', '/municipalities', '/measures', '/stats', '/projects', '/news', '/organisation', '/contact']) {
    const page = await context.newPage(); const failures: string[] = [];
    await page.addInitScript(() => {
      const state = window as Window & {__cspViolations?: string[]}; state.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', event => state.__cspViolations!.push(event.effectiveDirective + ':' + (/^(inline|eval)$/.test(event.blockedURI) ? event.blockedURI : 'external')));
    });
    page.on('pageerror', error => failures.push(error.message));
    const response = await page.goto(origin + path, {waitUntil: 'domcontentloaded'});
    assert.equal(response?.status(), 200, path);
    const policy = response?.headers()['content-security-policy'] || '';
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
    assert.ok(nonce && nonce !== previousNonce, 'Every HTML response needs a fresh nonce'); previousNonce = nonce;
    assert.match(policy, /script-src[^;]*'strict-dynamic'/); assert.doesNotMatch(policy.split('script-src ')[1]?.split(';')[0] || '', /unsafe-inline|unsafe-eval/);
    const html = await response!.text();
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map(match => /nonce="([^"]+)"/.exec(match[1]!)?.[1]);
    assert.ok(scripts.length && scripts.every(value => value === nonce), 'SSR scripts have the response nonce; trusted dynamic imports inherit strict-dynamic');
    await waitForHydration(page);
    // Lazy graph rendering must also work without Function/eval or injected styles.
    if (path === '/stats') {await page.locator('main').scrollIntoViewIfNeeded().catch(() => undefined); await page.waitForTimeout(500);}
    assert.deepEqual(failures, [], path + ' runtime errors');
    const violations = await page.evaluate(() => (window as Window & {__cspViolations?: string[]}).__cspViolations);
    assert.deepEqual(violations, [], path + ' CSP violations');
    if (path === '/') {
      // Inject after server rendering/nonce assignment, before browser parsing.
      // DevTools evaluation is privileged and cannot model attacker HTML.
      await page.route(origin + '/?slk_csp_probe=1', async route => {
        const response = await route.fetch();
        await route.fulfill({response, body: (await response.text()).replace('</body>', '<script>window.__unnoncedExecuted = true</script></body>')});
      });
      await page.goto(origin + '/?slk_csp_probe=1', {waitUntil: 'domcontentloaded'});
      await waitForHydration(page);
      assert.equal(await page.evaluate(() => (window as Window & {__unnoncedExecuted?: boolean}).__unnoncedExecuted), undefined, 'Parser-inserted unnonced inline script is blocked');
    }
    await page.close();
  }
  console.log('Production CSP: fresh nonces, hydration, eight public routes and unnonced-script rejection passed.');
} finally {await context.close(); await browser.close();}
