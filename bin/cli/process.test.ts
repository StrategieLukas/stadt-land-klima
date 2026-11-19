import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { root } from "./process.ts";

function invoke(args: string[], env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "", ...env },
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

test("sanitized helper diagnostics are visible with captured stdout and a useful stage label", () => {
  const childCode =
    "process.stdout.write('private-output'); process.stderr.write('Safe preflight reason\\n'); process.exit(7)";
  const code = `
    import { run } from ${JSON.stringify(new URL("./process.ts", import.meta.url).href)};
    try {
      await run(process.execPath, ["-e", ${JSON.stringify(childCode)}],
        { capture: true, inheritStderr: true, label: "Podman host preflight" });
    } catch (error) { console.error(error.message); process.exitCode = error.code; }
  `;
  const result = invoke(["--input-type=module", "--eval", code]);
  assert.equal(result.status, 7, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Safe preflight reason\nPodman host preflight failed (exit 7).\n");
});

test("captured and quiet commands continue withholding untrusted stdout and stderr by default", () => {
  for (const mode of ["capture", "quiet"]) {
    const code = `
      import { run } from ${JSON.stringify(new URL("./process.ts", import.meta.url).href)};
      try {
        await run(process.execPath, ["-e", "process.stdout.write('stdout-secret'); process.stderr.write('stderr-secret'); process.exit(9)"],
          { ${mode}: true, label: "Private operation" });
      } catch (error) { console.error(error.message); process.exitCode = error.code; }
    `;
    const result = invoke(["--input-type=module", "--eval", code]);
    assert.equal(result.status, 9);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "Private operation failed (exit 9).\n");
  }
});

test("Node imports shared runtime settings without ambiguous-module warnings", () => {
  const code = `await import(${JSON.stringify(new URL("./translation-worker.ts", import.meta.url).href)});`;
  const result = invoke(["--input-type=module", "--eval", code]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("missing private environment files identify the service without exposing the private path", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "slk-private-env-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const result = invoke([join(root, "bin/lib/podman-security.ts"), "environment"], {
    SLK_PODMAN_DB_ENV_FILE: join(directory, "private-path-canary.env"),
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Database environment file: missing or unreadable; see PODMAN.md\n");
  assert.doesNotMatch(result.stderr, /private-path-canary/);
});

test("host preflight suppresses untrusted provider errors before exposing its sanitized diagnostic", (t) => {
  if (process.platform === "win32") {
    t.skip("The Podman host helper requires a Linux-compatible executable provider");
    return;
  }
  const directory = mkdtempSync(join(tmpdir(), "slk-provider-error-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "tools"));
  const podman = join(directory, "tools/podman");
  writeFileSync(
    podman,
    `#!${process.execPath}\nprocess.stderr.write('provider-secret-canary'); process.exitCode = 8;\n`,
  );
  chmodSync(podman, 0o700);
  const result = invoke([join(root, "bin/lib/podman-security.ts"), "host", "development"], {
    PATH: `${join(directory, "tools")}:${process.env.PATH || ""}`,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Podman security check could not complete\n");
  assert.doesNotMatch(result.stderr, /provider-secret-canary/);
});

test("direct host helper and runtime reject the unsafe version override outside development before provider access", () => {
  for (const environment of ["production", "staging", ""]) {
    const result = invoke(
      [join(root, "bin/lib/podman-security.ts"), "host", environment, "--unsafe-skip-podman-version-check"],
      { PATH: "" },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "--unsafe-skip-podman-version-check is only allowed with --env development\n");
  }
  const code = `
    import { runtime } from ${JSON.stringify(new URL("./stack.ts", import.meta.url).href)};
    try { await runtime("production", "doctor", true); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  `;
  const result = invoke(["--input-type=module", "--eval", code], { PATH: "" });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "--unsafe-skip-podman-version-check is only allowed with --env development\n");
});
