import {type Browser} from '@playwright/test';
import {assert} from '../lib/assert.js';
import {newContext, loginWebsite, waitForHydration} from '../lib/browser.js';
import {type TestFixture} from '../lib/fixture.js';
import {type TestRunner} from '../lib/runner.js';

/** Real cookie, personal authorization and revocation coverage in the fast profile. */
export async function runEditorSessionFlow(runner: TestRunner, fixture: TestFixture, browser: Browser) {
  const context = await newContext(browser);
  const base = fixture.config.frontendUrl;
  const origin = new URL(base).origin;
  try {
    await runner.step('Editor sessions: HttpOnly login, personal reads, CSRF and restricted proxy routes', async () => {
      assert((await context.request.get(base + '/api/editor/session')).status() === 204, 'Anonymous restoration is empty');
      const user = fixture.localteamAdmin;
      await loginWebsite(context, base, user.email, user.password);
      const cookies = await context.cookies(base + '/api/editor');
      const cookie = cookies.find(cookie => cookie.name === 'slk-editor');
      assert(cookie?.httpOnly && cookie.sameSite === 'Strict', 'Editor cookie must be HttpOnly/SameSite Strict');
      if (origin.startsWith('https:')) assert(cookie.secure, 'Production editor cookie must be Secure');
      const restored = await context.request.get(base + '/api/editor/session');
      const body = await restored.json();
      assert(body.user.id === user.id && typeof body.csrf === 'string', 'Restored identity is the personal user');
      assert(!JSON.stringify(body).includes('access_token') && !JSON.stringify(body).includes('refresh_token'), 'Restore does not disclose JWTs');
      assert((await context.request.get(base + '/api/editor/cms/items/municipalities/' + fixture.municipality.id)).ok(), 'Personal read works');
      assert((await context.request.patch(base + '/api/editor/cms/items/municipalities/' + fixture.municipality.id, {data: {name: 'forged'}})).status() === 403, 'Mutation without CSRF is refused');
      assert((await context.request.get(base + '/api/editor/cms/users')).status() === 403, 'System collection proxy is refused');
      assert((await context.request.get(base + '/api/editor/cms/items/municipalities', {headers: {'x-slk-editor-user': 'other'}})).status() === 409, 'Stale tab cannot act as a different user');
      const page = await context.newPage();
      await page.addInitScript(() => localStorage.setItem('slk_auth', JSON.stringify({access_token: 'retired-token'})));
      await page.goto(base, {waitUntil: 'domcontentloaded'});
      await waitForHydration(page);
      await page.waitForFunction(() => localStorage.getItem('slk_auth') === null);
      assert(!await page.evaluate(() => document.cookie.includes('slk-editor')), 'Script cannot read the editor session cookie');
      await page.reload({waitUntil: 'domcontentloaded'});
      assert((await context.request.get(base + '/api/editor/session')).ok(), 'Cookie survives page reload');
      await page.close();
    });
    await runner.step('Editor sessions: foreign origin rejected, logout revokes captured cookie', async () => {
      const restored = await context.request.get(base + '/api/editor/session');
      const {csrf} = await restored.json();
      const headers = {Origin: origin, 'x-slk-editor': '1', 'x-csrf-token': csrf};
      assert((await context.request.post(base + '/api/editor/session/logout', {headers: {...headers, Origin: 'https://evil.example'}})).status() === 403, 'Foreign origin logout rejected');
      const cookie = (await context.cookies(base + '/api/editor')).find(cookie => cookie.name === 'slk-editor');
      assert(cookie, 'Captured cookie exists');
      assert((await context.request.post(base + '/api/editor/session/logout', {headers})).ok(), 'Logout succeeds');
      // A captured cookie cannot restore the deleted server-side credential record.
      const replay = await context.request.get(base + '/api/editor/session', {headers: {Cookie: `slk-editor=${cookie.value}`}});
      assert(replay.status() === 401, 'Revoked opaque session cannot be replayed');
    });
  } finally {await context.close();}
}
