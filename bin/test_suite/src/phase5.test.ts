import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { HistogramResponseSchema, BinAreasSchema, legacyHistogramValue } from '../../../src/frontend/shared/contracts/histogram.js';
import { parseGeoData, parseGeoCenter } from '../../../src/frontend/shared/contracts/geometry.js';
import { ContentResponseSchema } from '../../../src/frontend/shared/contracts/search.js';
import { treemapDatum } from '../../../src/frontend/shared/treemap.js';
import { attachVisualizationData, cloneVisualization } from '../../../src/frontend/shared/visualization.js';
import { DataMapSchema } from '../../../src/frontend/shared/contracts/dataMap.js';
import { requestErrorData, requestErrorMessage, captchaEventData } from '../../../src/frontend/shared/requestError.js';

const frontend = createRequire(new URL('../../../src/frontend/package.json', import.meta.url));
// The harness executes the actual SFC script/template with Vue, without a browser/server per assertion.
const vue = frontend('vue') as typeof import('../../../src/frontend/node_modules/vue/dist/vue.js');
const compiler = frontend('@vue/compiler-sfc') as typeof import('../../../src/frontend/node_modules/@vue/compiler-sfc/dist/compiler-sfc.js');
const ssr = frontend('@vue/server-renderer') as typeof import('../../../src/frontend/node_modules/@vue/server-renderer/dist/server-renderer.js');
const componentRoot = new URL('../../../src/frontend/components/', import.meta.url);
function load(name: string, globals: Record<string, unknown> = {}, dependencies: Record<string, unknown> = {}) {
  const { descriptor, errors } = compiler.parse(readFileSync(new URL(name, componentRoot), 'utf8'));
  assert.deepEqual(errors, []);
  const script = compiler.compileScript(descriptor, {id: name, inlineTemplate: true});
  const compiled = ts.transpileModule(script.content.replaceAll('import.meta.glob(', '__viteGlob('), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}});
  const module = {exports: {default: {} as import('../../../src/frontend/node_modules/vue/dist/vue.js').Component}};
  runInNewContext(compiled.outputText, {module, exports: module.exports, URLSearchParams, console, ...vue, __viteGlob: () => ({}),
    useNuxtApp: () => ({$t: (key: string) => key, $locale: 'de-DE'}), useRuntimeConfig: () => ({public: {clientDirectusUrl: 'https://cms.example.org'}}),
    require: (id: string) => { if (id === 'vue') return dependencies.vue ?? vue; assert.ok(id in dependencies, `Unexpected import ${id}`); return dependencies[id]; }, ...globals});
  return module.exports.default;
}
async function render(name: string, props: Record<string, unknown>, globals: Record<string, unknown> = {}, dependencies: Record<string, unknown> = {}) {
  const app = vue.createSSRApp(load(name, globals, dependencies), props);
  app.component('NuxtLink', vue.defineComponent({setup(_props, {slots}) {return () => vue.h('a', {}, slots.default?.())}}));
  app.component('SmartImg', vue.defineComponent({setup() {return () => vue.h('img')}}));
  app.config.globalProperties.$t = (key: string) => key;
  return ssr.renderToString(app);
}

test('every maintained SFC parses and every component script uses TypeScript', () => {
  let count = 0;
  for (const entry of readdirSync(componentRoot, {recursive: true, encoding: 'utf8'})) {
    if (!entry.endsWith('.vue')) continue;
    const {descriptor, errors} = compiler.parse(readFileSync(new URL(entry, componentRoot), 'utf8'));
    assert.deepEqual(errors, [], entry);
    for (const script of [descriptor.script, descriptor.scriptSetup]) if (script) assert.equal(script.lang, 'ts', entry);
    count++;
  }
  assert.ok(count >= 130);
});

test('municipality statistics reads the prop, filters labels and handles missing data', async () => {
  const html = await render('MunicipalityStats.vue', {stats: {name: 'Hidden name', slug: 'hidden-slug', population_total: 123}});
  assert.match(html, /population total/); assert.match(html, /123/); assert.doesNotMatch(html, /Hidden name|hidden-slug/);
  assert.doesNotMatch(await render('MunicipalityStats.vue', {}), /undefined|NaN/);
});

test('progress layout validator returns booleans and preserves runtime defaults', () => {
  const component = load('ProgressBar.vue') as {props: {layout: {validator: (value: string) => boolean; default: string}; showScaleMaximum: {default: boolean}}};
  for (const value of ['default', 'compact']) assert.equal(component.props.layout.validator(value), true);
  assert.equal(component.props.layout.validator('invalid'), false);
  assert.equal(component.props.layout.default, 'default'); assert.equal(component.props.showScaleMaximum.default, true);
});

test('zero progress and zero thresholds produce finite layout positions', async () => {
  const html = await render('ThresholdProgressBar.vue', {progress: 0, orangeThreshold: 0, yellowThreshold: 0, lightGreenThreshold: 0, darkGreenThreshold: 0});
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('boolean filter emits exactly the inverse model value on click', () => {
  const component = load('FilterBadgeBoolean.vue') as {setup: (props: unknown, context: {emit: (event: string, value: boolean) => void}) => () => {props: {onClick: () => void}}};
  for (const modelValue of [false, true]) {
    const events: unknown[] = [];
    const render = component.setup({label: 'Filter', modelValue}, {emit: (event, value) => events.push([event, value])});
    render().props.onClick();
    assert.deepEqual(events, [['update:modelValue', !modelValue]]);
  }
});

test('smart images retain raster transforms, SVG behavior, token scoping and empty state', async () => {
  const deps = {'~/shared/successProjectTour': {TOUR_REPORT_MEDIA: Symbol('report')}};
  const raster = await render('SmartImg.vue', {assetId: 'photo', width: 640, height: 480}, {}, deps);
  assert.match(raster, /assets\/photo\?width=640&amp;height=480&amp;fit=cover/);
  const svg = await render('SmartImg.vue', {assetId: 'logo', width: 640, isRaster: false}, {}, deps);
  assert.match(svg, /src="https:\/\/cms.example.org\/assets\/logo"/); assert.doesNotMatch(svg, /[?&](?:fit|width)=/);
  const report = await render('SmartImg.vue', {assetId: 'private', assetBaseUrl: '/api/tour-media', accessToken: 'limited token'}, {}, deps);
  assert.match(report, /api\/tour-media\/private\?access_token=limited\+token/);
  assert.doesNotMatch(await render('SmartImg.vue', {}, {}, deps), /<img/);
});

test('search accepts actual textual metadata and rejects malformed result shapes', () => {
  const result = ContentResponseSchema.parse({hits: [{id: 'm', type: 'measure', title: 'Measure', url: '/measures/m', meta: 'energy'}]});
  assert.equal(result.hits[0].meta, 'energy');
  assert.equal(ContentResponseSchema.safeParse({hits: [{meta: {unexpected: true}}]}).success, false);
});

test('histograms reject invalid counts, unordered/zero-width bins, nonfinite values and missing edges', () => {
  const valid = {results: [{id: 1, bin_edges: [0, 10, 20], bin_counts: [2, 4]}]};
  assert.equal(HistogramResponseSchema.parse(valid).results[0].bin_counts[1], 4);
  for (const bins of [{bin_edges: [0, 1], bin_counts: [1, 2]}, {bin_edges: [1, 0], bin_counts: [1]}, {bin_edges: [0, 0], bin_counts: [1]}, {bin_edges: [0, Infinity], bin_counts: [1]}, {bin_edges: [0, 1], bin_counts: [-1]}]) assert.equal(HistogramResponseSchema.safeParse({results: [bins]}).success, false);
  assert.equal(BinAreasSchema.parse({areas: [{ars: '1', name: 'Area', value: 0}]}).areas[0].value, 0);
  assert.equal(legacyHistogramValue({product: {value: '12.5'}}, 'product', 'value'), 12.5);
  for (const input of [null, {}, {product: {value: 'broken'}}, {product: {value: null}}]) assert.equal(legacyHistogramValue(input, 'product', 'value'), null);
});

test('geometry parsing accepts API variants and rejects malformed/nonfinite coordinates', () => {
  for (const input of [[10, 51], {lat: 51, lon: 10}, {latitude: 51, longitude: 10}, {type: 'Point', coordinates: [10, 51]}, '{"coordinates":[10,51]}']) assert.deepEqual(parseGeoCenter(input), {lat: 51, lon: 10});
  for (const input of [null, 'bad', [NaN, 51], [10, Infinity], {lat: '51', lon: 10}]) assert.equal(parseGeoCenter(input), null);
  assert.ok(parseGeoData({type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]]}));
  assert.equal(parseGeoData({type: 'Polygon', coordinates: [[[Infinity, 0]]]}), null);
});

test('treemap callback payloads and request errors narrow unknown values safely', () => {
  assert.deepEqual(treemapDatum({_data: {sectorName: 'Energy', children: []}}), {sectorName: 'Energy', children: []});
  for (const value of [null, {}, {_data: {children: [null]}}]) assert.deepEqual(treemapDatum(value), {children: []});
  assert.equal(requestErrorMessage({data: {message: 'Known error'}}, 'Fallback'), 'Known error');
  for (const error of [null, 'failure', {data: {message: {secret: true}}}, {data: []}]) assert.equal(requestErrorMessage(error, 'Fallback'), 'Fallback');
  assert.deepEqual(requestErrorData(null), {});
});


test('named and inline Vega data reach the specification and preserve unrelated datasets', () => {
  const rows = [{value: 3}];
  const spec = cloneVisualization({data: {name: 'source'}, datasets: {other: [{value: 1}]}});
  attachVisualizationData(spec, rows);
  assert.deepEqual(spec.datasets, {source: rows, other: [{value: 1}]});
  const inline = cloneVisualization({data: {url: '/old'}});
  attachVisualizationData(inline, rows);
  assert.deepEqual(inline.data, {values: rows});
  const geometry = {type: 'FeatureCollection', features: []};
  attachVisualizationData(inline, geometry);
  assert.deepEqual(inline.data, {values: geometry});
});

test('map markers preserve coordinates, popups and power classes without rejecting other legend layers', () => {
  const result = DataMapSchema.parse({layers: [{name: 'Points', type: 'markers', data: [{coordinates: [51, 10], properties: {power_kw: 150, popup_content: '<b>Station</b>'}}]}, {name: 'Boundary', type: 'polygon', data: {coordinates: []}}]});
  assert.equal(result.layers.length, 2);
  assert.equal(result.layers[0].data[0].properties?.power_kw, 150);
  assert.deepEqual(result.layers[0].data[0].coordinates, [51, 10]);
  assert.equal(DataMapSchema.parse({center: null, bounds: null, layers: [{name: 'Sparse', type: 'markers', data: [{coordinates: [51, 10]}, {coordinates: [51, 10], properties: {power_kw: '150.5', popup_content: null}}]}]}).layers[0].data[1].properties?.power_kw, 150.5);
  assert.equal(DataMapSchema.safeParse({layers: [{name: 'Bad', type: 'markers', data: [{coordinates: [null, 10]}]}]}).success, false);
});

test('captcha state events accept only string payloads and ignore malformed details', () => {
  assert.deepEqual(captchaEventData({detail: {state: 'verified', payload: 'proof'}} as unknown as Event), {state: 'verified', payload: 'proof'});
  assert.deepEqual(captchaEventData({detail: {state: 'verified', payload: {secret: true}}} as unknown as Event), {state: 'verified'});
  assert.deepEqual(captchaEventData({detail: null} as unknown as Event), {});
});


test('map requests move through loading, ready, error and retry without contradictory visible states', async () => {
  type Exposed = {refetch: () => Promise<void>; loading: {value: boolean}; error: {value: string | null}; mapData: {value: unknown}};
  let exposed: Exposed | undefined;
  let fail = false;
  let release: (() => void) | undefined;
  const component = load('DataProductMap.vue', {
    useCartoBasemap: () => ({attribution: '', subdomains: [], tileUrl: ''}),
    console: {log() {}, warn() {}, error() {}},
    fetch: async () => {await new Promise<void>(resolve => {release = resolve}); return {ok: !fail, status: 503, json: async () => ({layers: []})}},
  }, {vue: {...vue, onMounted() {}}, 'nuxt/app': {useRuntimeConfig: () => ({public: {stadtlandzahlBaseUrl: '/api/slz'}})}, '~/shared/contracts/dataMap': {DataMapSchema}}) as {setup: (props: unknown, ctx: {expose: (value: Exposed) => void}) => unknown};
  component.setup({ars: '1', dataProductType: 'product', areaBounds: null, showLegend: true, height: 'h-64'}, {expose: value => {exposed = value}});
  assert.ok(exposed);
  const state = exposed as Exposed;
  assert.equal(state.loading.value, false);
  for (const error of [false, true, false]) {
    fail = error;
    const request = state.refetch();
    assert.equal(state.loading.value, true); assert.equal(state.error.value, null);
    assert.ok(release); release(); await request;
    assert.equal(state.loading.value, false);
    assert.equal(Boolean(state.error.value), error);
    assert.equal(Boolean(state.mapData.value), !error);
  }
});


test('project cards render both asset IDs and expanded organisation logos as actual asset URLs', async () => {
  const dependencies = {'~/shared/utils': {buildLocationString: () => ''}, '~/shared/projectDate': {formatProjectDate: () => ''}};
  for (const logo of ['logo-id', {id: 'logo-id', type: 'image/svg+xml'}]) {
    const html = await render('ProjectCard.vue', {title: 'Project', organisation: {name: 'Partner', logo}}, {}, dependencies);
    assert.match(html, /src="https:\/\/cms.example.org\/assets\/logo-id"/);
    assert.doesNotMatch(html, /object Object/);
  }
});


test('visualization cloning retains native step widths, multiline titles and opaque Vega expressions', () => {
  const input = {width: {step: 18}, title: ['First', 'Second'], mark: 'bar', encoding: {x: {field: 'category'}}, custom: {expression: 'datum.value'}};
  const copy = cloneVisualization(input);
  assert.deepEqual(copy, input);
  assert.notEqual(copy, input);
  assert.equal(typeof input.width.step, 'number');
  assert.throws(() => cloneVisualization([]));
});


test('each treemap registers its own scales and native grouped/leaf payloads retain measure identities', () => {
  const native = frontend('chart.js') as typeof import('../../../src/frontend/node_modules/chart.js/dist/types.js');
  const treemap = frontend('chartjs-chart-treemap') as typeof import('../../../src/frontend/node_modules/chartjs-chart-treemap/dist/index.esm.js');
  const components = [
    ['MeasuresTreemap.vue', {measures: [], onNavigate: null}],
    ['MunicipalityTreeMap.vue', {ratingsBySector: {}, nameMunicipality: 'Test'}],
  ] as const;
  for (const [name, props] of components) {
    native.Chart.unregister(native.LinearScale);
    const component = load(name, {}, {vue: {...vue, onMounted() {}, onBeforeUnmount() {}}, 'chart.js': native, 'chartjs-chart-treemap': treemap, '~/shared/treemap': {treemapDatum}}) as {setup: (props: unknown, context: {expose: () => void}) => unknown};
    component.setup(props, {expose() {}});
    assert.doesNotThrow(() => native.Chart.registry.getScale('linear'), `${name}: standalone scale registration`);
    const canvas = {width: 600, height: 400, getContext: () => context};
    const context = new Proxy({canvas, measureText: (text: unknown) => ({width: String(text).length * 6})}, {get(target, key) {return key in target ? Reflect.get(target, key) as unknown : () => {}}});
    const rows = ['One', 'Two'].map((measure_name, i) => ({sector: 'energy', sectorName: 'Energy', measure_id: `EN_0${i + 1}`, measure_name, value: i + 1}));
    // The NodeNext harness loads the CJS entry; the frontend gate checks the ESM plugin's augmented config types.
    const chart = Reflect.construct(native.Chart, [canvas, {type: 'treemap', data: {datasets: [{data: [], tree: rows, key: 'value', groups: ['sectorName', 'measure_name']}]}, options: {responsive: false, animation: false, plugins: {legend: {display: false}}}, platform: native.BasicPlatform}]) as InstanceType<typeof native.Chart>;
    try {
      const points = chart.data.datasets[0].data;
      assert.ok(Array.isArray(points));
      assert.equal(points.length, 3);
      for (const point of points) assert.ok(treemapDatum(point).children.every(child => child.measure_id && child.measure_name));
      assert.equal(treemapDatum(points[0]).children.length, 2);
    } finally {chart.destroy()}
  }
  native.Chart.unregister(native.LinearScale, treemap.TreemapController, treemap.TreemapElement);
});


test('CanonicalButton forwards a typed native click exactly once with disabled and link attributes intact', () => {
  let clicks = 0;
  const event = {type: 'click'} as MouseEvent;
  const component = load('CanonicalButton.vue', {}, {
    vue: {...vue, useAttrs: () => ({'data-test': 'action'})},
    '@iconify/vue': {Icon: {}},
  }) as {setup: (props: unknown, context: unknown) => (context: unknown, cache: unknown[]) => {props: Record<string, unknown>}};
  const props = {label: 'Action', disabled: true, href: 'https://example.org', external: true,
    onClick: (received: MouseEvent) => {assert.equal(received, event); clicks++;}};
  const vnode = component.setup(props, {})(props, []);
  assert.equal(vnode.props.disabled, true);
  assert.equal(vnode.props.href, 'https://example.org');
  assert.equal(vnode.props.rel, 'noopener noreferrer');
  assert.equal(vnode.props['data-test'], 'action');
  (vnode.props.onClick as (event: MouseEvent) => void)(event);
  assert.equal(clicks, 1);
});
