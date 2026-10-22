import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('typecheck gate blocks new diagnostics and tool failures; baseline refresh preserves prior data on failure', () => {
  const directory = mkdtempSync(join(tmpdir(), 'slk-typecheck-gate-'));
  const baseline = 'shared/old.ts(1,1): error TS2322\n';
  const oldError = 'shared/old.ts(1,1): error TS2322: Existing error\n';
  try {
    copyFileSync(new URL('../../../src/frontend/typecheck.sh', import.meta.url), join(directory, 'typecheck.sh'));
    writeFileSync(join(directory, '.ts-baseline.txt'), baseline);
    writeFileSync(join(directory, 'npm'), `#!/usr/bin/env bash
if [[ "$*" == *'nuxt prepare'* ]]; then exit "\${PREPARE_STATUS:-0}"; fi
printf '%s' "$CHECKER_REPORT"
exit "$CHECKER_STATUS"
`, { mode: 0o755 });
    const run = (report: string, status: number, args: string[] = [], prepareStatus = 0) => spawnSync('bash', [join(directory, 'typecheck.sh'), ...args], {
      encoding: 'utf8', env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, CHECKER_REPORT: report, CHECKER_STATUS: String(status), PREPARE_STATUS: String(prepareStatus) },
    });
    assert.equal(run(oldError, 2).status, 0);
    assert.equal(run('', 0).status, 0);
    assert.equal(run(`${oldError}shared/new.ts(2,1): error TS2322: New error\n`, 2).status, 1);
    assert.equal(run('', 1).status, 1);
    assert.equal(run(`${oldError}Error: compiler crashed\n`, 1).status, 1);
    assert.equal(run(oldError, 137).status, 137, 'An interrupted compiler cannot pass using partial old diagnostics');
    assert.equal(run(oldError, 2, [], 73).status, 73);
    assert.equal(run('Error: compiler crashed\n', 1, ['--update-baseline']).status, 1);
    assert.equal(readFileSync(join(directory, '.ts-baseline.txt'), 'utf8'), baseline);
    assert.equal(run(oldError, 2, ['--update-baseline']).status, 0);
    assert.equal(run('components/Invalid.vue(1,1): error TS2322: Invalid prop\n', 2, ['--update-baseline']).status, 1);
    assert.equal(readFileSync(join(directory, '.ts-baseline.txt'), 'utf8'), baseline);
    assert.equal(run('', 0, ['--bad-option']).status, 64);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
