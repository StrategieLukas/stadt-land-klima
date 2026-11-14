import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FRONTEND_RUNTIME_ALIASES,
  frontendRuntimeEnvironment,
} from "../../../src/frontend/shared/runtimeEnvironment.js";

test("every legacy runtime key maps without rebuilding and explicit Nuxt overrides win", () => {
  for (const [key, alias] of Object.entries(FRONTEND_RUNTIME_ALIASES)) {
    const boolean = key === "CONTENT_TRANSLATION_ENABLED" || key === "CONTENT_TRANSLATION_GENERATION_ENABLED";
    assert.equal(
      frontendRuntimeEnvironment({ SLK_ENV: "production", [key]: "first" })[alias],
      boolean ? "false" : "first",
      key,
    );
    assert.equal(
      frontendRuntimeEnvironment({ SLK_ENV: "production", [key]: "second" })[alias],
      boolean ? "false" : "second",
      key,
    );
    assert.equal(
      frontendRuntimeEnvironment({ SLK_ENV: "production", [key]: "first", [alias]: "override" })[alias],
      "override",
      key,
    );
  }
  const env = frontendRuntimeEnvironment({
    SLK_ENV: "production",
    PUBLIC_URL: "https://new.example",
    MEILI_MASTER_KEY: "changed",
    ALTCHA_SECRET: "dev-secret-change-in-production",
  });
  assert.equal(env.NUXT_MEILISEARCH_MASTER_KEY, "changed");
  assert.equal(env.NUXT_PUBLIC_SITE_URL, "https://new.example");
  assert.equal(env.NUXT_PUBLIC_CAPTCHA_DEV_BYPASS, "false");
  const cms = frontendRuntimeEnvironment({ CLIENT_DIRECTUS_URL: "http://cms.example/backend" });
  assert.deepEqual(JSON.parse(cms.NUXT_SECURITY_HEADERS_CONTENT_SECURITY_POLICY_IMG_SRC!), [
    "'self'",
    "https:",
    "data:",
    "blob:",
    "http://cms.example",
  ]);
  assert.equal(
    frontendRuntimeEnvironment({ CLIENT_DIRECTUS_URL: "https://private:credential@cms.example" })
      .NUXT_SECURITY_HEADERS_CONTENT_SECURITY_POLICY_IMG_SRC,
    undefined,
  );
});

test("background translation runs only on the production target, even with copied Nuxt switches", () => {
  for (const target of ["staging", "future", "development"]) {
    const env = frontendRuntimeEnvironment({
      SLK_ENV: "production",
      SLK_DEPLOYMENT_TARGET: target,
      CONTENT_TRANSLATION_ENABLED: "true",
      CONTENT_TRANSLATION_GENERATION_ENABLED: "true",
      NUXT_CONTENT_TRANSLATION_GENERATION_ENABLED: "true",
    });
    assert.equal(env.NUXT_CONTENT_TRANSLATION_ENABLED, "true", "prepared translations remain readable");
    assert.equal(env.NUXT_CONTENT_TRANSLATION_GENERATION_ENABLED, "false");
  }
  assert.equal(
    frontendRuntimeEnvironment({
      SLK_ENV: "development",
      SLK_DEPLOYMENT_TARGET: "production",
      CONTENT_TRANSLATION_GENERATION_ENABLED: "true",
    }).NUXT_CONTENT_TRANSLATION_GENERATION_ENABLED,
    "false",
  );
  assert.equal(
    frontendRuntimeEnvironment({ SLK_ENV: "production", CONTENT_TRANSLATION_GENERATION_ENABLED: "true" })
      .NUXT_CONTENT_TRANSLATION_GENERATION_ENABLED,
    "true",
  );
  assert.throws(() => frontendRuntimeEnvironment({ SLK_ENV: "production", SLK_DEPLOYMENT_TARGET: "typo" }));
});

test("real mounted-env launcher reloads values and exec rejects failures without exposing credentials", () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-runtime-env-"));
  try {
    const binary = join(directory, "slk-env");
    execFileSync("go", ["build", "-o", binary, "."], {
      cwd: fileURLToPath(new URL("../../../podman/environment/", import.meta.url)),
      stdio: "pipe",
    });
    const path = join(directory, "service.env");
    const invoke = () =>
      execFileSync(
        binary,
        [
          process.execPath,
          "-e",
          "process.stdout.write(JSON.stringify({value:process.env.VALUE,locked:process.env.CACHE_ENABLED}))",
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            VALUE: "stale",
            CACHE_ENABLED: "false",
            SLK_ENV_FILES: path,
            SLK_ENV_LOCKED_KEYS: "CACHE_ENABLED",
          },
        },
      );
    writeFileSync(path, "VALUE='literal $HOME # one'\nCACHE_ENABLED=true\n", { mode: 0o600 });
    assert.deepEqual(JSON.parse(invoke()), { value: "literal $HOME # one", locked: "false" });
    writeFileSync(path, 'VALUE="two\\nlines"\n');
    assert.deepEqual(JSON.parse(invoke()), { value: "two\nlines", locked: "false" });
    writeFileSync(path, "VALUE=private-canary\0malformed");
    const failed = spawnSync(binary, [process.execPath, "-e", "process.exit(99)"], {
      encoding: "utf8",
      env: { ...process.env, SLK_ENV_FILES: path },
    });
    assert.equal(failed.status, 1);
    assert.doesNotMatch(failed.stdout + failed.stderr, /private-canary|malformed/);
    const root = new URL("../../../", import.meta.url);
    assert.doesNotMatch(readFileSync(new URL("podman-compose.yaml", root), "utf8"), /env_file:/);
    assert.match(readFileSync(new URL(".containerignore", root), "utf8"), /\*\*\/\.env/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("maintenance metadata contains only public settings with safe JavaScript quoting", () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-maintenance-meta-"));
  try {
    const input = join(directory, "frontend.env");
    const output = join(directory, "maintenance-meta.js");
    writeFileSync(
      input,
      `PRIVATE_TOKEN=must-never-enter-static-output\nPLAUSIBLE_ANALYTICS_DOMAIN='example.org";throw Error("injected")//'\n`,
      { mode: 0o600 },
    );
    execFileSync(process.execPath, [fileURLToPath(new URL("../../lib/maintenance-meta.ts", import.meta.url)), output], {
      env: { ...process.env, SLK_PODMAN_FRONTEND_ENV_FILE: input },
      stdio: "pipe",
    });
    const script = readFileSync(output, "utf8");
    assert.doesNotMatch(script, /PRIVATE_TOKEN|must-never-enter/);
    assert.match(script, /__PLAUSIBLE_ANALYTICS_DOMAIN/);
    assert.ok(script.includes(JSON.stringify('example.org";throw Error("injected")//')));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
