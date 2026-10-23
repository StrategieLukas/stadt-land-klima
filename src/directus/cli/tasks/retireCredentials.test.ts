import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {parse} from 'yaml';
import {z} from 'zod';
import assert from 'node:assert/strict';
import {planRetirement, applyRetirement, replacementLinks, type RetirementRequest} from './retireCredentials.ts';
function fixture() {
  const candidates = [{id: 1, access_token: 'previous-candidate'}];
  const municipalities = [{id: 'city', preview_token: 'previous-preview', slug: 'test-city'}];
  const users = [{id: 'legacy', role: 'old', status: 'active', token: 'old-shared'}];
  const writes: string[] = [];
  const request: RetirementRequest = async (path, method = 'GET', body) => {
    if (method === 'GET') return {data: path.startsWith('/roles?') ? [{id: 'old', name: 'Frontend'}, {id: 'server', name: 'Frontend-Server'}, {id: 'public', name: 'Frontend-Public'}] : path.startsWith('/users?') ? users : path.startsWith('/items/candidate?') ? candidates : municipalities};
    writes.push(path);
    if (path === '/utils/cache/clear') return null;
    const record = path.includes('/candidate/') ? candidates[0] : path.includes('/municipalities/') ? municipalities[0] : users[0];
    Object.assign(record!, body); return {data: record};
  };
  return {request, candidates, municipalities, users, writes};
}
test('retirement planning makes no writes, isolates the legacy role and prepares private fragment invitations', async () => {
  const f = fixture(); const plan = await planRetirement(f.request, 'https://cms.example.org', 'https://example.org/');
  assert.deepEqual(f.writes, []); assert.equal(plan.credentials.length, 3);
  assert.doesNotMatch(JSON.stringify(plan), /previous-candidate|previous-preview|old-shared/);
  assert.match(replacementLinks(plan)[0]!.url!, /\/elections\/thesen#token=[a-f0-9-]{36}$/);
  const schema = parse(readFileSync(new URL('../../schema/fields/candidate/access_token.yaml', import.meta.url), 'utf8'));
  assert.equal(schema.schema.data_type, 'uuid');
  assert.ok(z.uuid().safeParse(plan.credentials.find(row => row.collection === 'candidate')!.replacement).success, 'Replacement must fit the real UUID column');
  assert.equal(plan.credentials.find(row => row.collection === 'municipalities')!.replacement!.length, 64);
  const result = await applyRetirement(f.request, plan, 'https://cms.example.org', 'https://example.org'); assert.equal(result.updated, 3);
  assert.equal(f.users[0]!.status, 'suspended'); assert.equal(f.users[0]!.token, null);
  assert.equal((await applyRetirement(f.request, plan, 'https://cms.example.org', 'https://example.org')).alreadyApplied, 3);
  assert.ok(!f.writes.some(path => /server|public/.test(path)));
});
test('retirement validates all preconditions before mutation and rejects instance, role, inventory and token drift', async () => {
  for (const drift of ['token', 'role', 'inventory', 'instance', 'website']) {
    const f = fixture(); const plan = await planRetirement(f.request, 'https://cms.example.org', 'https://example.org');
    if (drift === 'token') f.users[0]!.token = 'changed';
    if (drift === 'role') f.users[0]!.role = 'server';
    if (drift === 'inventory') f.candidates.push({id: 2, access_token: 'new'});
    await assert.rejects(applyRetirement(f.request, plan, drift === 'instance' ? 'https://other.example.org' : 'https://cms.example.org', drift === 'website' ? 'https://other.example.org' : 'https://example.org'));
    assert.deepEqual(f.writes, [], drift);
  }
});
test('retirement can resume after a partial upstream failure without rotating completed credentials again', async () => {
  const f = fixture(); const plan = await planRetirement(f.request, 'http://cms', 'https://example.org');
  let writes = 0;
  await assert.rejects(applyRetirement(async (path, method, body) => {
    if (method === 'PATCH' && ++writes === 2) throw Error('CMS offline');
    return f.request(path, method, body);
  }, plan, 'http://cms', 'https://example.org'));
  const token = f.candidates[0]!.access_token;
  const result = await applyRetirement(f.request, plan, 'http://cms', 'https://example.org');
  assert.equal(result.alreadyApplied, 1); assert.equal(result.updated, 2); assert.equal(f.candidates[0]!.access_token, token);
});
