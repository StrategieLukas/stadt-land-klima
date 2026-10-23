import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import * as authContracts from '../../../src/frontend/shared/contracts/auth.js';
import * as searchContracts from '../../../src/frontend/shared/contracts/search.js';
import * as slzContracts from '../../../src/frontend/shared/contracts/slz.js';
import * as i18n from '../../../src/frontend/shared/i18n.js';
import * as urlHelpers from '../../../src/frontend/shared/serviceUrl.js';
import { getCandidatePartyLabel, getCandidateDisplayName, formatCandidateNameAndParty } from '../../../src/frontend/shared/candidateParties.js';
import { calculateWahlcheckQuestionScore, getWahlcheckAnswerOptions } from '../../../src/frontend/shared/wahlcheckAnswerOptions.js';
import { calculateAndAddSimilarityScores } from '../../../src/frontend/shared/compareMunicipalities.js';
import { getScorePercentageColor, isRaster } from '../../../src/frontend/shared/utils.js';

type Row = Record<string, any>;
const frontend = createRequire(new URL('../../../src/frontend/package.json', import.meta.url));
const vue = frontend('vue');
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function load(path: string, dependencies: Row = {}, globals: Row = {}, client = true): Row {
  const module = { exports: {} };
  const source = readFileSync(new URL(`../../../src/frontend/${path}`, import.meta.url), 'utf8')
    .replaceAll('import.meta.client', String(client)).replaceAll('import.meta.server', String(!client)).replaceAll('import.meta.dev', 'false');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  runInNewContext(compiled.outputText, {
    module, exports: module.exports, console: { warn() {}, error() {}, log() {} },
    require: (id: string) => { assert.ok(id in dependencies, `${path}: unexpected dependency ${id}`); return dependencies[id]; },
    ...globals,
  });
  return module.exports;
}

const resolveLocale = load('shared/resolveFullLocaleCode.ts').default;
const createTranslator = load('shared/createTranslator.ts').default;

const identity = { id: 'editor', first_name: 'Editor', email: 'editor@example.org', role: { id: 'role', name: 'Administrator' } };
function storeHarness(client = true) {
  const storage = new Map<string, string>();
  const module = load('stores/auth.ts', { vue, '~/shared/contracts/auth': authContracts }, {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
  }, client);
  return { useStore: module.useAuthStore, storage };
}

test('locale resolution supports all three languages, weighted headers, invalid cookies and zero-quality exclusions', () => {
  for (const [input, expected] of [['it-CH', 'it-IT'], ['en-US', 'en-GB'], ['de', 'de-DE'], ['fr;q=1, it;q=0.8, en;q=0.5', 'it-IT'], ['it;q=0, en;q=0.9', 'en-GB'], ['en-US;q=0', 'de-DE'], ['en-US;q=0.9', 'en-GB'], ['it;q=2, en;q=0.9', 'en-GB']] as const) assert.equal(resolveLocale(input), expected);
  for (const input of [null, [], {}, 'unsupported']) assert.equal(resolveLocale(input), 'de-DE');
});

test('translation placeholders, CMS dynamic keys, missing/empty fallbacks and prototype-like keys remain safe', () => {
  const translator = createTranslator([{ key: 'generic.back', value: 'Back :name' }, { key: 'cms.extra', value: 'CMS' }, { key: 'empty', value: '' }, { key: '__proto__', value: 'Safe' }]);
  assert.equal(translator.t('generic.back', { ':name': 'Ada' }), 'Back Ada');
  assert.equal(translator.dynamic('cms.extra'), 'CMS');
  assert.equal(translator.dynamic('unknown'), 'unknown');
  assert.equal(translator.dynamic('unknown :name', { ':name': 'Ada' }), 'unknown :name');
  assert.equal(translator.dynamic('empty'), 'empty');
  assert.equal(translator.dynamic('__proto__'), 'Safe');
  assert.equal(translator.dynamic('toString'), 'toString');
});

test('translation source completeness and generated key drift are enforced', () => {
  execFileSync(process.execPath, ['scripts/generate-translations.mts', '--check'], { cwd: new URL('../../../src/frontend/', import.meta.url), stdio: 'pipe' });
});

test('translator types reject unknown static keys while allowing explicit dynamic CMS keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slk-translation-types-'));
  try {
    const file = join(dir, 'probe.ts');
    const translator = new URL('../../../src/frontend/shared/createTranslator.ts', import.meta.url).pathname;
    writeFileSync(file, `import createTranslator from ${JSON.stringify(translator)};\nconst { t, dynamic } = createTranslator([]);\nt('generic.back');\ndynamic('runtime.cms.key');\nt('definitely.missing.phase4.key');\n`);
    const program = ts.createProgram([file], { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowImportingTsExtensions: true, types: [] });
    const errors = ts.getPreEmitDiagnostics(program).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 1, errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
    assert.equal(errors[0]?.code, 2345);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('party identities, simple/differentiated answers, nullable scores and comparison helpers retain behavior', () => {
  assert.equal(getCandidatePartyLabel('CDU/CSU', 'Bayern'), 'CSU');
  assert.equal(getCandidateDisplayName({ name: 'Ada', party: 'Gruene' }, '', true), 'Grüne');
  assert.equal(formatCandidateNameAndParty({ name: 'Ada', party: 'SPD' }), 'Ada (SPD)');
  assert.deepEqual(getWahlcheckAnswerOptions({ simple_answer_mode: true }).map(option => option.value), [0, 2, 4]);
  assert.equal(getWahlcheckAnswerOptions(null).length, 5);
  assert.equal(calculateWahlcheckQuestionScore(null, 4), null);
  assert.deepEqual(calculateWahlcheckQuestionScore(0, 4, 2), { distance: 4, points: 0, maxPoints: 8 });
  assert.equal(getScorePercentageColor(null), 'rating-na');
  assert.equal(isRaster('image/svg+xml'), false);
  assert.equal(isRaster('image/png'), true);
  assert.ok(Number.isFinite(calculateAndAddSimilarityScores({ population: 0, geolocation: { lat: 52, lon: 13 } }, [{ municipality: { population: 0, geolocation: { lat: 52, lon: 13 } } }])[0]?.similarityScore));
});

test('browser editor state retains identity/CSRF only and retires legacy credential storage', () => {
  const harness = storeHarness(); const store = harness.useStore();
  harness.storage.set('slk_auth', JSON.stringify({accessToken: 'legacy-secret'}));
  store.setSession({...identity, token: 'must-not-persist'}, 'a'.repeat(64));
  assert.equal(harness.useStore(), store);
  assert.equal(harness.storage.size, 0);
  assert.equal('_accessToken' in store, false); assert.equal('_refreshToken' in store, false);
  assert.equal('token' in store.user.value, false);
  store.setSession({...identity, role: 'role'}, 'a'.repeat(64)); assert.equal(store.user.value.role, 'role');
  store.clearAuth(); assert.equal(store.isAuthenticated.value, false);
});

test('server authentication state is isolated and cannot establish a browser session', () => {
  const harness = storeHarness(false); const first = harness.useStore(); const second = harness.useStore();
  assert.notEqual(first, second);
  first.setLoading(true); assert.equal(second.isLoading.value, false);
  assert.throws(() => first.setSession(identity, 'a'.repeat(64)), /browser-only/);
  assert.equal(second.user.value, null);
});

function authHarness() {
  const harness = storeHarness(); const store = harness.useStore(); const commands: Row[] = [];
  let me: () => Promise<unknown> = async () => ({user: identity, csrf: 'a'.repeat(64)});
  const client: Row = {with: () => client};
  const sdk = {createDirectus: (url: string) => {commands.push({operation: 'createClient', url}); return client;}, rest: (options: Row) => {commands.push({operation: 'rest', options});}};
  const module = load('composables/useAuth.ts', {'@directus/sdk': sdk, '~/stores/auth': {useAuthStore: () => store}, '~/shared/contracts/auth': authContracts}, {
    window: {location: {origin: 'https://website.test'}}, URL, Headers,
    $fetch: async (path: string, options: Row = {}) => {
      commands.push({operation: path, options});
      if (path === '/api/editor/session/logout') return {success: true};
      return me();
    },
  });
  return {...harness, store, commands, auth: module.useAuth(), secondAuth: () => module.useAuth(), setMe: (fn: typeof me) => {me = fn;}};
}

test('login, refresh, SDK requests and logout use cookie endpoints and CSRF without exposing JWTs', async () => {
  const harness = authHarness();
  const result = await harness.auth.login({email: 'editor@example.org', password: 'password'});
  assert.equal(result.user.id, 'editor');
  assert.equal((await harness.auth.refresh()).id, 'editor');
  harness.auth.getAuthenticatedClient();
  assert.equal(harness.commands.find(command => command.operation === 'createClient')?.url, 'https://website.test/api/editor/cms');
  const rest = harness.commands.find(command => command.operation === 'rest')!;
  const request = rest.options.onRequest({headers: {'content-type': 'application/json'}});
  assert.equal(request.headers.get('authorization'), null); assert.equal(request.headers.get('x-csrf-token'), 'a'.repeat(64));
  await harness.auth.logout();
  assert.equal(harness.commands.find(command => command.operation.endsWith('/logout'))?.options.headers['x-csrf-token'], 'a'.repeat(64));
  assert.equal(harness.store.isAuthenticated.value, false); assert.equal(harness.storage.size, 0);
});

test('cookie-session initialization is coalesced and an in-flight lookup cannot restore logout', async () => {
  const harness = authHarness();
  let resolve!: (user: unknown) => void;
  harness.setMe(() => new Promise(done => {resolve = done;}));
  const first = harness.auth.initialize(); const second = harness.secondAuth().initialize();
  await new Promise(done => setImmediate(done));
  assert.equal(harness.commands.filter(command => command.operation === '/api/editor/session').length, 1);
  await harness.auth.logout(); resolve({user: identity, csrf: 'a'.repeat(64)}); await Promise.all([first, second]);
  assert.equal(harness.store.isAuthenticated.value, false);
});

test('server and client plugins share the request locale and translations without exposing SDK credentials', async () => {
  for (const language of i18n.locales) {
    const states = new Map<string, Row>(); const state = (key: string, init: () => unknown) => { if (!states.has(key)) states.set(key, vue.ref(init())); return states.get(key); };
    const translations = [{ key: 'generic.back', value: language }];
    const config = { public: { appEnv: 'test' }, directusServerUrl: 'http://cms.test', directusFrontendServerToken: 'private-canary' };
    const app = { defineNuxtPlugin: (factory: unknown) => factory, useCookie: () => ({ value: null }), useRuntimeConfig: () => config, useState: state, useRequestHeaders: () => ({ 'accept-language': language }) };
    const sdkClient: Row = { with: () => sdkClient, request: async () => translations };
    const dependencies = { '#app': app, '~/shared/resolveFullLocaleCode': { __esModule: true, default: resolveLocale }, '~/shared/createTranslator': { __esModule: true, default: createTranslator }, '~/shared/i18n': i18n, '~/shared/serviceUrl': urlHelpers, '@directus/sdk': { createDirectus: () => sdkClient, rest() {}, staticToken() {}, readTranslations() {} } };
    const server = await load('plugins/directus.server.ts', dependencies, { useState: state, useHead() {} }, false).default();
    const client = await load('plugins/directus.client.ts', dependencies, { useState: state, document: { documentElement: { getAttribute: () => 'de' } }, $fetch: async () => { throw new Error('Hydrated translations must be reused'); } }).default();
    assert.equal(server.provide.locale, language); assert.equal(client.provide.locale, language);
    assert.equal(client.provide.t('generic.back'), language);
    assert.ok(!JSON.stringify([...states]).includes('private-canary'));
    assert.ok(!('directus' in server.provide) && !('directus' in client.provide));
  }
});

test('service configuration rejects credentials and unsafe URLs without echoing their values', () => {
  assert.equal(urlHelpers.serviceBaseUrl('/api/stadtlandzahl/', ''), '/api/stadtlandzahl');
  for (const url of ['javascript:alert(1)', 'https://user:private-password@example.org/', 'https://example.org/?secret=private-password', '//other.example.org', {}]) {
    assert.throws(() => urlHelpers.serviceBaseUrl(url, ''), error => error instanceof Error && error.message === 'Invalid service URL');
  }
});

test('external area/render contracts reject malformed responses rather than exporting unchecked values', () => {
  assert.equal(searchContracts.AreaSchema.safeParse({ ars: '11', name: 'Berlin', prefix: 'Stadt', population: 'wrong' }).success, false);
  assert.equal(slzContracts.RenderResponseSchema.safeParse({ render_elements: [{ plot_id: 'x', type: 'unsupported' }] }).success, false);
  assert.equal(slzContracts.RenderResponseSchema.parse({ render_elements: [], narrative_steps: [] }).render_elements.length, 0);
});

test('clearing or replacing a search prevents a late response from restoring stale results', async () => {
  const pending: Promise<void>[] = []; const requests = new Map<string, (value: unknown) => void>();
  const debounce = (callback: (...args: any[]) => Promise<void>) => Object.assign((...args: any[]) => { const promise = callback(...args); pending.push(promise); return promise; }, { cancel() {} });
  const { useContentSearch } = load('composables/useContentSearch.ts', { lodash: { debounce }, '~/shared/contracts/search': searchContracts }, {
    ref: vue.ref, $fetch: (url: string) => new Promise(resolve => requests.set(new URL(url, 'http://test').searchParams.get('q')!, resolve)),
  });
  const search = useContentSearch();
  const hit = (id: string) => ({ hits: [{ id, type: 'page', title: id, url: '/page' }] });
  search.search('old'); search.search('new'); requests.get('new')!(hit('new')); await pending[1];
  requests.get('old')!(hit('old')); await pending[0]; assert.equal(search.results.value[0].id, 'new');
  search.search('late'); search.clear(); requests.get('late')!(hit('late')); await pending[2];
  assert.deepEqual(plain(search.results.value), []); assert.equal(search.isLoading.value, false);
});


test('translation fallback returns every key beyond the first 1000, validates queries and strips private data', async () => {
  const rows = Array.from({ length: 1071 }, (_, index) => ({ key: `key.${index}`, value: 'Value', language: 'it-IT', privateNote: 'secret' }));
  const queries: Row[] = [];
  const handler = load('server/api/public/translations.get.ts', {
    '@directus/sdk': { readTranslations: (query: Row) => { queries.push(query); return query; } },
    h3: { defineEventHandler: (fn: unknown) => fn, getQuery: (event: Row) => event.query, setResponseHeader() {}, createError: (options: Row) => Object.assign(new Error('Controlled translation error'), options) },
    '../../utils/directusServerClient': { createTypedDirectusServerClient: () => ({ request: async () => rows }) },
    '~/shared/i18n': i18n,
  }).default;
  const result = await handler({ query: { language: 'it-IT' } });
  assert.equal(result.translations.length, 1071);
  assert.equal(queries[0]?.limit, -1);
  assert.ok(!JSON.stringify(result).includes('secret'));
  assert.equal(queries[0]?.filter.language._eq, 'it-IT');
  for (const query of [{ language: 'fr' }, { language: ['de-DE'] }, { keys: ['bad'] }, { keys: 'x'.repeat(16001) }]) {
    await assert.rejects(() => handler({ query }), { statusCode: 400 });
  }
  rows[0]!.value = null as never;
  await assert.rejects(() => handler({ query: {} }), { statusCode: 502 });
});

test('municipality manifest cache coalesces requests, separates origins and retries malformed replies', async () => {
  const calls: string[] = []; let now = 1; let malformed = true;
  const module = load('composables/useMunicipalitiesManifest.ts', { zod: frontend('zod'), '~/shared/contracts/search': searchContracts }, {
    Date: { now: () => now },
    $fetch: async (url: string) => { calls.push(url); return malformed ? { byState: { DE: [null] } } : { byState: {} }; },
  });
  const fetch = module.fetchMunicipalitiesManifest;
  assert.equal(await fetch('https://one.test'), null);
  assert.equal(await fetch('https://one.test'), null);
  assert.equal(calls.length, 1);
  malformed = false; now += 5001;
  await Promise.all([fetch('https://one.test'), fetch('https://one.test')]);
  assert.equal(calls.length, 2);
  await fetch('https://two.test'); assert.equal(calls.length, 3);
  module.clearMunicipalitiesManifestCache(); await fetch('https://one.test'); assert.equal(calls.length, 4);
});


test('collection rendering validates both paths, resolves narrative plot IDs and clears stale diagrams on failure', async () => {
  const replies: unknown[] = [];
  const { useCollectionRender } = load('composables/useCollectionRender.ts', { vue, '~/shared/contracts/slz': slzContracts }, { $fetch: async () => replies.shift() });
  const render = useCollectionRender('https://data.test');
  const element = { plot_id: 'plot', type: 'kpi', vegalite_spec: null };
  const narrative = { index: 0, title: { 'de-DE': 'Title' }, description: {}, layout: 'default', plot_ids: ['plot', 'absent'] };
  replies.push({ id: 'collection', title: { 'de-DE': 'Collection' }, description: {}, render_elements: [element] });
  await render.load('collection');
  assert.equal(render.steps.value[0].elements[0].plot_id, 'plot');
  replies.push({ render_elements: [element], narrative_steps: [narrative] });
  await render.loadFromRender('collection', '11');
  assert.equal(render.steps.value[0].elements.length, 1);
  assert.equal(render.elementByPlotId.value.size, 1);
  replies.push({ render_elements: [{ type: 'invalid' }] });
  await render.loadFromRender('collection', '11');
  assert.equal(render.error.value, true);
  assert.equal(render.steps.value.length, 0);
  assert.equal(render.elementByPlotId.value.size, 0);
  await render.load('collection', { id: 123 });
  assert.equal(render.error.value, true);
  assert.equal(render.loading.value, false);
});

test('SSR UI state is request-scoped and the embedded search bridge does not share server callbacks', () => {
  let states = new Map<string, Row>();
  const state = (key: string, init: () => unknown) => { if (!states.has(key)) states.set(key, vue.ref(init())); return states.get(key); };
  const { useHeaderHeight } = load('composables/useHeaderHeight.ts', {}, { useState: state }, false);
  const first = useHeaderHeight(); first.value = 99;
  assert.equal(useHeaderHeight().value, 99);
  states = new Map(); assert.equal(useHeaderHeight().value, 146);
  const { useEmbeddedSearchBridge } = load('composables/useEmbeddedSearchBridge.ts', { vue }, { useNuxtApp: () => ({ $t: (key: string) => key }) }, false);
  const bridge = useEmbeddedSearchBridge(); let focused = false;
  bridge.registerFocusInput(() => { focused = true; }); bridge.focusHeaderInput();
  assert.equal(focused, true); assert.equal(useEmbeddedSearchBridge().hasHeaderInput, false);
});


test('StadtLandZahl plugin validates real REST/GraphQL replies, exact region prefixes and pagination cycles', async () => {
  const queries: Row[] = []; const replies: unknown[] = []; let json: unknown = null;
  class ApolloClient { async query(query: Row) { queries.push(query); return { data: replies.shift() }; } }
  const plugin = load('plugins/stadt-land-zahl-api.client.ts', {
    zod: frontend('zod'), '~/shared/serviceUrl': urlHelpers,
    '~/shared/contracts/search': searchContracts, '~/shared/contracts/slz': slzContracts,
    '#app': { useRuntimeConfig: () => ({ public: { stadtlandzahlBaseUrl: '/api/stadtlandzahl' } }) },
    '@apollo/client/core': { ApolloClient, HttpLink: class {}, InMemoryCache: class {} },
    'graphql-tag': (parts: TemplateStringsArray, ...values: unknown[]) => parts.reduce((query, part, index) => query + part + (values[index] ?? ''), ''),
  }, { defineNuxtPlugin: (fn: unknown) => fn, URLSearchParams,
    $fetch: async () => json, fetch: async () => ({ ok: true, json: async () => json }),
  }).default();
  const api = plugin.provide.stadtlandzahlAPI;
  const area = { ars: '110000000000', prefix: 'Stadt', name: 'Berlin', population: 1 };
  const page = (nodes: unknown[], hasNextPage: boolean, endCursor: string | null) => ({ allAdministrativeAreas: { edges: nodes.map(node => ({ node })), pageInfo: { hasNextPage, endCursor } } });
  replies.push(page([area, { ...area, ars: '991100000000' }], true, 'next'), page([area], false, null));
  const municipalities = await api.fetchMunicipalitiesInRegion('110000000000', 2);
  assert.equal(municipalities.length, 2);
  assert.equal(queries[0]?.variables.ars_Icontains, '11');
  assert.equal(queries[1]?.variables.after, 'next');
  const count = queries.length;
  assert.deepEqual(plain(await api.fetchHistogramData('bad } query {', 'value')), []);
  assert.equal(queries.length, count, 'Invalid selectors never reach GraphQL');
  replies.push(page([area], true, 'a'), page([area], true, 'b'), page([area], true, 'a'));
  assert.deepEqual(plain(await api.fetchHistogramData('population_data', 'population')), []);
  assert.equal(queries.length, count + 3, 'A multi-page cursor cycle terminates');
  json = { ...area, contained_by: [{ ars: '1', name: 'State', level: 2, prefix: 'Land' }, { ars: '0', name: 'Country', level: 1, prefix: 'Staat' }] };
  const stats = await api.fetchStatsByARS(area.ars);
  assert.equal(stats.state, 'State'); assert.equal(stats.contained_by[0].level, 1);
  json = [area]; assert.equal((await api.searchAdministrativeAreas('Berlin')).length, 1);
  json = { malformed: true }; assert.deepEqual(plain(await api.searchAdministrativeAreas('Berlin')), []);
  assert.equal(await api.fetchStatsByARS(area.ars), null);
  json = { render_elements: [{ type: 'invalid' }] };
  await assert.rejects(() => api.fetchCollectionRender('collection', area.ars));
});
