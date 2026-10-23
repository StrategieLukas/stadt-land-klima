import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createHmac} from 'node:crypto';
import ts from 'typescript';

const root = new URL('../../../', import.meta.url);
const frontend = createRequire(new URL('src/frontend/package.json', root));
type Row = Record<string, any>;
const h3 = {...frontend('h3'), defineEventHandler: (fn: unknown) => fn,
  createError: (options: Row) => Object.assign(new Error('Controlled failure'), options),
  getHeader: (event: Row, name: string) => event.headers?.[name], setResponseHeader() {}, setResponseStatus() {}};
function load(path: string, deps: Row = {}, globals: Row = {}, extra = ''): Row {
  const source = readFileSync(new URL(path, root), 'utf8') + extra;
  const module = {exports: {}};
  runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {
    module, exports: module.exports, Buffer, URL, URLSearchParams, Date, setTimeout, clearTimeout, console, process: {env: {}},
    require: (id: string) => id in deps ? deps[id] : id === 'h3' ? h3 : frontend(id), ...globals,
  });
  return module.exports;
}
const utility = (path: string, deps: Row = {}, globals: Row = {}) => load('src/frontend/server/utils/' + path, deps, globals);

test('CMS sanitizer works without a DOM, preserves formatting, and removes active HTML and hostile URLs', () => {
  const {sanitizeHtml, sanitizeText} = load('src/frontend/utils/sanitizeHtml.ts');
  for (const dirty of ['<img src=x onerror="alert(1)">', '<svg><a xlink:href="javascript:alert(1)">x</a></svg>', '<iframe srcdoc="<script>alert(1)</script>"></iframe>', '<a href="java&#x73;cript:alert(1)">link</a>', '<xmp><img src=x onerror=alert(1)></xmp>', '<span style="background:url(https://evil.org);position:fixed">safe</span>']) {
    const result = sanitizeHtml(dirty);
    assert.doesNotMatch(result, /onerror|<svg|<iframe|javascript:|<xmp|url\(|position:/i, dirty);
  }
  const safe = sanitizeHtml('<h2>Grüße</h2><span style="color:#afca0b;text-align:center">Hello</span><a href="https://example.org" target="_blank">link</a>');
  assert.match(safe, /<h2>Grüße<\/h2>/); assert.match(safe, /color:#afca0b/); assert.match(safe, /noopener noreferrer/);
  assert.equal(sanitizeText('<b>A &amp; B</b><script>secret</script>'), 'A & B');
  assert.equal(sanitizeHtml(undefined), '');
});

test('signed math challenges reject missing, expired, future, cross-purpose, malformed and incorrect answers, including development', async () => {
  const {verifyMathChallenge} = utility('verifyMathChallenge.ts', {'./abuseProtection': {DEVELOPMENT_CAPTCHA_SECRET: 'dev-secret-change-in-production'}});
  const key = 'a'.repeat(64);
  const token = (purpose = 'contact', timestamp = Date.now()) => {
    const signed = `${JSON.stringify({num1: 12, num2: 7, purpose})}:${timestamp}`;
    return Buffer.from(`${signed}:${createHmac('sha256', key).update(signed).digest('hex')}`).toString('base64');
  };
  assert.equal(await verifyMathChallenge(token(), '19', key, 'contact', false), true);
  for (const [proof, answer, purpose] of [[token(), '18', 'contact'], [token(), '19evil', 'contact'], [token(), '19', 'form'], [token('contact', Date.now() + 60000), '19', 'contact'], [token('contact', Date.now() - 1200001), '19', 'contact'], ['', '19', 'contact'], [token('unknown'), '19', 'contact']]) {
    assert.equal(await verifyMathChallenge(proof, answer, key, purpose, false), false);
    assert.equal(await verifyMathChallenge(proof, answer, key, purpose, true), false);
  }
});

test('request limits reject concurrent excess, fail closed for writes/PDF, bound degraded reads and ignore forged proxy headers', async () => {
  let count = 0; let down = false;
  const env: Row = {};
  const {rateLimit, requestPeer} = utility('rateLimit.ts', {
    './rateLimitConfig': {getRateLimitPreset: () => ({max: 3, windowSeconds: 60})},
    './protectionRedis': {withProtectionRedis: async (operation: (redis: Row) => Promise<unknown>) => {
      if (down) throw new Error('offline');
      return operation({eval: async (_script: string, command: Row) => ++count <= Number(command.arguments[1]) ? 1 : 0});
    }},
  }, {process: {env}});
  const event = {method: 'GET', node: {req: {socket: {remoteAddress: '::ffff:192.0.2.1'}, headers: {'x-real-ip': '198.51.100.4'}}}};
  assert.equal(requestPeer(event), '192.0.2.1');
  env.TRUST_PROXY = 'true'; env.SLK_ENV = 'production'; assert.equal(requestPeer(event), '198.51.100.4');
  assert.equal((await Promise.all(Array.from({length: 20}, () => rateLimit(event, 'test')))).filter(Boolean).length, 3);
  down = true;
  await assert.rejects(rateLimit({...event, method: 'POST'}, 'test'), {statusCode: 503});
  await assert.rejects(rateLimit(event, 'election-pdf'), {statusCode: 503});
  for (let i = 0; i < 4; i++) assert.equal(await rateLimit(event, 'read-test'), i < 3);
});

test('generic submissions use a published form contract, reject forged field names, and apply trusted routing and delivery quotas', async () => {
  const {GenericFormRequestSchema} = frontend('./shared/contracts/submissions.ts');
  let writes = 0; let stored: Row = {}; let quotas = 0;
  const definition = {formKey: 'trusted', formTitle: 'Trusted', notificationEmail: 'owner@example.org', sendCopy: false, fields: [{name: 'message', label: 'Message', type: 'textarea', required: true}]};
  const handler = load('src/frontend/server/api/submit-form-response.post.ts', {
    '~/shared/contracts/submissions': {GenericFormRequestSchema},
    '../utils/publishedForm': {publishedForm: async (_type: string, _id: string, uuid: string) => {if (uuid !== 'real-form') throw Object.assign(new Error(), {statusCode: 404}); return definition;}},
    '../utils/formDeliveryQuota': {formDeliveryQuota: async () => {quotas++;}},
    '../utils/abuseProtection': {abuseProtection: () => ({hmacKey: 'secret', devMode: false})},
    '../utils/readRequestBody': {readRequestBody: async (event: Row) => event.body},
    '../utils/verifyAltcha': {verifyAltcha: async () => true}, '../utils/verifyMathChallenge': {verifyMathChallenge: async () => true},
    '../utils/rateLimit': {rateLimit: async () => true},
  }, {...h3, useRuntimeConfig: () => ({directusAdminToken: 'private'}), $fetch: async (_url: string, options: Row) => {writes++; stored = options.body; return {data: {id: 1, status: 'received'}};}}).default;
  const body = {formUuid: 'real-form', entityType: 'pages', entityUuid: 'owner', notificationEmail: 'attacker@example.org', sendCopy: true,
    formTitle: 'Forged', fields: [{name: 'forged', label: 'Forged', type: 'text'}], values: {message: '<img src=x onerror=alert(1)>'}, altcha: 'proof', mathChallenge: {token: 'proof', answer: '20'}};
  await handler({body}); assert.equal(writes, 1); assert.equal(quotas, 1);
  assert.equal(stored.notification_email, 'owner@example.org'); assert.equal(stored.form_title, 'Trusted'); assert.equal(stored.send_copy, false);
  assert.equal(stored.response_data.fields[0].name, 'message');
  await assert.rejects(handler({body: {...body, values: {unknown: 'forged'}}}), {statusCode: 400});
  await assert.rejects(handler({body: {...body, formUuid: 'unpublished'}}), {statusCode: 404}); assert.equal(writes, 1);
});

test('published form lookup traverses checked nested blocks and rejects unpublished owners and nonexistent forms', async () => {
  const blocks = [{uuid: 'container', bundle: 'container', props: {blocks: [{uuid: 'nested', bundle: 'form', options: {notificationEmail: 'owner@example.org'}, props: {title: 'Form', fields: [{uuid: 'field', bundle: 'form_field', options: {fieldName: 'Email', fieldType: 'email', required: true}, props: {label: [{uuid: 'label', bundle: 'form_label', props: {text: 'Email'}}]}}]}}]}}];
  const {publishedForm} = utility('publishedForm.ts', {
    '~/shared/editorBlocks': frontend('./shared/editorBlocks.ts'),
    './publicBlocks': {readPublicBlocks: async (_type: string, id: string) => {if (id === 'draft') throw Object.assign(new Error(), {statusCode: 404}); return blocks;}},
  });
  const form = await publishedForm('pages', 'owner', 'nested');
  assert.equal(form.notificationEmail, 'owner@example.org'); assert.equal(form.fields[0].name, 'email'); assert.equal(form.fields[0].required, true);
  await assert.rejects(publishedForm('pages', 'owner', 'missing'), {statusCode: 404});
  await assert.rejects(publishedForm('pages', 'draft', 'nested'), {statusCode: 404});
});

test('candidate sessions use encrypted HttpOnly cookies with no header override and enforce origin plus constant-time CSRF checks', async () => {
  let options: Row = {};
  const {candidateSession, candidateMutationOrigin, validCandidateCsrf} = utility('candidateSession.ts', {
    h3: {...h3, useSession: async (_event: unknown, config: Row) => {options = config; return {data: {}};}},
    './abuseProtection': {abuseProtection: () => ({hmacKey: 'a'.repeat(64), devMode: false})},
  }, {useRuntimeConfig: () => ({appPublicUrl: 'https://example.org', candidateSessionSecret: ''})});
  await candidateSession({}); assert.equal(options.sessionHeader, false); assert.equal(options.cookie.httpOnly, true); assert.equal(options.cookie.secure, true); assert.equal(options.cookie.sameSite, 'strict'); assert.equal(options.cookie.path, '/api/candidate');
  const headers = {'x-slk-candidate': '1', origin: 'https://example.org', host: 'example.org', 'sec-fetch-site': 'same-origin'};
  candidateMutationOrigin({headers});
  for (const changed of [{'x-slk-candidate': ''}, {origin: 'https://evil.org'}, {'sec-fetch-site': 'cross-site'}]) assert.throws(() => candidateMutationOrigin({headers: {...headers, ...changed}}), {statusCode: 403});
  assert.equal(validCandidateCsrf('a'.repeat(64), 'a'.repeat(64)), true);
  for (const value of [undefined, 'a', 'b'.repeat(64)]) assert.equal(validCandidateCsrf(value, 'a'.repeat(64)), false);
});

test('CSP reports never log document URLs, blocked URLs, script samples or unbounded directive keys', async () => {
  const logs: string[] = [];
  let now = 0;
  const handler = load('src/frontend/server/api/security/csp.post.ts', {
    '../../utils/readRequestBody': {readRequestBody: async (event: Row) => event.body}, '../../utils/rateLimit': {rateLimit: async () => true},
  }, {Date: {now: () => now}, console: {info: (...args: unknown[]) => logs.push(JSON.stringify(args))}}).default;
  now = 61000;
  await handler({body: {'csp-report': {'effective-directive': 'script-src-elem', 'document-uri': 'https://example.org/private-token', 'blocked-uri': 'https://evil.org/secret', 'script-sample': 'private text'}}});
  assert.match(logs.join(), /script-src-elem/); assert.doesNotMatch(logs.join(), /private|secret|evil\.org/);
});

test('search cleanup removes UUID and legacy-slug children before deletion and excludes every nonpublished block', async () => {
  const removed: string[] = []; const added: Row[] = [];
  const actions = new Map<string, Function[]>(); const filters = new Map<string, Function>();
  const page = {id: '12345678-1234-4234-8234-123456789abc', slug: 'example', name: 'Example', status: 'draft'};
  const rows: Row = {pages: [page], blocks: [
    {id: 1, uuid: 'block-uuid', entity_uuid: page.id, entity_type: 'pages', field_name: 'content', bundle: 'heading', props: {text: 'Private'}, status: 'draft'},
    {id: 2, uuid: 'legacy-block', entity_uuid: page.slug, entity_type: 'pages', field_name: 'content', bundle: 'heading', props: {text: 'Legacy'}, status: 'published'},
  ]};
  const database = (table: string) => {
    let tests: ((row: Row) => boolean)[] = [];
    const builder: Row = {
      where(field: string | Function, value?: unknown) {if (typeof field === 'function') field(builder); else tests.push(row => row[field] === value); return builder;},
      orWhere(field: string, value: unknown) {const previous = tests.pop()!; tests.push(row => previous(row) || row[field] === value); return builder;},
      whereIn(field: string, values: unknown[]) {tests.push(row => values.includes(row[field])); return builder;},
      select() {return builder;}, limit() {return builder;},
      then(resolve: Function, reject: Function) {return Promise.resolve(rows[table].filter((row: Row) => tests.every(test => test(row)))).then(resolve as any, reject as any);},
    }; return builder;
  };
  const hook = load('src/directus/extensions/hook-search-index/src/index.ts', {meilisearch: {Meilisearch: class {
    index() {return {addDocuments: async (docs: Row[]) => added.push(...docs), deleteDocument: async (id: string) => removed.push(id)};}
  }}}).default;
  hook({action: (event: string, handler: Function) => actions.set(event, [...(actions.get(event) || []), handler]), filter: (event: string, handler: Function) => filters.set(event, handler)}, {env: {}, logger: {error: assert.fail, warn() {}}, emitter: {onAction() {}}});
  for (const fn of actions.get('items.update')!) await fn({collection: 'pages', keys: [page.id]}, {database});
  assert.ok(removed.includes('page:example')); assert.ok(removed.includes('block_block-uuid')); assert.ok(removed.includes('block_legacy-block'));
  removed.length = 0;
  await filters.get('items.delete')!([page.id], {collection: 'pages'}, {database});
  assert.ok(removed.includes('page:example')); assert.ok(removed.includes('block_block-uuid')); assert.ok(removed.includes('block_legacy-block'));
  removed.length = 0; await filters.get('items.delete')!([1], {collection: 'blocks'}, {database}); assert.deepEqual(removed, ['block_block-uuid']);
  page.status = 'published'; removed.length = 0;
  for (const fn of actions.get('items.update')!) await fn({collection: 'blocks', keys: [1]}, {database});
  assert.ok(removed.includes('block_block-uuid')); assert.equal(added.length, 0);
  for (const fn of actions.get('items.update')!) await fn({collection: 'pages', keys: [page.id]}, {database});
  assert.ok(added.some(doc => doc.id === 'block_legacy-block'), 'republishing restores published child results');
});

test('PDF compilation passes a native kill timeout and bounded binary buffers to execFile', async () => {
  let captured: Row = {};
  const extension = load('src/directus/extensions/endpoint-pdf-service/src/index.ts', {
    child_process: {execFile: (...args: unknown[]) => {captured = args[2] as Row; const callback = args[3] as Function; callback(null, Buffer.from('%PDF-fixture'), Buffer.alloc(0));}},
    util: {promisify: (fn: Function) => (...args: unknown[]) => new Promise((resolve, reject) => fn(...args, (error: Error | null, stdout: Buffer, stderr: Buffer) => error ? reject(error) : resolve({stdout, stderr})))},
    'html-to-text': {convert: (value: unknown) => value},
  }, {}, '\nexports.compilePdfForTest = compilePdf;');
  const pdf = await extension.compilePdfForTest('/tmp/source.typ', '/tmp', '/tmp', {});
  assert.equal(pdf.toString(), '%PDF-fixture'); assert.equal(captured.timeout, 30000); assert.equal(captured.killSignal, 'SIGKILL'); assert.equal(captured.maxBuffer, 50 * 1024 * 1024); assert.equal(captured.encoding, 'buffer');
});

test('notification flow escapes every submitted HTML value before rendering either email', async () => {
  const yaml = frontend('yaml');
  const flow = yaml.parse(readFileSync(new URL('src/directus/flows/notifyNewFormResponse.yaml', root), 'utf8'));
  const operation = flow.operations.find((op: Row) => op.key === flow.operation_key);
  const module = {exports: null as unknown};
  runInNewContext(operation.options.code, {module});
  const transform = module.exports as (data: unknown) => Promise<Row>;
  const safe = await transform({$trigger: {payload: {form_title: '<img src=x onerror=alert(1)>', response_summary: '<script>evil</script>', page_path: '&"'}}});
  assert.doesNotMatch(JSON.stringify(safe), /<img|<script>/); assert.match(safe.response_summary, /&lt;script&gt;/);
  for (const mail of flow.operations.filter((op: Row) => op.type === 'mail')) {
    assert.doesNotMatch(mail.options.body, /\$trigger\.payload/); assert.match(mail.options.body, /escape_form_response_html/);
  }
});

test('core data cutover preserves old clusters, refuses missing/colliding paths, and rolls back a partial move failure', async () => {
  const {mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync} = await import('node:fs');
  const {tmpdir} = await import('node:os'); const {join} = await import('node:path'); const {spawnSync} = await import('node:child_process');
  const script = new URL('bin/lib/core-data-cutover.sh', root).pathname;
  const fixture = () => {const dir = mkdtempSync(join(tmpdir(), 'slk-cutover-')); for (const name of ['db', 'meilisearch']) for (const suffix of ['', '.upgrade-test']) {mkdirSync(join(dir, name + suffix)); writeFileSync(join(dir, name + suffix, suffix ? 'new' : 'old'), 'fixture');} return dir;};
  let dir = fixture();
  try {
    assert.equal(spawnSync('sh', [script, 'test', dir]).status, 0);
    for (const name of ['db', 'meilisearch']) {assert.ok(existsSync(join(dir, name, 'new'))); assert.ok(existsSync(join(dir, name + '.before-test', 'old')));}
    assert.notEqual(spawnSync('sh', [script, 'test', dir]).status, 0);
  } finally {rmSync(dir, {recursive: true, force: true});}
  dir = fixture();
  try {
    rmSync(join(dir, 'meilisearch.upgrade-test'), {recursive: true});
    assert.notEqual(spawnSync('sh', [script, 'test', dir]).status, 0); assert.ok(existsSync(join(dir, 'db', 'old')));
  } finally {rmSync(dir, {recursive: true, force: true});}
  dir = fixture();
  try {
    const commands = join(dir, 'commands'); mkdirSync(commands);
    const marker = join(dir, 'failed');
    writeFileSync(join(commands, 'mv'), `#!/bin/sh\ncase "$1" in *meilisearch.upgrade-test) if [ ! -e '${marker}' ]; then touch '${marker}'; exit 42; fi;; esac\nexec /bin/mv "$@"\n`, {mode: 0o755});
    const result = spawnSync('sh', [script, 'test', dir], {env: {...process.env, PATH: commands + ':' + process.env.PATH}});
    assert.equal(result.status, 42);
    for (const name of ['db', 'meilisearch']) {assert.ok(existsSync(join(dir, name, 'old'))); assert.ok(existsSync(join(dir, name + '.upgrade-test', 'new')));}
  } finally {rmSync(dir, {recursive: true, force: true});}
});

test('core startup guard refuses old data and migration rejects unsupported mounts before stopping or writing', async () => {
  const {mkdtempSync, writeFileSync, rmSync} = await import('node:fs'); const {tmpdir} = await import('node:os');
  const {join} = await import('node:path'); const {spawnSync} = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'slk-core-guard-')); const log = join(dir, 'calls');
  try {
    writeFileSync(join(dir, 'docker'), `#!/usr/bin/env python3
import os,sys,json
args=sys.argv[1:]
with open(os.environ['SLK_TEST_CALLS'],'a') as f: f.write(json.dumps(args)+'\\n')
if args[0]=='compose':
 if 'config' in args: print('postgis/postgis:17-3.6\\ngetmeili/meilisearch:v1.55.0')
 elif 'ps' in args: print(args[-1]+'-fixture')
elif args[0]=='inspect':
 if '.Mounts' in args[-1]: print(os.environ.get('SLK_TEST_MOUNT','bind')+'|/fixture/data|fixture-volume')
 else: print('fixture-image')
elif args[0]=='run':
 print(os.environ.get('SLK_TEST_PG','17') if args[-1]=='PG_VERSION' else '1.55.0')
else: sys.exit('Unexpected Docker operation')
`, {mode: 0o755});
    const env = {...process.env, PATH: dir + ':' + process.env.PATH, SLK_TEST_CALLS: log};
    const guard = new URL('bin/check_core_service_data.sh', root).pathname;
    assert.equal(spawnSync('bash', [guard, 'production'], {env}).status, 0);
    assert.equal(spawnSync('bash', [guard, 'production'], {env: {...env, SLK_TEST_PG: '13'}}).status, 1);
    assert.equal(spawnSync('bash', [guard, 'unknown'], {env}).status, 2);
    const migration = new URL('bin/upgrade_core_services.sh', root).pathname;
    const rejected = spawnSync('bash', [migration, 'production', '--apply'], {env: {...env, SLK_TEST_MOUNT: 'volume'}, encoding: 'utf8'});
    assert.equal(rejected.status, 1); assert.match(rejected.stderr, /requires bind mounts/);
    assert.doesNotMatch(readFileSync(log, 'utf8'), /"(?:stop|start|pull|exec|cp|rm)"/);
  } finally {rmSync(dir, {recursive: true, force: true});}
});

test('static SVG icons retain geometry while dropping scripts, event handlers, foreign HTML and external references', () => {
  const {sanitizeSvg} = load('src/frontend/utils/sanitizeHtml.ts');
  const result = sanitizeSvg('<svg viewBox="0 0 24 24" onload="evil()"><path d="M0 0" fill="currentColor"/><script>evil()</script><foreignObject><img src=x onerror=evil()></foreignObject><use href="https://evil.org/icon"/><path fill="url(https://evil.org)" d="M1 1"/></svg>');
  assert.match(result, /viewBox="0 0 24 24"/); assert.match(result, /fill="currentColor"/);
  assert.doesNotMatch(result, /onload|script|foreignObject|onerror|<use|https:\/\/evil/);
});

test('form delivery quotas hash recipients, reserve global/form/copy budgets and fail closed on denial or Redis failure', async () => {
  let state: 'allow' | 'deny' | 'down' = 'allow'; let command: Row = {};
  const {formDeliveryQuota} = utility('formDeliveryQuota.ts', {'./protectionRedis': {
    withProtectionRedis: async (operation: Function) => {
      if (state === 'down') throw new Error('offline');
      return operation({eval: async (_script: string, options: Row) => {command = options; return state === 'allow' ? 1 : 0;}});
    },
  }});
  await formDeliveryQuota('published-owner:real-form', 'person@example.org');
  assert.equal(command.keys.length, 3); assert.deepEqual(Array.from(command.arguments), ['200', '50', '5']);
  assert.doesNotMatch(JSON.stringify(command.keys), /person|example\.org|published-owner/);
  state = 'deny'; await assert.rejects(formDeliveryQuota('form'), {statusCode: 429});
  state = 'down'; await assert.rejects(formDeliveryQuota('form'), {statusCode: 503});
});

test('translated rich text keeps markup while rejecting executable CMS text and interpolated municipality names', () => {
  const createTranslator = frontend('./shared/createTranslator.ts').default;
  const {sanitizeHtml} = load('src/frontend/utils/sanitizeHtml.ts');
  const {t} = createTranslator([{key: 'localteam.register.onboarding.body', value: '<strong>:name</strong><img src=x onerror="evil()">'}]);
  const result = sanitizeHtml(t('localteam.register.onboarding.body', {':name': '<svg onload="evil()">City</svg>'}));
  assert.match(result, /<strong>City<\/strong>/); assert.doesNotMatch(result, /onerror|onload|<svg/);
});
