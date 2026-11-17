import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { releaseDatabaseDump, releaseDatabaseDumpCommand } from "./release-backup.ts";

test(
  "release dumps support legacy secrets and mounted settings without retrying loader or dump failures",
  { skip: process.platform === "win32" },
  (t) => {
    const directory = mkdtempSync(join(tmpdir(), "slk-release-dump-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    symlinkSync("/bin/sh", join(directory, "sh"));
    writeFileSync(join(directory, "pg_dump"), '#!/bin/sh\nprintf "%s\\n" "$@"\nexit "${DUMP_STATUS:-0}"\n', {
      mode: 0o700,
    });
    const execute = (env: NodeJS.ProcessEnv) =>
      spawnSync("/bin/sh", releaseDatabaseDumpCommand.slice(1), {
        env: { PATH: directory, POSTGRES_PASSWORD: "private-password-canary", ...env },
        encoding: "utf8",
      });
    const legacy = execute({ POSTGRES_USER: "legacy-bootstrap", POSTGRES_DB: "existing-db" });
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.equal(legacy.stdout, "-U\nlegacy-bootstrap\n-d\nexisting-db\n-Fc\n");
    const missing = execute({});
    assert.notEqual(missing.status, 0);
    assert.equal(missing.stdout, "");
    writeFileSync(
      join(directory, "slk-env"),
      '#!/bin/sh\nif [ "${LOADER_STATUS:-0}" != 0 ]; then exit "$LOADER_STATUS"; fi\nexport POSTGRES_USER=mounted-bootstrap POSTGRES_DB=mounted-db\nexec "$@"\n',
      { mode: 0o700 },
    );
    const mounted = execute({ POSTGRES_USER: "stale-user", POSTGRES_DB: "stale-db" });
    assert.equal(mounted.status, 0, mounted.stderr);
    assert.equal(mounted.stdout, "-U\nmounted-bootstrap\n-d\nmounted-db\n-Fc\n");
    const loaderFailure = execute({ LOADER_STATUS: "25", POSTGRES_USER: "stale-user", POSTGRES_DB: "stale-db" });
    assert.equal(loaderFailure.status, 25);
    assert.equal(loaderFailure.stdout, "", "A failed loader must never fall back to inherited credentials");
    const dumpFailure = execute({ DUMP_STATUS: "19" });
    assert.equal(dumpFailure.status, 19);
    assert.equal((dumpFailure.stdout.match(/-Fc/g) ?? []).length, 1, "A failing dump must not be retried");
    for (const result of [legacy, missing, mounted, loaderFailure, dumpFailure]) {
      assert.doesNotMatch(result.stdout + result.stderr, /private-password-canary/);
    }
  },
);

test("release dump refuses ambiguous or option-like container identities before spawning Podman", async () => {
  for (const value of ["", "--privileged", "abc\ndef", "a".repeat(12) + " " + "b".repeat(12)]) {
    await assert.rejects(releaseDatabaseDump(value), /container ID/);
  }
});
