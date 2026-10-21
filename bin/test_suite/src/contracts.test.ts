import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { JobsListResponseSchema, JobsDetailResponseSchema } from '../../../src/frontend/shared/contracts/jobs.js';
import { CandidateAnswersRequestSchema } from '../../../src/frontend/shared/contracts/candidateAnswers.js';
import { getBerlinEndOfDay } from '../../../src/frontend/shared/eventDateTime.js';

const organisation = { id: 1, name: 'Public org', link: null, logo: { id: randomUUID(), type: null, privateNote: 'secret' }, privateEmail: 'secret' };
const job = { id: randomUUID(), slug: 'job', role_title: 'Role', type: 'full_time', start_date: null, end_date: null, weekly_hours: null, salary: null, hourly_wage: null, organisation };

function jobsRoute(detail: boolean, rows: unknown[], slug = 'job') {
  const path = detail ? '../../../src/frontend/server/api/public/jobs/[slug].get.ts' : '../../../src/frontend/server/api/public/jobs.get.ts';
  const module = { exports: {} as { default: (event: object) => Promise<unknown> } };
  const queries: unknown[] = [];
  const dependencies: Record<string, unknown> = {
    '@directus/sdk': { readItems: (_collection: string, query: unknown) => { queries.push(query); return query; } },
    h3: {
      defineEventHandler: (handler: unknown) => handler, setResponseHeader: () => {}, getRouterParam: () => slug,
      createError: (options: object) => Object.assign(new Error('Controlled API failure'), options),
    },
    '~/shared/contracts/jobs': { JobsListResponseSchema, JobsDetailResponseSchema },
  };
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(compiled.outputText, { module, exports: module.exports, require: (id: string) => {
    if (id.endsWith('/utils/directusServerClient')) return { createTypedDirectusServerClient: () => ({ request: async () => rows }) };
    assert.ok(id in dependencies, `Unexpected route dependency: ${id}`);
    return dependencies[id];
  } });
  return { run: () => module.exports.default({}), queries };
}

test('actual jobs handlers project nested fields, restrict publication and return an empty list', async () => {
  const list = jobsRoute(false, [{ ...job, privateNotes: 'secret' }]);
  assert.ok(!JSON.stringify(await list.run()).includes('secret'));
  assert.match(JSON.stringify(list.queries), /"status":\{"_eq":"published"\}/);
  assert.ok(!JSON.stringify(list.queries).includes('"*"'));
  assert.deepEqual(JSON.parse(JSON.stringify(await jobsRoute(false, []).run())), { jobs: [] });
  const sparse = JobsDetailResponseSchema.parse(await jobsRoute(true, [{ ...job, organisation: null }]).run());
  assert.equal(sparse.organisation, null);
  assert.equal(sparse.job.organisation, null);
  const detail = jobsRoute(true, [{ ...job, tasks: null, qualifications: null, benefits: null, contact_notes: null, application_url: null }]);
  assert.ok(!JSON.stringify(await detail.run()).includes('secret'));
});

test('actual jobs handlers reject invalid upstream data and missing/invalid slugs with controlled errors', async () => {
  for (const detail of [false, true]) {
    await assert.rejects(jobsRoute(detail, [{ ...job, role_title: null }]).run, { statusCode: 502 });
  }
  await assert.rejects(jobsRoute(true, []).run, { statusCode: 404 });
  const invalidSlug = jobsRoute(true, [job], 'invalid/slug');
  await assert.rejects(invalidSlug.run, { statusCode: 404 });
  assert.equal(invalidSlug.queries.length, 0, 'Invalid slug must not be sent to the CMS');
});

test('jobs response strips private fields at every relation level', () => {
  const list = JobsListResponseSchema.parse({ jobs: [{ ...job, internalNotes: 'secret' }], token: 'secret' });
  assert.ok(!JSON.stringify(list).includes('secret'));
  const detail = JobsDetailResponseSchema.parse({ job: { ...job, tasks: null, qualifications: null, benefits: null, contact_notes: null, application_url: null, internalNotes: 'secret' }, organisation });
  assert.ok(!JSON.stringify(detail).includes('secret'));
});

test('jobs accepts empty lists and missing optional content, rejects invalid CMS types', () => {
  assert.deepEqual(JobsListResponseSchema.parse({ jobs: [] }), { jobs: [] });
  assert.equal(JobsListResponseSchema.parse({ jobs: [{ ...job, organisation: null }] }).jobs[0]?.organisation, null);
  for (const patch of [{ type: 'invalid' }, { id: 123 }, { role_title: null }, { organisation: { ...organisation, id: '1' } }]) {
    assert.equal(JobsListResponseSchema.safeParse({ jobs: [{ ...job, ...patch }] }).success, false);
  }
});

test('candidate writes accept exactly integer scores 0–4 and explicit null clearing', () => {
  for (const response of [0, 1, 2, 3, 4, null]) {
    assert.ok(CandidateAnswersRequestSchema.safeParse({ answers: [{ question: randomUUID(), response }] }).success);
  }
  for (const response of [-1, 5, 1.5, '2', true, undefined]) {
    assert.equal(CandidateAnswersRequestSchema.safeParse({ answers: [{ question: randomUUID(), response }] }).success, false);
  }
});

test('candidate writes reject forged fields, duplicate questions and oversized batches/explanations', () => {
  const answer = { question: randomUUID(), response: 1 };
  for (const body of [
    { answers: [answer], candidateId: randomUUID() },
    { answers: [{ ...answer, candidate: randomUUID() }] },
    { answers: [answer, answer] }, { answers: [] },
    { answers: [{ ...answer, explanation: 'x'.repeat(501) }] },
    { answers: Array.from({ length: 101 }, () => ({ ...answer, question: randomUUID() })) },
  ]) assert.equal(CandidateAnswersRequestSchema.safeParse(body).success, false);
});

test('candidate deadlines use Berlin end of day across summer and winter time', () => {
  assert.equal(getBerlinEndOfDay('2026-07-01')?.toISOString(), '2026-07-01T21:59:59.999Z');
  assert.equal(getBerlinEndOfDay('2026-12-01')?.toISOString(), '2026-12-01T22:59:59.999Z');
});
