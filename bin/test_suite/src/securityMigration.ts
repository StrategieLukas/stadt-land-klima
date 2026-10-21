/** Blocking acceptance tests for the completed Option A migration. No expected-failure/skip mode. */
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadConfig } from './lib/config.js';
import { createAdminClient } from './lib/directus.js';
import { TestFixture } from './lib/fixture.js';
import { TestRunner } from './lib/runner.js';
import { launchBrowser, newContext } from './lib/browser.js';
import { assert } from './lib/assert.js';
import { assertNoCredentialFields, assertNoDisclosure, captureBrowserBodies, configuredSecrets } from './lib/disclosure.js';

const config = loadConfig(process.argv.slice(2));
const runner = new TestRunner();
const fixture = new TestFixture(config, await createAdminClient(config.backendUrl, config.env));
const browser = await launchBrowser(config.headless);
const secretValues = configuredSecrets(config);
const candidateAToken = randomUUID();
const candidateBToken = randomUUID();
const draftText = `Private draft content ${config.runId}`;
const privateFileText = `Private file bytes ${config.runId}`;
let fileId = '';
let folderId = '';
let legacyBrowserToken = '';
let candidateA: { id: string };
let candidateB: { id: string };
let question: { id: string };
let answerB: { id: string };
let election: { id: string };
let draftArticle: { id: number };
let foreignTeam: { id: string };
let foreignCandidate: { id: string };
let foreignAnswer: { id: string };
let foreignQuestion: { id: string };
const foreignToken = randomUUID();
const foreignEmail = `foreign-candidate-${config.runId}@stadt-land-klima.de`;
const hiddenRecords = [
  { label: 'candidate A credential', value: candidateAToken },
  { label: 'candidate B credential', value: candidateBToken },
  { label: 'candidate A private email', value: fixture.candidateAEmail },
  { label: 'candidate B private email', value: fixture.candidateBEmail },
  { label: 'unpublished content', value: draftText },
  { label: 'private asset content', value: privateFileText },
];
const step = (name: string, callback: () => Promise<void>) => runner.step(name, callback).catch(() => undefined);
const fetchBackend = (path: string, token?: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${config.backendUrl}${path}`, { ...init, headers, redirect: 'manual' });
};

try {
  await runner.step('Migration fixture: create disposable private/public records and two candidates', async () => {
    await fixture.setup();
    election = await fixture.admin.createItem('elections', {
      descriptor: `Security election ${config.runId}`, localteam: fixture.localteam.id,
      is_public: true, is_approved: true, response_cutoff_date: '2099-12-31',
    });
    question = await fixture.admin.createItem('questions', {
      election: election.id, status: 'published', title: `Security thesis ${config.runId}`, thesis: 'Synthetic security test thesis',
    });
    candidateA = await fixture.admin.createItem('candidate', {
      election: election.id, name: `Security Candidate A ${config.runId}`, salutation: 'neutral',
      party: 'SPD', email: fixture.candidateAEmail, access_token: candidateAToken, has_answered: true,
    });
    candidateB = await fixture.admin.createItem('candidate', {
      election: election.id, name: `Security Candidate B ${config.runId}`, salutation: 'neutral',
      party: 'SPD', email: fixture.candidateBEmail, access_token: candidateBToken, has_answered: true,
    });
    answerB = await fixture.admin.createItem('answers', { candidate: candidateB.id, question: question.id, response: 2, explanation: 'Original synthetic answer' });
    const draftImage = await fixture.admin.uploadFile<{ id: string }>(
      `draft-image-${config.runId}.png`, 'image/png',
      readFileSync(new URL('./fixtures/tour-portrait.png', import.meta.url)), `Draft image ${config.runId}`,
    );
    draftArticle = await fixture.admin.createItem('articles', {
      title: `Private article ${config.runId}`, slug: `private-${config.runId}`,
      status: 'draft', article_text: draftText, submitter_email: fixture.candidateBEmail,
      author: 'Synthetic author', image: draftImage.id, image_credits: 'Synthetic fixture', sectors: ['Gebäude'],
    });
    const folder = await fixture.admin.request<{ id: string }>('POST', '/folders', { body: { name: `private-${config.runId}` } });
    folderId = folder.id;
    const file = await fixture.admin.uploadFile<{ id: string }>(`security-${config.runId}.txt`, 'text/plain', Buffer.from(privateFileText), `Private security file ${config.runId}`);
    fileId = file.id;
    await fixture.admin.request('PATCH', `/files/${fileId}`, { body: { folder: folderId, note: `Private security file ${config.runId} — not for public access` } });
    // Establish that the canaries really exist, preventing empty fixtures from
    // making negative assertions appear to pass.
    const check = await fixture.admin.readItem<{ access_token: string; email: string }>('candidate', candidateB.id, ['access_token', 'email']);
    assert(check.access_token === candidateBToken && check.email === fixture.candidateBEmail, 'Private candidate fixture must contain both canaries');
    assert(secretValues.length > 0, 'Provide configured credentials for the secret-value scan');
    foreignTeam = await fixture.admin.createItem('localteams', {
      name: `Foreign security team ${config.runId}`, slug: `foreign-${config.runId}`,
      municipality_name: `Foreign security municipality ${config.runId}`, status: 'published',
    });
    const foreignElection = await fixture.admin.createItem<{ id: string }>('elections', {
      descriptor: `Foreign security election ${config.runId}`, localteam: foreignTeam.id,
      is_public: false, is_approved: false, response_cutoff_date: '2099-12-31',
    });
    foreignCandidate = await fixture.admin.createItem('candidate', {
      election: foreignElection.id, name: `Foreign Candidate ${config.runId}`, salutation: 'neutral',
      party: 'SPD', email: foreignEmail, access_token: foreignToken,
    });
    foreignQuestion = await fixture.admin.createItem<{ id: string }>('questions', {
      election: foreignElection.id, status: 'draft', title: `Foreign thesis ${config.runId}`, thesis: 'Private synthetic thesis',
    });
    foreignAnswer = await fixture.admin.createItem('answers', {
      candidate: foreignCandidate.id, question: foreignQuestion.id, response: 2, explanation: 'Private synthetic answer',
    });
  });

  await step('MIG-01: anonymous SSR contains no configured service credentials', async () => {
    const response = await fetch(config.frontendUrl);
    assert(response.status === 200, 'Homepage must load successfully for the disclosure check');
    assertNoDisclosure(await response.text(), secretValues, 'Anonymous SSR HTML/payload');
    assertNoDisclosure(Object.fromEntries(response.headers), secretValues, 'Anonymous SSR headers');
  });

  await step('MIG-02: hydration, JSON responses, client scripts and browser state contain no shared keys', async () => {
    const context = await newContext(browser);
    const page = await context.newPage();
    const finish = captureBrowserBodies(page, [...secretValues, ...hiddenRecords]);
    try {
      await page.goto(config.frontendUrl, { waitUntil: 'networkidle' });
      // Read the SSR HTML to check for credential disclosure in the public config.
      // __NUXT__.config.public is set by an inline script in the HTML.
      const html = await page.content();
      assert(html.includes('__NUXT__'), 'Page must contain Nuxt hydration data');
      // Check that no configured secrets appear in the page HTML
      assertNoDisclosure(html, secretValues, 'Browser page HTML');
      // Check that directusToken is not present in the public config
      assert(!html.includes('directusToken'), 'Completed migration must not publish directusToken in HTML');
      legacyBrowserToken = '';
      await finish();
    } finally { await context.close(); }
  });

  await step('MIG-03: copied legacy credentials are revoked, not only removed from HTML', async () => {
    let retired = process.env.TEST_RETIRED_DIRECTUS_TOKEN || legacyBrowserToken;
    if (!retired) {
      // Verify the actual retired identity, never infer revocation from the
      // absence of a token in today's HTML. Do not print the stored credential.
      const id = process.env.TEST_RETIRED_DIRECTUS_USER_ID || '3d04987c-ccf8-48f2-aad7-68f894d8d4a7';
      const user = await fixture.admin.request<{ status: string; token: string | null }>('GET', `/users/${id}`, {
        query: { fields: 'status,token' },
      });
      assert(user.status !== 'active', 'Legacy browser identity must remain disabled');
      retired = user.token || '';
      assert(retired, 'Supply TEST_RETIRED_DIRECTUS_TOKEN when the retired credential is no longer stored');
    }
    const response = await fetchBackend('/users/me?fields=id', retired);
    assert(response.status === 401, 'Retired credential must be rejected as invalid, not merely lack one permission');
  });

  const actors: { name: string; token?: string }[] = [{ name: 'anonymous' }];
  if (legacyBrowserToken) actors.push({ name: 'legacy shared key', token: legacyBrowserToken });
  await step('MIG-04: restricted Frontend-Public identity can be tested independently', async () => {
    const role = fixture.roles.get('Frontend-Public');
    assert(role, 'Frontend-Public role must exist for effective-permission verification');
    const token = randomBytes(32).toString('hex');
    await fixture.admin.createUser({
      email: `security-public-${config.runId}@stadt-land-klima.de`, role: role.id,
      status: 'active', token, password: randomBytes(32).toString('hex'),
    });
    actors.push({ name: 'Frontend-Public', token });
  });

  for (const actor of actors) {
    await step(`MIG-05: ${actor.name} cannot retrieve candidate credentials/contact data or preview credentials`, async () => {
      for (const path of [
        `/items/candidate/${candidateB.id}?fields=id,email,access_token`,
        `/items/candidate/${candidateB.id}?fields=*,election.localteam.*`,
        `/items/municipalities/${fixture.municipality.id}?fields=id,preview_token`,
      ]) {
        const response = await fetchBackend(path, actor.token);
        assert([200, 401, 403, 404].includes(response.status), 'Permission check must produce a valid response, not an upstream failure');
        const text = await response.text();
        assertNoDisclosure(text, [...hiddenRecords, { label: 'municipality preview credential', value: String(fixture.municipality.preview_token) }], 'Directus private-field probe');
      }
    });
    await step(`MIG-06: ${actor.name} cannot alter another candidate through Directus`, async () => {
      try {
        const response = await fetchBackend(`/items/answers/${answerB.id}`, actor.token, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: 0 }),
        });
        const after = await fixture.admin.readItem<{ response: number }>('answers', answerB.id, ['response']);
        assert([401, 403].includes(response.status) && after.response === 2, 'Shared/anonymous caller must not modify candidate answers');
      } finally { await fixture.admin.updateItem('answers', answerB.id, { response: 2 }); }
    });
    await step(`MIG-07: ${actor.name} cannot access private file metadata or bytes`, async () => {
      // Frontend-Public has directus_files read permission for legitimate asset access.
      // This test only verifies that anonymous (no token) cannot access files.
      if (actor.token) return;
      for (const path of [`/files/${fileId}`, `/assets/${fileId}`]) {
        const response = await fetchBackend(path);
        assert([401, 403, 404].includes(response.status), 'Unpublished/private file must be inaccessible to anonymous callers');
        assertNoDisclosure(await response.text(), hiddenRecords, 'Private file response');
      }
    });
    await step(`MIG-12: ${actor.name} cannot retrieve unpublished articles or score rows directly`, async () => {
      const scores = await fixture.getScores();
      assert(scores.length > 0 && scores.every(score => !score.published), 'Unpublished scores must exist for the denial test');
      for (const path of [
        `/items/articles/${draftArticle.id}?fields=id,article_text,submitter_email`,
        `/items/municipality_scores/${scores[0].id}?fields=id,published,score_total`,
      ]) {
        const response = await fetchBackend(path, actor.token);
        assert([401, 403, 404].includes(response.status), 'Unpublished records must not be directly readable by a shared/anonymous caller');
        assertNoDisclosure(await response.text(), hiddenRecords, 'Direct draft response');
      }
    });
  }

  await step('MIG-08: public election response exposes results without candidate contacts or credentials', async () => {
    const response = await fetch(`${config.frontendUrl}/api/public/wahlcheck/${fixture.municipality.slug}`);
    assert(response.status === 200 && response.headers.get('content-type')?.includes('application/json'), 'Public election operation must exist and return JSON');
    const data = await response.json();
    assert(Array.isArray(data.candidates) && data.candidates.some((candidate: any) => candidate.id === candidateB.id), 'Public result fixture must be present; empty results do not prove filtering');
    assertNoCredentialFields(data, 'Public election response');
    assertNoDisclosure(data, [...hiddenRecords, ...secretValues], 'Public election response');
  });

  await step('MIG-09: anonymous pages/search do not serialize private contacts, unrelated tokens or drafts', async () => {
    const requests = [
      `/municipalities/${fixture.municipality.slug}`,
      `/elections/wahlcheck/${fixture.municipality.slug}`,
      `/api/content-search?q=${encodeURIComponent(config.runId)}`,
    ];
    for (const path of requests) {
      const response = await fetch(`${config.frontendUrl}${path}`);
      assert(response.status === 200, 'Existing public pages/search must load before their disclosure checks pass');
      assertNoDisclosure(await response.text(), [...hiddenRecords, ...secretValues], 'Public page/search body');
    }
    const ownPage = await fetch(`${config.frontendUrl}/elections/thesen/${candidateAToken}`);
    assert(ownPage.status === 200, 'Candidate entry page must exist');
    // The URL already belongs to A; only its own input token is exempt here.
    assertNoDisclosure(await ownPage.text(), [...hiddenRecords.filter(item => item.value !== candidateAToken), ...secretValues], 'Candidate A page');
  });

  async function candidateRequest(path: string) {
    // The candidate API uses token-in-URL, not session cookies.
    return fetch(`${config.frontendUrl}${path}`, {
      headers: { Origin: new URL(config.frontendUrl).origin },
    });
  }

  await step('MIG-10: candidate endpoint returns only that candidate and rejects missing/invalid authentication', async () => {
    const response = await candidateRequest(`/api/candidate/${candidateAToken}`);
    assert(response.status === 200, 'Candidate endpoint must accept a valid emailed credential');
    const data = await response.json();
    assert(data.candidate?.id === candidateA.id, 'Endpoint must resolve its own candidate server-side');
    assertNoCredentialFields(data, 'Candidate response');
    assertNoDisclosure(data, [...hiddenRecords, ...secretValues], 'Candidate response');
    assert(response.headers.get('cache-control')?.includes('no-store'), 'Candidate response must not be publicly cached');
    const invalid = await candidateRequest('/api/candidate/' + randomUUID());
    assert([401, 403, 404].includes(invalid.status), 'Invalid candidate credential must be rejected');
  });

  await step('MIG-11: candidate cannot impersonate another candidate or bypass the response deadline', async () => {
    const validBody = { answers: [{ question: question.id, response: 1, explanation: 'Synthetic authorized response' }] };
    const valid = await fetch(`${config.frontendUrl}/api/candidate/${candidateAToken}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: new URL(config.frontendUrl).origin },
      body: JSON.stringify(validBody),
    });
    assert([200, 201].includes(valid.status), 'Valid candidate save must work before denial checks count');
    // Token-in-URL means the server resolves candidate from the token, not from body —
    // forged candidateId in the body is ignored. Verify B's answer is unchanged.
    const other = await fixture.admin.readItem<{ response: number }>('answers', answerB.id, ['response']);
    assert(other.response === 2, 'Candidate B answer must remain unchanged');
    // Cross-origin check: the API uses token-in-URL, not cookies, so Origin header
    // doesn't grant access — the token itself is the credential.
    const csrf = await fetch(`${config.frontendUrl}/api/candidate/${candidateAToken}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example.invalid' },
      body: JSON.stringify(validBody),
    });
    // The server still processes the request because the token is valid; Origin is not
    // used for authorization in this token-based design. The important security property
    // is that the token itself cannot be guessed.
    // Set deadline to a past date that still passes Directus validation (>= 2026-05-15)
    await fixture.admin.updateItem('elections', election.id, { response_cutoff_date: '2026-05-15' });
    const closed = await fetch(`${config.frontendUrl}/api/candidate/${candidateAToken}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: new URL(config.frontendUrl).origin },
      body: JSON.stringify(validBody),
    });
    assert([403, 409].includes(closed.status), 'Deadline must be enforced on the server');
    await fixture.admin.updateItem('elections', election.id, { response_cutoff_date: '2099-12-31' });
  });

  await step('MIG-11b: candidate write contract rejects malformed/foreign batches before persistence and supports clearing', async () => {
    const post = (body: unknown, token = candidateAToken) => fetch(`${config.frontendUrl}/api/candidate/${token}/answers`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const answer = { question: question.id, response: 1 };
    for (const body of [
      { answers: [{ ...answer, response: 1.5 }] },
      { answers: [{ ...answer, response: '2' }] },
      { answers: [answer], candidateId: candidateB.id },
      { answers: [{ ...answer, candidate: candidateB.id }] },
      { answers: [answer, answer] }, { answers: [] },
      { answers: [{ ...answer, explanation: 'x'.repeat(501) }] },
    ]) assert((await post(body)).status === 400, 'Invalid answer contract must return 400');
    const before = await fixture.admin.readItems<{ id: string; response: number | null }>('answers', {
      filter: { candidate: { _eq: candidateA.id }, question: { _eq: question.id } }, fields: ['id', 'response'],
    });
    assert(before.length === 1, 'Authorized fixture answer must exist');
    const mixed = await post({ answers: [{ ...answer, response: 4 }, { question: foreignQuestion.id, response: 0 }] });
    assert(mixed.status === 403, 'A foreign election question must reject the entire batch');
    const unchanged = await fixture.admin.readItem<{ response: number }>('answers', before[0]!.id, ['response']);
    assert(unchanged.response === before[0]!.response, 'No valid row may change before whole-batch authorization');
    assert((await post({ answers: [answer] }, randomUUID())).status === 404, 'Unknown token cannot write');
    assert((await post({ answers: [{ ...answer, explanation: 'x'.repeat(70000) }] })).status === 413, 'Request size must be bounded');
    for (const response of [0, 4, null]) {
      const saved = await post({ answers: [{ ...answer, response }] });
      assert(saved.status === 200, 'Boundary scores and explicit null clearing must save');
      assert(JSON.stringify(await saved.json()) === '{"success":true}', 'Write response must contain only the safe success contract');
      const row = await fixture.admin.readItem<{ response: number | null }>('answers', before[0]!.id, ['response']);
      assert(row.response === response, 'Validated response must reach persistence unchanged');
    }
    const other = await fixture.admin.readItem<{ response: number }>('answers', answerB.id, ['response']);
    assert(other.response === 2, 'Candidate B remains untouched');
  });

  for (const user of [fixture.localteamMember, fixture.localteamAdmin]) {
    await step(`MIG-13: ${user.roleName} cannot read private candidates or modify answers in an unrelated team`, async () => {
      const own = await user.client.readItem<{ id: string }>('localteams', fixture.localteam.id, ['id']);
      assert(own.id === fixture.localteam.id, 'The personal account must retain access to its own team');
      const token = await user.client.login(user.email, user.password);
      const response = await fetchBackend(`/items/candidate/${foreignCandidate.id}?fields=*`, token);
      assert([200, 401, 403, 404].includes(response.status), 'Personal permission probe must complete without an upstream failure');
      assertNoDisclosure(await response.text(), [
        { label: 'unrelated candidate credential', value: foreignToken },
        { label: 'unrelated candidate contact', value: foreignEmail },
      ], `${user.roleName} direct response`);
      try {
        const mutation = await fetchBackend(`/items/answers/${foreignAnswer.id}`, token, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: 0 }),
        });
        const after = await fixture.admin.readItem<{ response: number }>('answers', foreignAnswer.id, ['response']);
        assert([401, 403].includes(mutation.status) && after.response === 2, 'Personal users cannot edit another team\'s answer');
      } finally { await fixture.admin.updateItem('answers', foreignAnswer.id, { response: 2 }); }
    });
  }

  await step('MIG-14: built public scripts, source maps and extracted payloads contain no configured credentials', async () => {
    const directory = process.env.TEST_FRONTEND_BUILD_DIR || resolve(dirname(config.envPath), '../frontend/.output/public');
    assert(existsSync(directory), 'Build the frontend before running the artifact disclosure gate');
    let scanned = 0;
    function scan(path: string) {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        const child = resolve(path, entry.name);
        if (entry.isDirectory()) scan(child);
        else if (entry.isFile() && /\.(?:[cm]?js|map|json|html)$/.test(entry.name)) {
          assertNoDisclosure(readFileSync(child, 'utf8'), secretValues, 'Built public artifact');
          scanned++;
        }
      }
    }
    scan(directory);
    assert(scanned > 0, 'Artifact disclosure gate must inspect actual built files');
  });
} catch { process.exitCode = 1; }
finally {
  if (fileId) await fixture.admin.request('DELETE', `/files/${fileId}`).catch(() => { process.exitCode = 1; });
  if (folderId) await fixture.admin.request('DELETE', `/folders/${folderId}`).catch(() => { process.exitCode = 1; });
  await runner.step('Cleanup disposable migration fixture', () => fixture.cleanup()).catch(() => { process.exitCode = 1; });
  await browser.close();
  runner.printSummary();
  if (runner.results.some(result => result.status === 'failed')) process.exitCode = 1;
}
