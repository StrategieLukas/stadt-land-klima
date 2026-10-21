import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Page, Response as BrowserResponse } from 'playwright';
import { assert } from './assert.js';
import { parseEnvFile, type TestConfig } from './config.js';

export interface HiddenValue { label: string; value: string }

export function assertNoDisclosure(body: unknown, hidden: HiddenValue[], context: string): void {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const decoded = text.replace(/\\u([\da-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  for (const { label, value } of hidden) {
    assert(value.length >= 8, `Disclosure marker ${label} must be distinctive`);
    const representations = [value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value), Buffer.from(value).toString('base64')];
    assert(!representations.some(marker => text.includes(marker) || decoded.includes(marker)),
      `${context}: forbidden value detected (${label}; value redacted)`);
  }
}

export function assertNoCredentialFields(value: unknown, context: string): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!['access_token', 'preview_token', 'token', 'password', 'refresh_token', 'secret', 'internal_comment', 'submitter_email'].includes(key),
      `${context}: forbidden response field ${key}`);
    assertNoCredentialFields(child, context);
  }
}

export function configuredSecrets(config: TestConfig): HiddenValue[] {
  const frontendEnv = process.env.TEST_FRONTEND_ENV_FILE
    || resolve(dirname(config.envPath), '../frontend/.env');
  const env = { ...config.env, ...(existsSync(frontendEnv) ? parseEnvFile(frontendEnv) : {}), ...process.env };
  const names = [
    'CLI_DIRECTUS_STATIC_TOKEN', 'DIRECTUS_ADMIN_TOKEN',
    'DIRECTUS_FRONTEND_SERVER_TOKEN', 'DIRECTUS_FRONTEND_PUBLIC_TOKEN',
    'DIRECTUS_PREVIEW_TOKEN', 'NUXT_DIRECTUS_PREVIEW_TOKEN',
    'NUXT_DIRECTUS_FRONTEND_SERVER_TOKEN', 'NUXT_DIRECTUS_ADMIN_TOKEN',
    'ALTCHA_SECRET', 'MEILISEARCH_MASTER_KEY', 'MEILI_MASTER_KEY',
    'LISTMONK_API_TOKEN', 'STADTLANDZAHL_BASE_HTTP_BASIC_AUTH_PASSWORD',
  ];
  return names.flatMap(label => {
    const value = env[label];
    return typeof value === 'string' && value.length >= 8 ? [{ label, value }] : [];
  });
}

// Capture the original HTTP bodies, not only the DOM or page-visible text.
export function captureBrowserBodies(page: Page, hidden: HiddenValue[]) {
  const pending: Promise<void>[] = [];
  const failures: string[] = [];
  let bodies = 0;
  const listener = (response: BrowserResponse) => {
    if (!['document', 'fetch', 'xhr', 'script'].includes(response.request().resourceType())) return;
    if (response.status() >= 300 && response.status() < 400 || response.status() === 204) return;
    const type = response.headers()['content-type'] || '';
    if (!/text|json|javascript/.test(type)) return;
    pending.push((async () => {
      try {
        const body = await response.text().catch(() => null);
        if (body !== null) {
          bodies++;
          assertNoDisclosure(body, hidden, `Browser ${response.request().resourceType()} response`);
        }
        assertNoDisclosure(response.headers(), hidden, 'Browser response headers');
      } catch (error) {
        if (error instanceof Error && error.name === 'TestFailure') {
          failures.push(error.message);
        }
        // Non-disclosure errors (empty body, network issues) are ignored
      }
    })());
  };
  page.on('response', listener);
  return async () => {
    await page.waitForLoadState('networkidle');
    page.off('response', listener);
    await Promise.all(pending);
    assert(bodies > 0, 'Disclosure check must inspect actual browser responses');
    assert(failures.length === 0, failures.join('; '));
    return bodies;
  };
}
