import type { Browser } from 'playwright';
import { assert } from '../lib/assert.js';
import { newContext, waitForHydration, collectPublicPageErrors } from '../lib/browser.js';
import type { TestRunner } from '../lib/runner.js';

export async function runSharedStateFlow(runner: TestRunner, frontendUrl: string, browser: Browser): Promise<void> {
  await runner.step('Shared state: German, English and Italian SSR/hydration, theme persistence and search controls', async () => {
    await Promise.all(['de-DE', 'en-GB', 'it-IT'].map(async locale => {
      const context = await newContext(browser, { locale: locale === 'it-IT' ? 'en-GB' : locale, colorScheme: 'light' });
      try {
        // A saved preference must override the browser's language as well.
        if (locale === 'it-IT') await context.addCookies([{ name: 'slk_locale', value: locale, url: frontendUrl }]);
        const page = await context.newPage();
        const errors = collectPublicPageErrors(page);
        const response = await page.goto(`${frontendUrl}/tools`, { waitUntil: 'domcontentloaded' });
        if (!response) throw new Error(`${locale}: navigation returned no response`);
        assert(response.ok(), `${locale}: public SSR returns 200`);
        assert(new RegExp(`<html[^>]+lang=["']${locale}["']`).test(await response.text()), `${locale}: SSR language matches request`);
        await waitForHydration(page);
        const injected = await page.evaluate(() => {
          type Root = Element & { __vue_app__?: { config: { globalProperties: { $nuxt?: { $locale: string; $t: (key: string) => string; $directus?: unknown } } } } };
          const app = [...document.querySelectorAll<Root>('#nuxt-root, #__nuxt')].map(root => root.__vue_app__?.config.globalProperties.$nuxt).find(Boolean);
          return { locale: app?.$locale, translated: app?.$t('search.input_placeholder'), sdk: !!app?.$directus };
        });
        assert(injected.locale === locale, `${locale}: browser reuses SSR locale`);
        assert(injected.translated && injected.translated !== 'search.input_placeholder', `${locale}: translations are hydrated`);
        assert(!injected.sdk, `${locale}: public SDK is absent`);
        await page.locator('.settings-trigger:visible').first().click();
        const toggle = page.locator('.theme-toggle:visible').first();
        await toggle.click();
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'staedteChallengeDark');
        assert(await page.evaluate(() => localStorage.getItem('slk_theme_preference')) === 'dark', `${locale}: theme preference persists`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForHydration(page);
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'staedteChallengeDark');
        const input = page.locator('header input:visible').first();
        await input.click();
        await page.locator('[role="dialog"]:visible').waitFor();
        await page.keyboard.press('Escape');
        await page.locator('[role="dialog"]:visible').waitFor({ state: 'hidden' });
        assert(errors.length === 0, `${locale}: no public request, runtime or hydration errors: ${errors.join('; ')}`);
      } finally { await context.close(); }
    }));
  });
}
