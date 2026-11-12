import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { symlinkSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));

test("production launcher delegates ordered startup and preparation options to the canonical Podman wrapper", () => {
  const root = mkdtempSync(join(tmpdir(), "slk-start-delegate-"));
  try {
    mkdirSync(join(root, "bin"));
    copyFileSync(join(repository, "bin/start_production.sh"), join(root, "bin/start_production.sh"));
    writeFileSync(join(root, "bin/podman.sh"), '#!/bin/bash\nprintf "%s\\n" "$*"\n', { mode: 0o755 });
    const result = spawnSync("bash", [join(root, "bin/start_production.sh"), "--import", "--prepare-only"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "production start --import --prepare-only");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("database backup/restore use the bootstrap operator and preserve the active storage overlay", () => {
  const root = mkdtempSync(join(tmpdir(), "slk-backup-test-"));
  try {
    for (const directory of [
      "bin/db_exports",
      "bin/lib",
      "src/directus/cli",
      "fake",
      "podman/core-storage",
      "podman/database",
      "podman/meilisearch",
    ]) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    for (const name of ["db_exports/export_db.sh", "db_exports/import_db.sh", "lib/core-service-data.sh"]) {
      copyFileSync(join(repository, "bin", name), join(root, "bin", name));
    }
    copyFileSync(join(repository, "bin/lib/environment-value.ts"), join(root, "bin/lib/environment-value.ts"));
    for (const name of ["database", "meilisearch"])
      copyFileSync(join(repository, "podman", name, "Containerfile"), join(root, "podman", name, "Containerfile"));
    writeFileSync(join(root, "bin/podman.sh"), '#!/bin/bash\nshift 2\nexec podman compose "$@"\n', { mode: 0o755 });
    symlinkSync(join(repository, "src/directus/cli/node_modules"), join(root, "src/directus/cli/node_modules"), "dir");
    writeFileSync(join(root, "src/directus/.env"), "DB_USER=restricted_app\nDB_DATABASE=fixture\nDB_PORT=5432\n");
    writeFileSync(join(root, "podman/core-storage/production.compose.json"), "{}");
    writeFileSync(join(root, "podman/core-storage/production.volumes"), "fixture_db fixture_search\n");
    const scripts = {
      podman: `#!/bin/bash
printf '%s\\n' "$*" >> "$SLK_TEST_LOG"
if [[ "$*" == *'config --images'* ]]; then
  printf '%s\\n' 'postgis/postgis:17-3.6' 'getmeili/meilisearch:v1.55.0'
  exit 0
fi
while [[ "$1" != exec ]]; do shift; done
shift 3
POSTGRES_USER=bootstrap_operator "$@"
`,
      pg_dump: '#!/bin/bash\nprintf \'dump %s\\n\' "$*" >> "$SLK_TEST_LOG"\n',
      psql: '#!/bin/bash\nprintf \'restore %s\\n\' "$*" >> "$SLK_TEST_LOG"\ncat >/dev/null\n',
    };
    for (const [name, contents] of Object.entries(scripts)) {
      writeFileSync(join(root, "fake", name), contents, { mode: 0o755 });
    }
    for (const name of ["export_db.sh", "import_db.sh"]) {
      const result = spawnSync("bash", [join(root, "bin/db_exports", name)], {
        encoding: "utf8",
        input: "SELECT 1;\n",
        env: { ...process.env, PATH: `${root}/fake:${process.env.PATH}`, SLK_TEST_LOG: join(root, "calls") },
      });
      assert.equal(result.status, 0, result.stderr);
    }
    const calls = readFileSync(join(root, "calls"), "utf8");
    assert.match(calls, /compose exec/);
    assert.match(calls, /dump --clean -p 5432 -U bootstrap_operator -d fixture/);
    assert.match(calls, /restore -v ON_ERROR_STOP=1 -p 5432 -U bootstrap_operator -d fixture/);
    assert.doesNotMatch(calls, /-U restricted_app/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
