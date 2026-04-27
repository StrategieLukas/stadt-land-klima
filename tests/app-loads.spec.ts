import { test, expect } from '@playwright/test';

test.describe('Basic Application Checks', () => {
    test('The frontend loads successfully', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState();
        await expect(page).toHaveURL('/de-DE');
        await expect(page).toHaveTitle(/.*Stadt.Land.Klima!/);
        const nuxtRoot = page.locator('#nuxt-root');
        await expect(nuxtRoot).toBeVisible();
    });

    test('Directus API is reachable', async ({ request }) => {
        const response = await request.get('http://localhost:8081/server/ping');
        expect(response.ok()).toBeTruthy();
        const text = await response.text();
        expect(text).toBe('pong');
    });

});
