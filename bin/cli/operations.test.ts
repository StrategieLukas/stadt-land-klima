import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Runtime } from "./stack.ts";
import { databaseTransfer } from "./operations.ts";

test("database backup and restore use the bootstrap operator through the active runtime", async () => {
  const dir = mkdtempSync(join(tmpdir(), "slk-backup-"));
  const previous = process.env.SLK_PODMAN_DIRECTUS_ENV_FILE;
  try {
    const env = join(dir, "cms.env");
    writeFileSync(env, "DB_USER=restricted_app\nDB_DATABASE=fixture\nDB_PORT=5432\n", { mode: 0o600 });
    process.env.SLK_PODMAN_DIRECTUS_ENV_FILE = env;
    const runtime = new Runtime("production", "fixture", ["-f", "private-storage-overlay"], {}, 9000, 9001);
    const calls: string[][] = [];
    runtime.raw = async (args) => {
      calls.push(args);
      return "";
    };
    await databaseTransfer(runtime, "export", []);
    await databaseTransfer(runtime, "import", []);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.ok(call.includes("/usr/local/bin/slk-env"));
      assert.match(call.join(" "), /-U "\$POSTGRES_USER"/);
      assert.doesNotMatch(call.join(" "), /-U restricted_app/);
      assert.deepEqual(call.slice(-3), ["sh", "5432", "fixture"]);
    }
    assert.match(calls[0]!.join(" "), /pg_dump --clean/);
    assert.match(calls[1]!.join(" "), /psql -v ON_ERROR_STOP=1/);
    assert.deepEqual(runtime.args, ["-f", "private-storage-overlay"]);
  } finally {
    if (previous === undefined) delete process.env.SLK_PODMAN_DIRECTUS_ENV_FILE;
    else process.env.SLK_PODMAN_DIRECTUS_ENV_FILE = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
