import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../../../", import.meta.url));

function fixture(action: string[], failImport = false) {
  const root = mkdtempSync(join(tmpdir(), "slk-deploy-test-"));
  try {
    mkdirSync(join(root, "bin/lib"), { recursive: true });
    mkdirSync(join(root, "fake"));
    copyFileSync(join(repository, "bin/start_production.sh"), join(root, "bin/start_production.sh"));
    copyFileSync(join(repository, "bin/lib/core-service-data.sh"), join(root, "bin/lib/core-service-data.sh"));
    const executables = {
      "bin/check_core_service_data.sh": "#!/bin/bash\nexit 0\n",
      "fake/docker": `#!/bin/bash
printf '%s\\n' "$*" >> "$SLK_TEST_LOG"
if [[ "$*" == *'config --images'* ]]; then
  printf '%s\\n' 'postgis/postgis:17-3.6' 'getmeili/meilisearch:v1.55.0'
fi
if [[ "$*" == *'/directus/cli/import-all.sh'* && "$SLK_FAIL_IMPORT" == 1 ]]; then exit 17; fi
`,
      "fake/curl": "#!/bin/bash\nprintf '200'\n",
    };
    for (const [name, contents] of Object.entries(executables)) {
      writeFileSync(join(root, name), contents);
      chmodSync(join(root, name), 0o755);
    }
    const result = spawnSync("bash", [join(root, "bin/start_production.sh"), ...action], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${root}/fake:${process.env.PATH}`,
        SLK_TEST_LOG: join(root, "calls"),
        SLK_FAIL_IMPORT: failImport ? "1" : "0",
      },
    });
    return { ...result, calls: readFileSync(join(root, "calls"), "utf8").split("\n").filter(Boolean) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("production startup imports before frontend recreation and only then removes maintenance", () => {
  const result = fixture(["--import"]);
  assert.equal(result.status, 0, result.stderr);
  const index = (suffix: string) => result.calls.findIndex((call) => call.endsWith(suffix));
  assert.ok(index("up -d maintenance") < index("exec -T directus /directus/cli/import-all.sh"));
  assert.ok(index("exec -T directus /directus/cli/import-all.sh") < index("up -d --force-recreate frontend"));
  assert.ok(index("up -d --force-recreate frontend") < index("stop maintenance"));
});

test("failed imports leave frontend stopped and maintenance running", () => {
  const result = fixture(["--import"], true);
  assert.equal(result.status, 17);
  assert.ok(result.calls.some((call) => call.endsWith("stop frontend")));
  assert.ok(
    !result.calls.some((call) => call.endsWith("up -d --force-recreate frontend") || call.endsWith("stop maintenance")),
  );
});

test("prepare-only leaves frontend stopped for service-user and environment setup", () => {
  const result = fixture(["--import", "--prepare-only"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.calls.some((call) => call.endsWith("exec -T directus /directus/cli/import-all.sh")));
  assert.ok(
    !result.calls.some((call) => call.endsWith("up -d --force-recreate frontend") || call.endsWith("stop maintenance")),
  );
});

test("database backup/restore use the bootstrap operator and preserve the active storage overlay", () => {
  const root = mkdtempSync(join(tmpdir(), "slk-backup-test-"));
  try {
    for (const directory of ["bin/db_exports", "bin/lib", "src/directus", "fake", "docker/core-storage"]) {
      mkdirSync(join(root, directory), { recursive: true });
    }
    for (const name of ["db_exports/export_db.sh", "db_exports/import_db.sh", "lib/core-service-data.sh"]) {
      copyFileSync(join(repository, "bin", name), join(root, "bin", name));
    }
    writeFileSync(join(root, "src/directus/.env"), "DB_USER=restricted_app\nDB_DATABASE=fixture\nDB_PORT=5432\n");
    writeFileSync(join(root, "docker/core-storage/production.compose.json"), "{}");
    writeFileSync(join(root, "docker/core-storage/production.volumes"), "fixture_db fixture_search\n");
    const scripts = {
      docker: `#!/bin/bash
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
    assert.match(calls, /-f docker\/core-storage\/production.compose.json exec/);
    assert.match(calls, /dump --clean -p 5432 -U bootstrap_operator -d fixture/);
    assert.match(calls, /restore -v ON_ERROR_STOP=1 -p 5432 -U bootstrap_operator -d fixture/);
    assert.doesNotMatch(calls, /-U restricted_app/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
