import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "slk-bootstrap-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "bin/cli"), { recursive: true });
  copyFileSync(new URL("../slk", import.meta.url), join(directory, "bin/slk"));
  writeFileSync(join(directory, "bin/package.json"), '{"type":"module"}');
  const version = readFileSync(new URL("../../.node-version", import.meta.url), "utf8").trim();
  writeFileSync(join(directory, ".node-version"), `${version}\n`);
  writeFileSync(
    join(directory, "bin/cli/index.ts"),
    "const args: string[] = process.argv.slice(2); console.log(JSON.stringify({ args, cwd: process.cwd() }));",
  );
  return { directory, version };
}

test("bootstrap rejects old Node before importing TypeScript, from the repository root and bin", (t) => {
  const { directory, version } = fixture(t);
  for (const cwd of [directory, join(directory, "bin")]) {
    for (const nodeVersion of ["18.16.0", "20.19.0", "22.14.0", "22.23.5", "23.11.0"]) {
      const preload = `Object.defineProperty(process.versions, 'node', { value: '${nodeVersion}' });`;
      const result = spawnSync(
        process.execPath,
        ["--import", `data:text/javascript,${encodeURIComponent(preload)}`, join(directory, "bin/slk")],
        { cwd, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } },
      );
      assert.ifError(result.error);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /slk requires Node 24 or newer with native TypeScript support/);
      assert.ok(result.stderr.includes(`nvm install ${version}\n  nvm use ${version}`));
      assert.match(result.stderr, /npm ci --prefix bin from the repository root/);
      assert.doesNotMatch(result.stderr, /ERR_UNKNOWN_FILE_EXTENSION|ERR_MODULE_NOT_FOUND|\n\s+at /);
    }
  }
});

test("bootstrap explains disabled native type stripping before importing TypeScript", (t) => {
  const { directory } = fixture(t);
  const result = spawnSync(process.execPath, [join(directory, "bin/slk"), "--help"], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "--no-experimental-strip-types" },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Remove --no-experimental-strip-types/);
  assert.doesNotMatch(result.stderr, /ERR_UNKNOWN_FILE_EXTENSION/);
});

test("bootstrap loads TypeScript and preserves arguments and cwd on supported Node", (t) => {
  if (Number(process.versions.node.split(".")[0]) < 24 || !process.features.typescript) {
    t.skip("Requires the supported Node runtime with native TypeScript support");
    return;
  }
  const { directory } = fixture(t);
  const args = ["--help", "argument with spaces", "$(literal)"];
  for (const cwd of [directory, join(directory, "bin")]) {
    const result = spawnSync(process.execPath, [join(directory, "bin/slk"), ...args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), { args, cwd });
  }
});
