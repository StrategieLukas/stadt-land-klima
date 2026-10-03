import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { parseEnvFile } from './lib/config.js';
import { createAdminClient } from './lib/directus.js';

test('Blökkli edits survive preview, failed publish, successful publish and reload', { timeout: 120_000 }, async () => {
  const backend = 'http://localhost:8081';
  const frontend = 'http://localhost:8080';
  const env = parseEnvFile('../../src/directus/.env');
  const admin = await createAdminClient(backend, env);
  const token = await admin.login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  const user = await admin.request('GET', '/users/me');
  const fixtureName = `blokkli-regression-${randomUUID()}`;
  const entity = await admin.createItem<{ id: string; slug: string }>('pages', {
    name: fixtureName, slug: fixtureName, status: 'published',
  });
  const slug = entity.slug;
  const browser = await chromium.launch({ headless: true });
  try {
    await admin.createItem('blocks', {
      uuid: randomUUID(), bundle: 'heading', entity_type: 'pages',
      entity_uuid: entity.id, field_name: 'content', sort_order: 0,
      status: 'published', props: { text: 'Original regression heading' }, options: {},
    });
    const context = await browser.newContext();
    await context.addInitScript((auth) => {
      if (location.protocol === 'http:') localStorage.setItem('slk_auth', JSON.stringify(auth));
    }, { accessToken: token, user });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.error('Browser error:', error.message));
    await page.goto(`${frontend}/${slug}?blokkliEditing=${entity.id}`);
    // The development-only Vite dock overlaps blökkli's menu button.
    await page.addStyleTag({ content: 'vite-devtools-dock-embedded { display: none !important; }' });
    const heading = page.locator('.blokkli-block-heading');
    await expect(heading).toHaveText('Original regression heading');
    await page.route('**/items/edit_states/*', (route) => route.request().method() === 'PATCH'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated autosave failure' }) })
      : route.continue());
    await page.locator('[data-blokkli-editable-field="text"]').dblclick();
    const input = page.locator('.bk-editable-field [contenteditable]');
    await input.fill('Updated regression heading');
    await page.locator('.bk-editable-field button[type="submit"]').click();
    await expect(heading).toHaveText('Updated regression heading');
    await expect(page.locator('.bk-message.bk-is-error')).toContainText('Dein Entwurf konnte nicht auf dem Server gespeichert werden');
    await page.unroute('**/items/edit_states/*');
    await page.locator('.bk-message.bk-is-error .bk-message-content').click();
    const preview = await context.newPage();
    await preview.goto(`${frontend}/${slug}?blokkliPreview=${entity.id}`);
    await expect(preview.locator('.blokkli-block-heading')).toHaveText('Updated regression heading');

    // An already-open preview must discover edits from the editor tab.
    await page.locator('[data-blokkli-editable-field="text"]').dblclick();
    await input.fill('Final regression heading');
    await page.locator('.bk-editable-field button[type="submit"]').click();
    await expect(preview.locator('.blokkli-block-heading')).toHaveText('Final regression heading', { timeout: 15_000 });
    await preview.close();

    // A rejected publish must be visible and must leave both draft and live
    // content intact, so retrying does not silently lose the user's work.
    await page.route('**/blokkli-persistence/publish', (route) => route.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated publish failure' }),
    }));
    await page.locator('.bk-toolbar-menu-button').click();
    const publish = page.locator('#bk-menu-list-button-publish');
    await publish.click();
    await expect(page.locator('.bk-message.bk-is-error')).toBeVisible();
    const beforeRetry = await admin.readItems<{ props: { text: string } }>('blocks', {
      filter: { entity_uuid: { _eq: entity.id } },
    });
    assert.equal(beforeRetry[0].props.text, 'Original regression heading');
    await page.unroute('**/blokkli-persistence/publish');
    // Prove recovery uses the server draft as well as the browser backup.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('slk:blokkli-draft:')) localStorage.removeItem(key);
      }
    });
    await page.reload();
    await page.addStyleTag({ content: 'vite-devtools-dock-embedded { display: none !important; }' });
    await expect(heading).toHaveText('Final regression heading');
    await page.locator('.bk-toolbar-menu-button').click();
    await publish.click();
    await page.waitForURL(`${frontend}/${slug}`);
    await page.reload();
    const blocks = await admin.readItems<{ props: { text: string } }>('blocks', {
      filter: { entity_uuid: { _eq: entity.id }, status: { _neq: 'archived' } },
    });
    assert.equal(blocks[0].props.text, 'Final regression heading');
    const html = await (await fetch(`${frontend}/${slug}`)).text();
    assert.match(html, /<h2[^>]*blokkli-block-heading[^>]*><span[^>]*>Final regression heading<\/span><\/h2>/);
    await expect(heading).toHaveText('Final regression heading');
  } finally {
    await browser.close();
    for (const collection of ['edit_states', 'blocks']) {
      const records = await admin.readItems<{ id: number }>(collection, {
        filter: { entity_uuid: { _eq: entity.id } }, limit: -1,
      });
      for (const record of records) await admin.deleteItem(collection, record.id);
    }
    await admin.deleteItem('pages', entity.id);
  }
});
