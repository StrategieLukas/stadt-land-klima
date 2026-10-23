import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const repository = fileURLToPath(new URL("../../../../", import.meta.url));
function run(command: string, args: string[], cwd: string, env = process.env) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += String(data);
  });
  child.stderr.on("data", (data) => {
    output += String(data);
  });
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
}

test("CLI build rejects compiler errors, omitted sources and weakened checking", async () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-cli-gate-"));
  try {
    copyFileSync(join(root, "package.json"), join(directory, "package.json"));
    copyFileSync(join(root, "tsconfig.json"), join(directory, "tsconfig.json"));
    symlinkSync(join(root, "node_modules"), join(directory, "node_modules"), "dir");
    mkdirSync(join(directory, "scripts"));
    copyFileSync(join(root, "scripts/checkSources.ts"), join(directory, "scripts/checkSources.ts"));
    writeFileSync(join(directory, "probe.ts"), 'export const invalid: number = "fixture";');
    const invalid = await run("npm", ["run", "build"], directory);
    assert.notEqual(invalid.code, 0);
    assert.match(invalid.output, /TS2322/);
    rmSync(join(directory, "probe.ts"));
    writeFileSync(join(directory, "unchecked.js"), "export const hidden = true;");
    const unchecked = await run("npm", ["run", "build"], directory);
    assert.notEqual(unchecked.code, 0);
    assert.match(unchecked.output, /Unchecked CLI source/);
    rmSync(join(directory, "unchecked.js"));
    const config = JSON.parse(readFileSync(join(directory, "tsconfig.json"), "utf8"));
    writeFileSync(join(directory, "omitted.ts"), "export const omitted = true;");
    config.exclude = ["node_modules", "omitted.ts"];
    writeFileSync(join(directory, "tsconfig.json"), JSON.stringify(config));
    const omitted = await run("npm", ["run", "build"], directory);
    assert.notEqual(omitted.code, 0);
    assert.match(omitted.output, /Unchecked CLI source.*omitted.ts/);
    rmSync(join(directory, "omitted.ts"));
    config.compilerOptions.strict = false;
    writeFileSync(join(directory, "tsconfig.json"), JSON.stringify(config));
    const weakened = await run("npm", ["run", "build"], directory);
    assert.notEqual(weakened.code, 0);
    assert.match(weakened.output, /require strict/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("container and administrative shell entry points stop before startup or writes when checking fails", async () => {
  const directory = mkdtempSync(join(tmpdir(), "slk-cli-startup-gate-"));
  try {
    const tools = join(directory, "tools");
    mkdirSync(tools);
    const directus = join(directory, "directus");
    mkdirSync(join(directus, "cli"), { recursive: true });
    const log = join(directory, "calls.log");
    writeFileSync(
      join(tools, "npm"),
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$SLK_GATE_LOG"\ncase "$*" in *"run typecheck"*) exit 42;; esac\n',
      { mode: 0o755 },
    );
    writeFileSync(join(tools, "node"), '#!/bin/sh\necho "unexpected node execution" >> "$SLK_GATE_LOG"\nexit 99\n', {
      mode: 0o755,
    });
    const env = {
      ...process.env,
      PATH: `${tools}:${process.env.PATH}`,
      SLK_GATE_LOG: log,
    };
    for (const name of ["build.sh", "start_dev.sh", "start_prod.sh"]) {
      const source = readFileSync(join(repository, "docker/directus", name), "utf8").replaceAll("/directus", directus);
      const file = join(directory, name);
      writeFileSync(file, source);
      writeFileSync(log, "");
      const result = await run("bash", [file], directory, env);
      assert.equal(result.code, 42, `${name}: ${result.output}`);
      assert.doesNotMatch(readFileSync(log, "utf8"), /unexpected node/);
    }
    for (const name of ["import-all.sh", "export-all.sh"]) {
      const file = join(directus, "cli", name);
      copyFileSync(join(root, name), file);
      writeFileSync(log, "");
      const result = await run("bash", [file], directory, env);
      assert.equal(result.code, 42, `${name}: ${result.output}`);
      assert.match(readFileSync(log, "utf8"), /run typecheck/);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
