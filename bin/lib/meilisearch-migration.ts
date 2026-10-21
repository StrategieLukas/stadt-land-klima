import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

type Index = { uid: string; primaryKey: string | null };
type Manifest = { indexes: (Index & { count: number; settings: Record<string, unknown> })[]; keys: unknown[] };
const key = process.env.MEILI_MASTER_KEY || process.env.MEILISEARCH_MASTER_KEY;
if (!key) throw new Error('The existing Meilisearch master key must be configured');
const deadline = Date.now() + Number(process.env.CORE_UPGRADE_TIMEOUT_SECONDS || 3600) * 1000;
const delay = () => new Promise(resolve => setTimeout(resolve, 1000));

async function request(path: string, method = 'GET'): Promise<any> {
  const response = await fetch(`http://127.0.0.1:7700${path}`, {
    method, headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Meilisearch ${method} ${path}: HTTP ${response.status}`);
  return response.json();
}

async function waitForIdle(): Promise<void> {
  while (Date.now() < deadline) {
    const tasks = await request('/tasks?statuses=enqueued,processing&limit=1');
    if (tasks.results.length === 0) return;
    await delay();
  }
  throw new Error('Timed out waiting for pending Meilisearch tasks');
}

async function manifest(): Promise<Manifest> {
  const indexes: Manifest['indexes'] = [];
  let offset = 0;
  while (true) {
    const page = await request(`/indexes?limit=100&offset=${offset}`);
    for (const index of page.results as Index[]) {
      const stats = await request(`/indexes/${encodeURIComponent(index.uid)}/stats`);
      indexes.push({ uid: index.uid, primaryKey: index.primaryKey, count: stats.numberOfDocuments,
        settings: await request(`/indexes/${encodeURIComponent(index.uid)}/settings`) });
    }
    offset += page.results.length;
    if (offset >= page.total || page.results.length === 0) break;
  }
  const keys: any[] = [];
  offset = 0;
  while (true) {
    const page = await request(`/keys?limit=100&offset=${offset}`);
    for (const item of page.results) keys.push({ uid: item.uid, actions: item.actions, indexes: item.indexes, expiresAt: item.expiresAt });
    offset += page.results.length;
    if (offset >= page.total || page.results.length === 0) break;
  }
  indexes.sort((a, b) => a.uid.localeCompare(b.uid));
  keys.sort((a, b) => a.uid.localeCompare(b.uid));
  return { indexes, keys };
}

function compareSettings(actual: unknown, expected: unknown, path: string): void {
  // New releases add nested defaults. Preserve every old setting, while
  // allowing the server's new default fields to exist alongside them.
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    assert.ok(actual !== null && typeof actual === 'object' && !Array.isArray(actual), path);
    for (const [name, value] of Object.entries(expected)) {
      compareSettings((actual as Record<string, unknown>)[name], value, `${path}.${name}`);
    }
  } else assert.deepEqual(actual, expected, `Search setting changed: ${path}`);
}

if (process.argv[2] === 'export') {
  await waitForIdle();
  const before = await manifest();
  await writeFile('/backup/meilisearch-manifest.json', JSON.stringify(before, null, 2), { mode: 0o600 });
  const task = await request('/dumps', 'POST');
  while (Date.now() < deadline) {
    const state = await request(`/tasks/${task.taskUid}`);
    if (state.status === 'failed' || state.status === 'canceled') throw new Error('Meilisearch dump failed; old data remains untouched');
    if (state.status === 'succeeded') {
      const filename = `${state.details.dumpUid}.dump`;
      assert.match(filename, /^[A-Za-z0-9_-]+\.dump$/);
      await writeFile('/backup/meilisearch-dump-filename', filename, { mode: 0o600 });
      console.log(`Exported ${before.indexes.length} search indexes`);
      break;
    }
    await delay();
  }
  await readFile('/backup/meilisearch-dump-filename');
} else if (process.argv[2] === 'validate') {
  await waitForIdle();
  const before: Manifest = JSON.parse(await readFile('/backup/meilisearch-manifest.json', 'utf8'));
  const after = await manifest();
  assert.deepEqual(after.indexes.map(({ uid, primaryKey, count }) => ({ uid, primaryKey, count })),
    before.indexes.map(({ uid, primaryKey, count }) => ({ uid, primaryKey, count })), 'Search index document counts changed');
  for (const index of before.indexes) {
    const restored = after.indexes.find(item => item.uid === index.uid)!;
    compareSettings(restored.settings, index.settings, index.uid);
  }
  assert.deepEqual(after.keys, before.keys, 'Search API key permissions changed');
  console.log(`Verified ${after.indexes.length} indexes, document counts, settings and API key permissions`);
} else {
  throw new Error('Expected export or validate');
}
