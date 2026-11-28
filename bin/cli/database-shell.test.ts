import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { databaseShell } from "./database-shell.ts";

test(
  "database scripts use the mounted settings when a loader exists, never fall back after it fails, and keep quotes",
  { skip: process.platform === "win32" },
  (t) => {
    const directory = mkdtempSync(join(tmpdir(), "slk-database-shell-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    // SQL literals were the reason the earlier copies could not embed every script.
    const script = `printf "%s|%s|%s" "\${POSTGRES_USER:-none}" "$0" "$1"; printf "|'quoted'"`;
    const execute = (path: string, env: NodeJS.ProcessEnv = {}) => {
      const [command, ...args] = databaseShell(script, "slk-test", "directus");
      return spawnSync(command!, args, { env: { PATH: path, ...env }, encoding: "utf8" });
    };

    const native = execute("/usr/bin:/bin", { POSTGRES_USER: "native" });
    assert.equal(native.status, 0, native.stderr);
    assert.equal(native.stdout, "native|slk-test|directus|'quoted'");

    writeFileSync(
      join(directory, "slk-env"),
      '#!/bin/sh\nif [ "${LOADER_STATUS:-0}" != 0 ]; then exit "$LOADER_STATUS"; fi\nPOSTGRES_USER=mounted exec "$@"\n',
      { mode: 0o700 },
    );
    const mounted = execute(`${directory}:/usr/bin:/bin`, { POSTGRES_USER: "stale" });
    assert.equal(mounted.status, 0, mounted.stderr);
    assert.equal(mounted.stdout, "mounted|slk-test|directus|'quoted'");

    const failed = execute(`${directory}:/usr/bin:/bin`, { POSTGRES_USER: "stale", LOADER_STATUS: "25" });
    assert.equal(failed.status, 25);
    assert.equal(failed.stdout, "", "A failed loader must never fall back to inherited settings");
  },
);
