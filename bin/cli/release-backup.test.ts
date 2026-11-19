import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
      spawnSync("/bin/sh", [...releaseDatabaseDumpCommand.slice(1), "active-application-db"], {
        env: { PATH: directory, POSTGRES_PASSWORD: "private-password-canary", ...env },
        encoding: "utf8",
      });
    const legacy = execute({ POSTGRES_USER: "legacy-bootstrap", POSTGRES_DB: "existing-db" });
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.equal(legacy.stdout, "-U\nlegacy-bootstrap\n-d\nactive-application-db\n-Fc\n");
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
    assert.equal(mounted.stdout, "-U\nmounted-bootstrap\n-d\nactive-application-db\n-Fc\n");
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

test(
  "actual release CLI selects the private CMS database instead of bootstrap or inherited defaults",
  { skip: process.platform === "win32" },
  (t) => {
    const directory = mkdtempSync(join(tmpdir(), "slk-application-dump-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const config = join(directory, "directus.env");
    const reached = join(directory, "podman-called");
    symlinkSync("/bin/sh", join(directory, "sh"));
    writeFileSync(join(directory, "podman"), `#!/bin/sh\nprintf called > '${reached}'\nshift 3\nexec "$@"\n`, {
      mode: 0o700,
    });
    writeFileSync(join(directory, "pg_dump"), '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o700 });
    const execute = () =>
      spawnSync(process.execPath, [fileURLToPath(new URL("./release-backup.ts", import.meta.url)), "a".repeat(64)], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: directory,
          POSTGRES_USER: "bootstrap-owner",
          POSTGRES_DB: "unused-bootstrap-db",
          DB_DATABASE: "stale-inherited-db",
          SLK_PODMAN_DIRECTUS_ENV_FILE: config,
        },
      });
    writeFileSync(config, "DB_DATABASE=active-production-db\nDB_PASSWORD=private-password-canary\n", { mode: 0o600 });
    const result = execute();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "-U\nbootstrap-owner\n-d\nactive-production-db\n-Fc\n");
    assert.doesNotMatch(
      result.stdout + result.stderr,
      /private-password-canary|unused-bootstrap-db|stale-inherited-db/,
    );
    for (const value of ["postgresql://outside/other", "host=outside dbname=other", "--all", ""]) {
      rmSync(reached, { force: true });
      writeFileSync(config, `DB_DATABASE="${value}"\nDB_PASSWORD=private-password-canary\n`);
      const failed = execute();
      assert.notEqual(failed.status, 0);
      assert.equal(existsSync(reached), false, "Unsafe settings must fail before accessing a datastore");
      assert.doesNotMatch(failed.stdout + failed.stderr, /private-password-canary/);
    }
  },
);
