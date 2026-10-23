import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('typecheck gate rejects every diagnostic, tool failure and legacy baseline argument', () => {
  const directory = mkdtempSync(join(tmpdir(), 'slk-typecheck-gate-'));
  try {
    copyFileSync(new URL('../../../src/frontend/typecheck.sh', import.meta.url), join(directory, 'typecheck.sh'));
    writeFileSync(join(directory, 'npm'), `#!/usr/bin/env bash
if [[ "$*" == *'nuxt prepare'* ]]; then exit "\${PREPARE_STATUS:-0}"; fi
if [[ "$*" == *'tsconfig.components.json'* ]]; then exit "\${TEMPLATE_STATUS:-0}"; fi
printf '%s' "$CHECKER_REPORT"
exit "$CHECKER_STATUS"
`, { mode: 0o755 });
    const run = (report: string, status: number, args: string[] = [], prepareStatus = 0, templateStatus = 0) => spawnSync('bash', [join(directory, 'typecheck.sh'), ...args], {
      encoding: 'utf8', env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, CHECKER_REPORT: report, CHECKER_STATUS: String(status), PREPARE_STATUS: String(prepareStatus), TEMPLATE_STATUS: String(templateStatus) },
    });
    assert.equal(run('', 0).status, 0);
    for (const file of ['shared/old.ts', 'components/Invalid.vue', 'pages/Invalid.vue']) {
      assert.equal(run(`${file}(1,1): error TS2322: Invalid value\n`, 2).status, 2);
    }
    assert.equal(run('', 1).status, 1);
    assert.equal(run('Error: compiler crashed\n', 1).status, 1);
    assert.equal(run('partial report', 137).status, 137);
    assert.equal(run('', 0, [], 73).status, 73);
    assert.equal(run('', 0, [], 0, 2).status, 2);
    assert.equal(run('', 0, ['--update-baseline']).status, 64);
    assert.equal(run('', 0, ['--bad-option']).status, 64);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
