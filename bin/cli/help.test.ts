import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { cliVersion, HELP_BANNER } from "./presentation.ts";
import { root } from "./process.ts";

function cli(args: string[], overrides: NodeJS.ProcessEnv = {}, cwd = root) {
  const env = { ...process.env, NODE_OPTIONS: "", FORCE_COLOR: "0", SLK_PODMAN_PROJECT: "", ...overrides };
  const result = spawnSync(process.execPath, [join(root, "bin/slk"), ...args], {
    cwd,
    encoding: "utf8",
    env,
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

const groups = [
  "stack",
  "database",
  "cms",
  "frontend",
  "extensions",
  "check",
  "test",
  "backup",
  "release",
  "cms-origin",
  "deploy",
];

test("root and every command help have one FIGlet header, including invocation from bin", () => {
  for (const args of [["--help"], ...groups.map((group) => [group, "--help"])]) {
    const result = cli(args, {}, join(root, "bin"));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.ok(result.stdout.startsWith(`${HELP_BANNER}\n\nslk `));
    assert.equal(result.stdout.split(HELP_BANNER).length, 2);
    assert.doesNotMatch(result.stdout, /\u001b\[/);
    assert.match(result.stdout, /--help/);
  }
});

test("incomplete commands show contextual help once and exit unsuccessfully before operations", () => {
  const cases = [
    [],
    ...groups.filter((group) => group !== "check").map((group) => [group]),
    ["release", "stage"],
    ["release", "stage", "config", "tag"],
    ["release", "activate", "config", "tag", "previous"],
    ["cms-origin", "prepare", "config", "state"],
    ["backup", "verify"],
    ["backup", "create"],
    ["backup", "create", "--project", "test"],
    ["backup", "create", "--project", "test", "--output", "unused"],
    ["database", "role"],
    ["database", "role", "--", "plan"],
    ["database", "role", "--", "plan", "/private/plan.json"],
    ["database", "role", "--", "apply"],
    ["check", "release"],
    ["stack", "build", "--env", "production", "--unsafe-skip-podman-version-check"],
    ["check", "--only"],
    ["check", "--output"],
    ["check", "--tail"],
    ["backup", "create", "--output"],
    ["stack", "build", "--env"],
  ];
  for (const args of cases) {
    const result = cli(args);
    assert.equal(result.status, 1, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.ok(result.stderr.startsWith(`${HELP_BANNER}\n\nslk ${args[0] || "<group>"}`), args.join(" "));
    assert.equal(result.stderr.split(HELP_BANNER).length, 2, args.join(" "));
    assert.match(result.stderr, /--help/);
    assert.doesNotMatch(result.stderr, /Command failed|Use a non-root|AppArmor|ENOENT|could not be started|\n\s+at /);
  }
});

test("help uses mint green when color is forced, and honors NO_COLOR and FORCE_COLOR=0", () => {
  const colored = cli(["--help"], { FORCE_COLOR: "1", NO_COLOR: undefined });
  assert.equal(colored.status, 0, colored.stderr);
  assert.ok(colored.stdout.startsWith(`\u001b[38;2;152;255;190m${HELP_BANNER}\u001b[0m\n\n`));
  const failure = cli(["stack"], { FORCE_COLOR: "1", NO_COLOR: undefined });
  assert.equal(failure.status, 1);
  assert.ok(failure.stderr.startsWith(`\u001b[38;2;152;255;190m${HELP_BANNER}\u001b[0m\n\n`));
  for (const env of [
    { NO_COLOR: "", FORCE_COLOR: undefined },
    { FORCE_COLOR: "0", NO_COLOR: undefined },
  ]) {
    const result = cli(["--help"], env);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.startsWith(HELP_BANNER));
    assert.doesNotMatch(result.stdout, /\u001b\[/);
  }
});

test("version identifies the repository from either cwd without help or decoration", () => {
  const revision = execFileSync("git", ["describe", "--tags", "--always", "--dirty"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  for (const cwd of [root, join(root, "bin")]) {
    const result = cli(["--version"], { FORCE_COLOR: "1", NO_COLOR: undefined }, cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `slk ${revision}\n`);
    assert.equal(result.stderr, "");
  }
});

test("versions retain tags and dirty state and explain missing Git metadata", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "slk-version-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  assert.equal(cliVersion(directory), "slk source archive (Git revision unavailable)");
  const hooks = join(directory, "empty-hooks");
  mkdirSync(hooks);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: directory, stdio: "pipe" });
  git("init", "--quiet");
  writeFileSync(join(directory, "version.txt"), "clean\n");
  git("add", "version.txt");
  git(
    "-c",
    "user.name=CLI Test",
    "-c",
    "user.email=cli-test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "-c",
    `core.hooksPath=${hooks}`,
    "commit",
    "--quiet",
    "-m",
    "Version fixture",
  );
  git("tag", "cli-test-v1");
  assert.equal(cliVersion(directory), "slk cli-test-v1");
  writeFileSync(join(directory, "version.txt"), "changed\n");
  assert.equal(cliVersion(directory), "slk cli-test-v1-dirty");
});

test("machine-readable output and forwarded --help stay free of banners", () => {
  const result = cli(["check", "quality", "--list", "--output", "json", "--", "--help"], {
    FORCE_COLOR: "1",
    NO_COLOR: undefined,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(JSON.parse(result.stdout).profile, "quality");
  assert.ok(!result.stdout.includes(HELP_BANNER));
  assert.doesNotMatch(result.stdout, /\u001b\[/);
});
