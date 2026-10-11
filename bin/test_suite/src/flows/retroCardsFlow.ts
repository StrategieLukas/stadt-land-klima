import { randomUUID } from 'node:crypto';
import type { Browser, Locator } from 'playwright';
import { assert } from '../lib/assert.js';
import { newContext } from '../lib/browser.js';
import type { TestFixture } from '../lib/fixture.js';
import type { TestRunner } from '../lib/runner.js';

async function checkFrame(card: Locator): Promise<void> {
  await card.first().waitFor();
  const before = await card.first().evaluate(el => {
    const style = getComputedStyle(el);
    return { border: style.borderTopWidth, borderColor: style.borderTopColor, radius: style.borderTopLeftRadius, shadow: style.boxShadow, transform: style.transform, background: style.backgroundColor };
  });
  assert(before.border === '3px' && before.radius === '0px', 'Card should have the shared square 3px frame');
  assert(before.borderColor === 'rgb(80, 80, 80)', 'Card border should remain dark gray in both themes');
  assert(before.shadow !== 'none', 'Card should retain its static offset shadow');
  await card.first().hover();
  const after = await card.first().evaluate(el => ({ shadow: getComputedStyle(el).boxShadow, transform: getComputedStyle(el).transform }));
  assert(after.shadow === before.shadow && after.transform === before.transform, 'Hover must preserve card position and shadow');
}

export async function runRetroCardsFlow(runner: TestRunner, fixture: TestFixture, browser: Browser): Promise<void> {
  const context = await newContext(browser, { reducedMotion: 'reduce' });
  const page = await context.newPage();
  const slug = `retro-cards-${fixture.config.runId}`;
  const blockIds: (string | number)[] = [];
  let cmsPage: { id: string } | undefined;
  try {
    await runner.step('Retro cards: editorial, data and election frames in both themes', async () => {
      for (const route of ['/news', '/data', '/elections/wahlcheck']) {
        await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
        await page.goto(`${fixture.config.frontendUrl}${route}`);
        await page.waitForLoadState('networkidle');
        const card = page.locator('.slk-retro-card');
        await checkFrame(card);
        const light = await card.first().evaluate(el => getComputedStyle(el).backgroundColor);
        await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
        await page.waitForFunction(color => {
          const card = document.querySelector('.slk-retro-card');
          return document.documentElement.dataset.theme === 'staedteChallengeDark' && card && getComputedStyle(card).backgroundColor !== color;
        }, light);
        await checkFrame(card);
        const dark = await card.first().evaluate(el => getComputedStyle(el).backgroundColor);
        assert(light !== dark, `${route} cards should adapt their background to the dark theme`);
      }
    });
    await runner.step('Retro cards: ranking colors survive the shared frame', async () => {
      await page.goto(`${fixture.config.frontendUrl}/municipalities`);
      const rating = page.locator('.slk-retro-card--semantic:visible').first();
      await checkFrame(rating);
      assert(await rating.evaluate(el => {
        const color = getComputedStyle(el).backgroundColor;
        el.classList.remove('slk-retro-card');
        const unchanged = getComputedStyle(el).backgroundColor === color;
        el.classList.add('slk-retro-card');
        return unchanged;
      }), 'Rating backgrounds must retain their score-specific colors');
    });
    await runner.step('Retro cards: boxed CMS layouts preserve editorial colors and plain containers', async () => {
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      cmsPage = await fixture.admin.createItem('pages', { name: slug, slug, status: 'published' });
      for (const [sort, options] of [{ border: 'thin', background: 'lime' }, { border: 'none', rounded: 'lg', shadow: 'lg' }, { border: 'none' }].entries()) {
        const block = await fixture.admin.createItem<{ id: string }>('blocks', {
          uuid: randomUUID(), bundle: 'container', entity_type: 'pages', entity_uuid: cmsPage!.id,
          field_name: 'content', status: 'published', sort_order: sort, props: { blocks: [] }, options,
        });
        blockIds.push(block.id);
      }
      await page.goto(`${fixture.config.frontendUrl}/${slug}`);
      await page.waitForLoadState('networkidle');
      const containers = page.locator('.blokkli-block-container');
      await checkFrame(containers.nth(0));
      await checkFrame(containers.nth(1));
      assert(await containers.nth(0).evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(175, 202, 11)', 'CMS brand green should remain intact');
      assert(!await containers.nth(2).evaluate(el => el.classList.contains('slk-retro-card')), 'Ordinary CMS layout containers must remain unboxed');
    });
  } finally {
    for (const id of blockIds) await fixture.admin.deleteItem('blocks', id);
    if (cmsPage) await fixture.admin.deleteItem('pages', cmsPage.id);
    await context.close();
  }
}
