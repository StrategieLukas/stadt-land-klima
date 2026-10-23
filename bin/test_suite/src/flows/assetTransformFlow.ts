import {readFile} from 'node:fs/promises';
import {assert} from '../lib/assert.js';
import type {TestFixture} from '../lib/fixture.js';
import type {TestRunner} from '../lib/runner.js';

export async function runAssetTransformFlow(runner: TestRunner, fixture: TestFixture) {
  await runner.step('Assets: normal uncached transform burst works and oversized output is refused', async () => {
    const token = await fixture.admin.login(fixture.config.env.ADMIN_EMAIL!, fixture.config.env.ADMIN_PASSWORD!);
    const file = await fixture.admin.uploadFile<{id: string}>(`asset-limits-${fixture.config.runId}.png`, 'image/png', await readFile(new URL('../fixtures/tour-portrait.png', import.meta.url)), 'Disposable transform fixture');
    try {
      const base = fixture.config.backendUrl + '/assets/' + file.id;
      const headers = {Authorization: `Bearer ${token}`};
      const results = await Promise.all(Array.from({length: 8}, async (_, index) => {
        const response = await fetch(base + `?width=${240 + index}&height=160&fit=cover`, {headers});
        const bytes = await response.arrayBuffer();
        return {status: response.status, image: response.headers.get('content-type')?.startsWith('image/'), bytes: bytes.byteLength};
      }));
      assert(results.every(result => result.status === 200 && result.image && result.bytes > 0), 'Normal image bursts must not fail: ' + JSON.stringify(results));
      // 4097×1 is harmless even on an unpatched server; never probe giant rasters.
      const oversized = await fetch(base + '?width=4097&height=1', {headers});
      await oversized.arrayBuffer();
      assert(oversized.status === 400, 'The pinned-runtime guard rejects output dimensions above 4096');
    } finally {await fixture.admin.request('DELETE', '/files/' + file.id);}
  });
}
