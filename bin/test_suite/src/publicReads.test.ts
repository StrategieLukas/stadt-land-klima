import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as municipalityContracts from '../../../src/frontend/shared/contracts/municipality.js';
import * as searchContracts from '../../../src/frontend/shared/contracts/search.js';

const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
type Row = Record<string, any>;
type Command = { collection: string; query: Row };
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const h3 = {
  defineEventHandler: (handler: unknown) => handler,
  createError: (options: object) => Object.assign(new Error('Controlled public API error'), options),
  getQuery: (event: Row) => event.query ?? {},
  getRouterParam: (event: Row, key: string) => event.params?.[key],
  setResponseHeader() {},
};

// Run production modules with only their transport/Nuxt boundaries replaced.
function load(path: string, dependencies: Record<string, unknown>, globals: Row = {}): Row {
  const module = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(new URL(`../../../src/frontend/${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(compiled.outputText, {
    module, exports: module.exports, ...globals,
    require: (id: string) => {
      if (!(id in dependencies)) {
        if (id === "~/server/utils/cmsValue") return load("server/utils/cmsValue.ts", {});
        if (id === "~/shared/contracts/navigation") return frontend("./shared/contracts/navigation.ts");
        if (id === "zod") return frontend("zod");
        if (id === "~/shared/contracts/municipality") return municipalityContracts;
        if (id === "~/shared/contracts/search") return searchContracts;
        if (id === "~/server/utils/parseCms" || id === "./parseCms") return load("server/utils/parseCms.ts", {h3, zod: frontend("zod")});
        if (id === "./publicQuery") return load("server/utils/publicQuery.ts", {h3});
      }
      assert.ok(id in dependencies, `Unexpected dependency in ${path}: ${id}`);
      return dependencies[id];
    },
  }, { filename: path });
  return module.exports;
}

function cms(respond: (command: Command) => Row | Row[] | Promise<Row | Row[]>) {
  const commands: Command[] = [];
  const client = { request: async (command: Command) => { commands.push(plain(command)); return respond(command); } };
  return {
    commands, client,
    dependencies: {
      h3, '@directus/sdk': { readItems: (collection: string, query: Row) => ({ collection, query }), readSingleton: (collection: string, query: Row) => ({collection, query, singleton: true}) },
      './directusServerClient': { createDirectusServerClient: () => client },
      '../../utils/directusServerClient': { createDirectusServerClient: () => client },
      '../../../utils/directusServerClient': { createDirectusServerClient: () => client },
    },
  };
}

test('public pagination returns all rows with stable order, preserving publication filters', async () => {
  const rows = Array.from({ length: 2001 }, (_, id) => ({ id }));
  const transport = cms(({ query }) => rows.slice(query.offset, query.offset + query.limit));
  const { readPublicItems } = load('server/utils/publicItems.ts', transport.dependencies);
  assert.deepEqual(plain(await readPublicItems('climate_tools', { filter: { status: { _eq: 'published' } } })), rows);
  assert.deepEqual(transport.commands.map(({ query }) => query.offset), [0, 1000, 2000]);
  for (const { query } of transport.commands) {
    assert.deepEqual(query.sort, ['id']);
    assert.equal(query.filter.status._eq, 'published');
  }
});

test('public pagination fails explicitly at its bound instead of truncating data', async () => {
  const transport = cms(({ query }) => Array.from({ length: query.limit }, (_, id) => ({ id })));
  const { readPublicItems } = load('server/utils/publicItems.ts', transport.dependencies);
  await assert.rejects(() => readPublicItems('municipalities', {}, 1000), { statusCode: 502 });
  assert.equal(transport.commands.length, 2);
});

test('public blocks reject invalid scopes and never read blocks for a private parent', async () => {
  const transport = cms(() => []);
  const { readPublicBlocks } = load('server/utils/publicBlocks.ts', transport.dependencies);
  for (const scope of [['directus_users', 'id'], ['pages', ''], ['pages', '../private']]) {
    await assert.rejects(() => readPublicBlocks(...scope), { statusCode: 400 });
  }
  assert.equal(transport.commands.length, 0);
  await assert.rejects(() => readPublicBlocks('pages', 'draft-page'), { statusCode: 404 });
  assert.deepEqual(transport.commands.map(c => c.collection), ['pages']);
  assert.equal(transport.commands[0]?.query.filter.status._eq, 'published');
});

test('tour report blocks require a published stop, report and tour, then select only scoped published blocks', async () => {
  const transport = cms(({ collection }) => collection === 'blocks' ? [{ uuid: 'public' }] : [{ id: 'stop' }]);
  const { readPublicBlocks } = load('server/utils/publicBlocks.ts', transport.dependencies);
  assert.deepEqual(plain(await readPublicBlocks('success_project_tour_stops', 'stop', 'report')), [{ uuid: 'public' }]);
  const parent = transport.commands[0]!.query.filter;
  assert.equal(parent.status._eq, 'published');
  assert.equal(parent.report_status._eq, 'published');
  assert.equal(parent.tour.status._eq, 'published');
  assert.deepEqual(transport.commands[1]!.query.filter, {
    entity_type: { _eq: 'success_project_tour_stops' }, entity_uuid: { _eq: 'stop' },
    field_name: { _eq: 'report' }, status: { _eq: 'published' },
  });
});

const catalogs = [{ id: 'current-id', name: 'v1.0', isCurrentFrontend: true }, { id: 'old-id', name: 'beta' }];
test('statistics accept dotted catalog names and retain map coordinates through the actual score relation', async () => {
  const transport = cms(() => []);
  const reads: Command[] = [];
  const municipality = { id: 'city', slug: 'city', status: 'published', localteam_id: 'team', name: 'Public city', geolocation: { type: 'Point', coordinates: [13, 52] }, privateNote: 'secret' };
  const route = load('server/api/public/stats/[catalog].get.ts', {
    ...transport.dependencies,
    '../../../utils/municipalityPageData': { readMunicipalityCatalogs: async () => catalogs, publicMeasureFields: ['id', 'name'] },
    '../../../utils/publicItems': { readPublicItems: async (collection: string, query: Row) => {
      reads.push({ collection, query: plain(query) });
      if (collection === 'municipality_scores') return [{ id: 'score', municipality, published: true, percentage_rated: 100, score_total: null, score_max: null, score_points: null, rank: null, score_agriculture: null, score_buildings: null, score_energy: null, score_industry: null, score_management: null, score_transport: null }];
      return collection === 'municipalities' ? [municipality] : [];
    } },
  });
  const result = await route.default({ params: { catalog: 'v1.0' } });
  assert.deepEqual(plain(result.scores[0].municipality.geolocation), municipality.geolocation);
  assert.ok(!JSON.stringify(result).includes('secret'));
  const scoreQuery = reads.find(read => read.collection === 'municipality_scores')!.query;
  assert.ok(scoreQuery.fields.includes('municipality.geolocation'));
  assert.equal(scoreQuery.filter.catalog_version._eq, 'current-id');
  assert.equal(scoreQuery.filter.published._eq, true);
  assert.equal(scoreQuery.filter.municipality.status._eq, 'published');
  assert.ok(!JSON.stringify(scoreQuery).includes('localteam_id.'));
  assert.deepEqual(reads.find(read => read.collection === 'ratings_measures')!.query.filter.localteam_id._in, ['team']);
  await assert.rejects(() => route.default({ params: { catalog: '../private' } }), { statusCode: 400 });
  await assert.rejects(() => route.default({ params: { catalog: 'missing' } }), { statusCode: 404 });
});

test('measure projections select real columns rather than the feasibility interface alias', () => {
  const transport = cms(() => []);
  const { publicMeasureFields } = load('server/utils/municipalityPageData.ts', {
    ...transport.dependencies, './municipalityPreview': { verifyMunicipalityPreview: async () => false },
  });
  // Directus stores this as an interface-only alias, without a data column.
  assert.match(readFileSync(new URL('../../../src/directus/schema/fields/measures/feasibility.yaml', import.meta.url), 'utf8'), /^type: alias$/m);
  assert.ok(!publicMeasureFields.includes('feasibility'));
  assert.ok(publicMeasureFields.includes('feasibility_economical'));
  assert.ok(publicMeasureFields.includes('description_about'));
});

test('area enrichment joins municipality scores, keeps catalog metadata and prefers the requested catalog', async () => {
  const transport = cms(({ collection }) => collection === 'municipalities' ? [{ id: 'city', name: 'City', ars: '110000000001', slug: 'city' }] : [
    { municipality: 'city', published: true, score_total: 40, catalog_version: 'old-id' },
    { municipality: 'city', published: true, score_total: 75, catalog_version: 'current-id' },
  ]);
  const route = load('server/api/public/area-municipalities.get.ts', {
    ...transport.dependencies,
    '../../utils/municipalityPageData': {
      readMunicipalityCatalogs: async () => catalogs,
      catalogForRequest: (_catalogs: Row[], name: string) => catalogs.find(c => c.name === name) ?? catalogs[0],
    },
  });
  const result = await route.default({ query: { slugs: 'city', v: 'v1.0' } });
  assert.deepEqual(plain(result.municipalities[0].scores.map((s: Row) => s.catalog_version.name)), ['v1.0', 'beta']);
  assert.equal(result.municipalities[0].scores[0].score_total, 75);
  const query = transport.commands.find(c => c.collection === 'municipality_scores')!.query;
  assert.deepEqual(query.filter.municipality, { _in: ['city'] });
  assert.equal(query.filter.published._eq, true);
  assert.ok(!('localteam_id' in query.filter));
  await assert.rejects(() => route.default({ query: { ars: 'invalid' } }), { statusCode: 400 });
});

// Use real Vue reactivity; replace only the external SLZ and HTTP transports.
const frontendRequire = createRequire(new URL('../../../src/frontend/package.json', import.meta.url));
const vue = frontendRequire('vue');

function chartHarness(stored: Row, scores: Row[] = []) {
  const transport = cms(() => [{ entity_type: 'pages', entity_uuid: 'page', field_name: 'content' }]);
  const reads: Command[] = [];
  const route = load('server/api/public/chart-data/[uuid].get.ts', {
    ...transport.dependencies, zod: frontendRequire('zod'),
    '../../../../shared/vegaQuery': { defaultVegaQuery: JSON.stringify(stored) },
    '../../../utils/municipalityPageData': { publicMeasureFields: ['id', 'name'] },
    '../../../utils/publicBlocks': { readPublicBlocks: async () => [{ uuid: 'chart', bundle: 'vega_chart', props: { query: JSON.stringify(stored) } }] },
    '../../../utils/publicItems': { readPublicItems: async (collection: string, query: Row) => {
      reads.push({ collection, query: plain(query) }); return collection === 'municipality_scores' ? scores : [{ rating: 0.75 }];
    } },
  });
  return { reads, run: () => route.default({ params: { uuid: 'chart' }, query: { collection: 'directus_users', fields: '*' } }) };
}

test('stored chart queries reject private collections and fields before querying data', async () => {
  for (const stored of [
    { collection: 'directus_users', query: { fields: ['email'] } },
    { collection: 'municipalities', query: { fields: ['preview_token'] } },
    { collection: 'municipality_scores', query: { fields: ['*'] } },
  ]) {
    const harness = chartHarness(stored);
    await assert.rejects(harness.run, { statusCode: 400 });
    assert.equal(harness.reads.length, 0);
  }
});

test('chart ratings join publication coverage to the same catalog and ignore request-supplied queries', async () => {
  const harness = chartHarness({ collection: 'ratings_measures', query: { fields: ['rating'], filter: { rating: { _gte: 0 } }, limit: -1 } }, [
    { catalog_version: 'current-id', municipality: { localteam_id: 'current-team' } },
    { catalog_version: 'old-id', municipality: { localteam_id: 'old-team' } },
  ]);
  assert.deepEqual(plain(await harness.run()), [{ rating: 0.75 }]);
  assert.equal(harness.reads[0]!.query.filter.published._eq, true);
  assert.equal(harness.reads[0]!.query.filter.percentage_rated._gte, 100);
  const filter = harness.reads[1]!.query.filter._and[1];
  assert.equal(filter.status._eq, 'published');
  assert.equal(filter.approved._eq, true);
  assert.deepEqual(filter._or, [
    { measure_id: { catalog_version: { _eq: 'current-id' } }, localteam_id: { _in: ['current-team'] } },
    { measure_id: { catalog_version: { _eq: 'old-id' } }, localteam_id: { _in: ['old-team'] } },
  ]);
  const unpublished = chartHarness({ collection: 'ratings_measures', query: { fields: ['rating'] } });
  assert.deepEqual(plain(await unpublished.run()), []);
  assert.equal(unpublished.reads.length, 1, 'No rating read without published coverage');
});

function areaSearchHarness(scores: Row[], upstreamFails = false) {
  let pending: Promise<void> = Promise.resolve();
  const requests: Row[] = [];
  const area = { name: 'Berlin', ars: '110000000001', level: 2, isReasonableForMunicipalRating: true, stadtlandklimaDataAll: [
    { measureCatalogName: 'v1.0', slug: 'berlin', scoreTotal: 75 }, { measureCatalogName: 'beta', slug: 'berlin', scoreTotal: 40 },
  ] };
  const { useAreaSearch } = load('composables/useAreaSearch.ts', {
    '~/shared/contracts/search': searchContracts,
    vue, lodash: { debounce: (callback: (...args: unknown[]) => Promise<void>) => Object.assign((...args: unknown[]) => { pending = callback(...args); }, { cancel() {} }) },
    '~/shared/utils': { getScorePercentageColor: () => 'rating-3', getStateFromArs: () => 'Berlin' },
    '~/shared/municipality-score-publishing': { isMunicipalityScoreComplete: (score: Row) => score.published === true && Number(score.percentage_rated) >= 100 },
  }, {
    useNuxtApp: () => ({ $stadtlandzahlAPI: { searchAdministrativeAreas: async () => { if (upstreamFails) throw new Error('SLZ unavailable'); return [area]; } } }),
    getAllCatalogVersions: async () => catalogs,
    $fetch: async (path: string, options: Row) => { requests.push({ path, ...plain(options) }); return { municipalities: [{ id: 'city', name: 'Berlin', ars: area.ars, slug: 'berlin', localteam_id: 'team', scores }] }; },
  });
  const catalogId = vue.ref('current-id');
  const catalogName = vue.ref('v1.0');
  const search = useAreaSearch({ statusCatalogVersionId: catalogId, catalogVersionName: catalogName });
  return { search, requests, catalogName, catalogId, run: async () => { search.search('Berlin'); await pending; } };
}

test('area search resolves catalog IDs to names and classifies current and older complete published assessments', async () => {
  const harness = areaSearchHarness([
    { catalog_version: { id: 'old-id', name: 'beta' }, published: true, percentage_rated: 100, score_total: 40 },
    { catalog_version: { id: 'current-id', name: 'v1.0' }, published: true, percentage_rated: 100, score_total: 75 },
  ]);
  await harness.run();
  assert.equal(harness.requests[0]?.query.v, 'v1.0');
  assert.equal(harness.search.results.value[0].ctaType, 'complete');
  assert.equal(harness.search.results.value[0].scoreDisplay, '75%');
  harness.catalogId.value = 'old-id'; harness.catalogName.value = 'beta';
  assert.equal(harness.search.results.value[0].scoreDisplay, '40%', 'Catalog changes reclassify the cached public scores without a second search');
  await harness.run();
  assert.equal(harness.requests[1]?.query.v, 'beta');
  assert.equal(harness.search.results.value[0].scoreDisplay, '40%');
});

test('area search distinguishes outdated, in-progress and unavailable external data without misreporting completion', async () => {
  for (const [scores, expected] of [
    [[{ catalog_version: { id: 'old-id', name: 'beta' }, published: true, percentage_rated: 100 }], 'outdated'],
    [[{ catalog_version: { id: 'current-id', name: 'v1.0' }, published: true, percentage_rated: 50 }], 'in-progress'],
    [[{ catalog_version: { id: 'current-id', name: 'v1.0' }, published: false, percentage_rated: 100 }], 'in-progress'],
  ] as const) {
    const harness = areaSearchHarness([...scores]); await harness.run();
    assert.equal(harness.search.results.value[0].ctaType, expected);
  }
  const unavailable = areaSearchHarness([], true); await unavailable.run();
  assert.equal(unavailable.search.results.value.length, 0);
  assert.equal(unavailable.search.isLoading.value, false);
});


test('site layout reads the navigation singleton, retains nested links and strips private fields', async () => {
  const transport = cms(command => {
    if (command.collection === 'navigation_config') {
      assert.equal((command as Row).singleton, true);
      return {header_items: [{id: 'nav', label: 'Start', link_type: 'page', page_slug: 'start', children: [{id: 'child', label: 'Child', private: 'secret'}]}], footer_columns: []};
    }
    if (command.collection === 'municipalities') return [{id: 'm', name: 'Town', slug: 'town', preview_token: 'secret'}];
    return [{id: 'p', slug: 'start', name: 'Start', contents: null, sort_order: 1, private: 'secret'}];
  });
  const route = load('server/api/public/site-layout.get.ts', transport.dependencies).default;
  const result = plain(await route({}));
  assert.equal(result.navigationConfig.header_items[0].children[0].label, 'Child');
  assert.equal(result.municipalities[0].slug, 'town');
  assert.doesNotMatch(JSON.stringify(result), /secret|private|preview_token/);
});
