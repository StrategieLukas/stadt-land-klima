import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import dotenv from "dotenv";
import { Runtime } from "./stack.ts";
import { reconcileTranslationWorker } from "./translation-worker.ts";

test("production reconciles through private stdin, preserves configured tokens and reuses stored credentials", async () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-worker-deploy-"));
  try {
    const path = join(directory, "frontend.env");
    const configured = "a".repeat(64),
      stored = "b".repeat(64);
    const source = `# Private fixture\nDEEPL_API_KEY=provider-canary\nCONTENT_TRANSLATION_ENABLED=true\nCONTENT_TRANSLATION_GENERATION_ENABLED=true\nCONTENT_TRANSLATION_WORKER_TOKEN=${configured}\nKEEP='literal $HOME'\n`;
    writeFileSync(path, source, { mode: 0o600 });
    const rt = new Runtime("production", "fixture", [], { SLK_PODMAN_FRONTEND_ENV_FILE: path }, 9000, 9001);
    let credential = configured,
      calls = 0;
    rt.raw = async (args, options) => {
      calls++;
      assert.deepEqual(args, [
        "exec",
        "-T",
        "-e",
        "DIRECTUS_URL=http://127.0.0.1:8055",
        "directus",
        "/usr/local/bin/slk-env",
        "--keep=DIRECTUS_URL",
        "node",
        "/directus/cli/provisionTranslationWorker.ts",
        "--reconcile",
      ]);
      assert.equal(options?.capture, true);
      assert.equal(options?.input, configured);
      assert.doesNotMatch(args.join(" "), /provider-canary|a{64}|b{64}/);
      return `CONTENT_TRANSLATION_WORKER_TOKEN=${credential}`;
    };
    await reconcileTranslationWorker(rt);
    assert.equal(readFileSync(path, "utf8"), source, "matching credentials require no env write");
    credential = stored;
    await reconcileTranslationWorker(rt);
    const values = dotenv.parse(readFileSync(path));
    assert.equal(values.CONTENT_TRANSLATION_WORKER_TOKEN, stored);
    assert.equal(values.NUXT_CONTENT_TRANSLATION_WORKER_TOKEN, stored);
    assert.equal(values.KEEP, "literal $HOME");
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.equal(calls, 2);
    rt.raw = async () => {
      throw new Error("secret-upstream-canary");
    };
    const before = readFileSync(path, "utf8");
    await assert.rejects(reconcileTranslationWorker(rt), (error: Error) => {
      assert.match(error.message, /provisioning failed/);
      assert.doesNotMatch(error.message, /secret-upstream-canary/);
      return true;
    });
    assert.equal(readFileSync(path, "utf8"), before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("staging, future, development and paused generation never provision a worker", async () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-worker-off-"));
  try {
    const path = join(directory, "frontend.env");
    const settings =
      "DEEPL_API_KEY=canary\nCONTENT_TRANSLATION_ENABLED=true\nNUXT_CONTENT_TRANSLATION_GENERATION_ENABLED=true\n";
    for (const target of ["staging", "future", "development"]) {
      writeFileSync(path, settings + `SLK_DEPLOYMENT_TARGET=${target}\n`, { mode: 0o600 });
      const rt = new Runtime("production", "fixture", [], { SLK_PODMAN_FRONTEND_ENV_FILE: path }, 9000, 9001);
      rt.raw = async () => {
        throw new Error("must not provision");
      };
      await reconcileTranslationWorker(rt);
    }
    writeFileSync(path, settings + "NUXT_CONTENT_TRANSLATION_GENERATION_ENABLED=false\n");
    const rt = new Runtime("production", "fixture", [], { SLK_PODMAN_FRONTEND_ENV_FILE: path }, 9000, 9001);
    rt.raw = async () => {
      throw new Error("must not provision");
    };
    await reconcileTranslationWorker(rt);
    const dev = new Runtime("development", "fixture", [], {}, 8080, 8081);
    dev.raw = rt.raw;
    await reconcileTranslationWorker(dev);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
