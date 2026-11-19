import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import dotenv from "dotenv";
import { Runtime } from "./stack.ts";
import { reconcileDevelopmentServiceUsers } from "./service-users.ts";

test("development provisions restricted service identities and replaces stale private Nuxt overrides without exposing tokens", async () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-service-users-"));
  try {
    const path = join(directory, "frontend.env");
    const cmsPath = join(directory, "directus.env");
    const admin = "d".repeat(64);
    const values = {
      DIRECTUS_FRONTEND_SERVER_TOKEN: "a".repeat(64),
      DIRECTUS_FRONTEND_PUBLIC_TOKEN: "b".repeat(64),
      DIRECTUS_PREVIEW_TOKEN: "c".repeat(64),
    };
    writeFileSync(
      path,
      "# Keep other settings\nKEEP='literal $HOME'\nexport NUXT_DIRECTUS_FRONTEND_SERVER_TOKEN=stale\nDIRECTUS_PREVIEW_TOKEN=stale\n",
      { mode: 0o600 },
    );
    writeFileSync(cmsPath, `CLI_DIRECTUS_STATIC_TOKEN=${admin}\n`, { mode: 0o600 });
    const rt = new Runtime(
      "development",
      "fixture",
      [],
      { SLK_PODMAN_FRONTEND_ENV_FILE: path, SLK_PODMAN_DIRECTUS_ENV_FILE: cmsPath },
      8080,
      8081,
    );
    rt.raw = async (args, options) => {
      assert.deepEqual(args, [
        "exec",
        "-T",
        "-e",
        "DIRECTUS_URL=http://127.0.0.1:8055",
        "directus",
        "/usr/local/bin/slk-env",
        "--keep=DIRECTUS_URL",
        "node",
        "/directus/cli/tasks/provisionServiceUsers.ts",
      ]);
      assert.equal(options?.capture, true);
      assert.doesNotMatch(args.join(" "), /a{64}|b{64}|c{64}|d{64}/);
      return Object.entries(values)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");
    };
    await reconcileDevelopmentServiceUsers(rt);
    const settings = dotenv.parse(readFileSync(path));
    for (const [key, value] of Object.entries({ ...values, DIRECTUS_ADMIN_TOKEN: admin })) {
      assert.equal(settings[key], value);
      assert.equal(settings[`NUXT_${key}`], value);
    }
    assert.equal(settings.KEEP, "literal $HOME");
    assert.equal(statSync(path).mode & 0o777, 0o600);
    const before = readFileSync(path, "utf8");
    const inode = statSync(path).ino;
    await reconcileDevelopmentServiceUsers(rt);
    assert.equal(statSync(path).ino, inode, "matching credentials must not rewrite the private file");
    rt.raw = async () => {
      throw new Error("secret-upstream-canary");
    };
    await assert.rejects(reconcileDevelopmentServiceUsers(rt), (error: Error) => {
      assert.match(error.message, /provisioning failed/);
      assert.doesNotMatch(error.message, /secret-upstream-canary/);
      return true;
    });
    rt.raw = async () => "DIRECTUS_FRONTEND_SERVER_TOKEN=invalid-secret-canary";
    await assert.rejects(reconcileDevelopmentServiceUsers(rt), /invalid credentials/);
    assert.equal(readFileSync(path, "utf8"), before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("production service identities remain an explicit operator workflow", async () => {
  const rt = new Runtime("production", "fixture", [], {}, 8080, 8081);
  rt.raw = async () => {
    throw new Error("must not provision");
  };
  await reconcileDevelopmentServiceUsers(rt);
});
