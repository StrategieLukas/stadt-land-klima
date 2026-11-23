import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "yaml";
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

test("staged output overlays include build/maintenance profiles and replace each destination once", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "slk-release-overlay-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const overlay = join(directory, "stage.yaml");
  writeFileSync(
    overlay,
    yaml.stringify({
      services: {
        frontend: { volumes: ["staged:/frontend/.output:ro,U"] },
        "frontend-build": { volumes: ["staged:/release:U"] },
      },
      volumes: { staged: { name: "fixture-staged-output" } },
    }),
  );
  const runtime = new Runtime("production", "fixture", ["-f", "base.yaml"], { XDG_RUNTIME_DIR: directory }, 9000, 9001);
  runtime.raw = async (args) =>
    yaml.stringify({
      services: {
        frontend: { volumes: ["active:/frontend/.output:ro,U", "uploads:/uploads:ro"] },
        ...(args.includes("build")
          ? {
              "frontend-build": {
                profiles: ["build"],
                volumes: ["active:/release:U"],
                command: ["sh", "-ec", 'slk_input=$(printf hash); printf "%s" "$slk_input"'],
                environment: { LITERAL: "${NOT_A_HOST_VARIABLE}:$5:$$" },
              },
            }
          : {}),
        ...(args.includes("maintenance")
          ? { maintenance: { profiles: ["maintenance"], image: "fixture-maintenance" } }
          : {}),
      },
      volumes: { active: {}, uploads: {} },
    });
  await runtime.useStorageOverlay(overlay);
  const output = yaml.parse(readFileSync(runtime.args.at(-1)!, "utf8"));
  assert.deepEqual(output.services.frontend.volumes, ["uploads:/uploads:ro", "staged:/frontend/.output:ro,U"]);
  assert.deepEqual(output.services["frontend-build"].volumes, ["staged:/release:U"]);
  assert.deepEqual(output.services["frontend-build"].command, [
    "sh",
    "-ec",
    'slk_input=$$(printf hash); printf "%s" "$$slk_input"',
  ]);
  assert.equal(output.services["frontend-build"].environment.LITERAL, "$${NOT_A_HOST_VARIABLE}:$$5:$$$$");
  assert.equal(output.services.maintenance.image, "fixture-maintenance");
  assert.equal(output.volumes.staged.name, "fixture-staged-output");
  writeFileSync(overlay, yaml.stringify({ services: { unknown: { volumes: [] } } }));
  await assert.rejects(runtime.useStorageOverlay(overlay), /unknown service/);
});
