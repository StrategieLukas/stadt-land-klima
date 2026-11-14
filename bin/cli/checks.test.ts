import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test, type TestContext } from "node:test";
import { parse } from "yaml";
import { checkPlan, type Check, type PlanOptions } from "./check-plan.ts";
import { logExcerpt, npmInvocation, runChecks } from "./check-runner.ts";
import { root } from "./process.ts";

function fixture(t: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), "slk-checks-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
const planOptions: PlanOptions = { profile: "quality", only: [], reportDirectory: join(tmpdir(), "slk-check-plan") };
const nodeCheck = (id: string, code: string, args: string[] = []): Check => ({
  id,
  group: "fixture",
  executable: process.execPath,
  args: ["-e", code, ...args],
  cwd: root,
});
const runOptions = (directory: string) => ({
  profile: "quality" as const,
  selectors: [],
  directory,
  output: "summary" as const,
  tail: 3,
});

test("selectors include prerequisites in order, reject typos, preserve release targeting and avoid duplicate unit runs", () => {
  assert.deepEqual(
    checkPlan({ ...planOptions, only: ["image.audit"] }).map((check) => check.id),
    ["runtime", "image.environment", "image.build", "image.audit"],
  );
  assert.throws(() => checkPlan({ ...planOptions, only: ["statci"] }), /Unknown check/);
  assert.throws(() => checkPlan({ ...planOptions, profile: "release" }), /requires --target/);
  assert.throws(() => checkPlan({ ...planOptions, target: "production" }), /only supported by release/);
  const ready = checkPlan({ ...planOptions, profile: "ready" });
  assert.equal(ready.filter((check) => check.id === "unit").length, 1);
  assert.equal(ready.at(-1)!.id, "format");
  assert.deepEqual(ready.find((check) => check.id === "diff")!.args, ["diff", "--check", "HEAD"]);
  assert.ok(ready.find((check) => check.id === "dev")!.dependencies!.includes("unit"));
  for (const target of ["staging", "production"] as const) {
    const plan = checkPlan({ ...planOptions, profile: "release", target });
    assert.deepEqual(
      plan.map((check) => check.id),
      ["runtime", "public", "csp", "styles"],
    );
    assert.ok(
      plan
        .slice(1)
        .every(
          (check) =>
            check.args.at(-1) ===
            (target === "staging" ? "https://staging.stadt-land-klima.de" : "https://www.stadt-land-klima.de"),
        ),
    );
  }
});

test("all workflow gates use the shared runner and quality steps cover its complete plan", () => {
  const files = readdirSync(join(root, ".github/workflows"))
    .filter((name) => /\.ya?ml$/.test(name))
    .sort();
  assert.deepEqual(
    files,
    ["dependency-audit.yml", "native-frontend.yml", "quality.yml", "release-acceptance.yml"],
    "Register new workflows in the check runner and this parity test",
  );
  const covered = new Set<string>();
  for (const name of files) {
    const workflow = parse(readFileSync(join(root, ".github/workflows", name), "utf8")) as {
      jobs: Record<string, { steps: { run?: string; uses?: string; if?: string; with?: Record<string, unknown> }[] }>;
    };
    for (const job of Object.values(workflow.jobs)) {
      const artifacts = job.steps.filter((step) => step.uses?.startsWith("actions/upload-artifact@"));
      assert.equal(artifacts.length, 1, `${name} must retain its check results`);
      assert.equal(artifacts[0]!.if, "always()");
      assert.equal(artifacts[0]!.with?.path, ".reports/checks/");
      assert.equal(artifacts[0]!.with?.["include-hidden-files"], true);
      assert.equal(artifacts[0]!.with?.["retention-days"], 14);
    }
    const commands = Object.values(workflow.jobs)
      .flatMap((job) => job.steps)
      .flatMap((step) => (step.run ? [step.run.trim()] : []));
    const runnerCommands = commands.filter((command) => command.startsWith("node bin/slk check "));
    assert.ok(runnerCommands.length > 0, `${name} must execute shared gates`);
    assert.ok(
      commands.some((command) => /npm ci[^\n]*--prefix bin(?: |$|\n)/.test(command)),
      `${name} must bootstrap the CLI`,
    );
    for (const command of runnerCommands) {
      if (name === "quality.yml") {
        const selector = /--only ([\w.,-]+)/.exec(command)?.[1];
        assert.ok(selector, "Quality job steps must declare their scope");
        assert.match(command, /^node bin\/slk check quality /);
        for (const check of checkPlan({ ...planOptions, only: [selector] })) covered.add(check.id);
      } else if (name === "dependency-audit.yml") assert.match(command, /^node bin\/slk check audit --output full$/);
      else if (name === "native-frontend.yml") assert.match(command, /^node bin\/slk check native --output full$/);
      else assert.match(command, /^node bin\/slk check release --target "\$SLK_RELEASE_TARGET" --output full$/);
    }
    assert.ok(
      commands.every((command) => !/npm .*run (?:typecheck|lint|build|test:|audit:|format:)/.test(command)),
      "Gates belong in the shared plan, not inline workflow copies",
    );
  }
  assert.deepEqual(
    [...covered].sort(),
    checkPlan(planOptions)
      .map((check) => check.id)
      .sort(),
  );
});

test("exit statuses determine outcomes, logs are complete/private, excerpts are bounded, and unrelated checks continue", async (t) => {
  const directory = fixture(t);
  const literal = 'literal $(exit 99); "quoted" & argument';
  const report = await runChecks(
    [
      nodeCheck(
        "success",
        'console.log("error is just fixture text"); console.error("stderr fixture"); console.log(process.argv[1]);',
        [literal],
      ),
      nodeCheck(
        "failure",
        'console.log("first diagnostic"); console.log("x".repeat(100000)); console.log("last diagnostic"); process.exitCode = 17;',
      ),
      {
        ...nodeCheck(
          "blocked",
          `require("node:fs").writeFileSync(${JSON.stringify(join(directory, "must-not-exist"))}, "bad")`,
        ),
        dependencies: ["failure"],
      },
      nodeCheck("independent", 'console.log("still ran")'),
    ],
    runOptions(directory),
  );
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.checks.map((check) => check.status),
    ["passed", "failed", "blocked", "passed"],
  );
  assert.equal(report.checks[1]!.exitCode, 17);
  assert.ok(report.checks[1]!.excerpt.length <= 12000);
  assert.match(report.checks[1]!.excerpt, /last diagnostic/);
  assert.match(readFileSync(report.checks[1]!.log!, "utf8"), /first diagnostic/);
  assert.ok(readFileSync(report.checks[1]!.log!, "utf8").length > 100000);
  assert.ok(readFileSync(report.checks[0]!.log!, "utf8").includes(literal));
  assert.match(readFileSync(report.checks[0]!.log!, "utf8"), /stderr fixture/);
  assert.equal(existsSync(join(directory, "must-not-exist")), false);
  assert.equal(JSON.parse(readFileSync(join(directory, "report.json"), "utf8")).ok, false);
  if (process.platform !== "win32") assert.equal(statSync(report.checks[0]!.log!).mode & 0o777, 0o600);
  assert.equal(logExcerpt(report.checks[1]!.log!, 1), "last diagnostic");
});

test("missing executables and timeouts cannot pass, even if a process exits zero on termination", async (t) => {
  const directory = fixture(t);
  const report = await runChecks(
    [
      { id: "missing", group: "fixture", executable: join(directory, "no-such-tool"), args: [], cwd: root },
      {
        ...nodeCheck("timeout", 'process.on("SIGTERM", () => process.exit(0)); setInterval(() => {}, 1000);'),
        timeoutSeconds: 0.3,
      },
    ],
    runOptions(directory),
  );
  assert.equal(report.ok, false);
  assert.equal(report.checks[0]!.status, "failed");
  assert.match(report.checks[0]!.reason!, /Could not start/);
  assert.equal(report.checks[1]!.status, "failed");
  assert.match(report.checks[1]!.reason!, /Timed out/);
});

test("interruption records failed/blocked outcomes and always writes a final unsuccessful report", async (t) => {
  const directory = fixture(t);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 200);
  t.after(() => clearTimeout(timer));
  const report = await runChecks(
    [nodeCheck("waiting", "setInterval(() => {}, 1000)"), nodeCheck("later", 'console.log("must not run")')],
    { ...runOptions(directory), signal: controller.signal },
  );
  assert.equal(report.interrupted, true);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.checks.map((check) => check.status),
    ["failed", "blocked"],
  );
  assert.ok(report.finishedAt);
  assert.equal(JSON.parse(readFileSync(join(directory, "report.json"), "utf8")).interrupted, true);
});

test("CLI JSON stdout stays machine readable, npm keeps argv boundaries, and native results identify their host", (t) => {
  const output = execFileSync(
    process.execPath,
    [join(root, "bin/slk"), "check", "native", "--only", "runtime", "--output", "json"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const report = JSON.parse(output);
  t.after(() => rmSync(report.directory, { recursive: true, force: true }));
  assert.equal(report.ok, true);
  assert.equal(report.platform, process.platform);
  assert.ok(report.pending.length > 0);
  assert.equal(report.checks.length, 1);
  assert.equal(report.checks[0].id, "runtime");
  const literal = '$(exit 99); "quoted" & argument';
  const invocation = npmInvocation(["--version", literal]);
  assert.equal(invocation.executable, process.execPath);
  assert.ok(invocation.args[0]!.endsWith("npm-cli.js"));
  assert.equal(invocation.args.at(-1), literal);
});

test("CLI rejects a nonlocal live target before executing any checks", () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, [join(root, "bin/slk"), "check", "ready", "--only", "dev"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, SLK_TEST_BACKEND_URL: "https://www.stadt-land-klima.de/backend" },
      }),
    /require loopback URLs/,
  );
});

test("check CLI boots with only bin dependencies, as audit/native/release jobs require", (t) => {
  const directory = fixture(t);
  mkdirSync(join(directory, "bin"));
  cpSync(join(root, "bin/cli"), join(directory, "bin/cli"), { recursive: true });
  cpSync(join(root, "bin/lib"), join(directory, "bin/lib"), { recursive: true });
  for (const path of ["bin/slk", "bin/package.json", ".node-version"]) {
    mkdirSync(join(directory, path, ".."), { recursive: true });
    cpSync(join(root, path), join(directory, path));
  }
  symlinkSync(join(root, "bin/node_modules"), join(directory, "bin/node_modules"), "junction");
  const output = execFileSync(
    process.execPath,
    [join(directory, "bin/slk"), "check", "native", "--only", "runtime", "--output", "json"],
    {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  assert.equal(JSON.parse(output).ok, true);
  assert.equal(existsSync(join(directory, "src/directus/cli/node_modules")), false);
  assert.equal(existsSync(join(directory, "src/frontend/node_modules")), false);
});

test("full output and the private log preserve a large stream byte-for-byte", (t) => {
  const directory = fixture(t);
  const size = 2 * 1024 * 1024;
  const code = `
    import { runChecks } from ${JSON.stringify(new URL("./check-runner.ts", import.meta.url).href)};
    const report = await runChecks([${JSON.stringify(nodeCheck("large", `process.stdout.write("a".repeat(${size}))`))}],
      ${JSON.stringify({ ...runOptions(directory), output: "full" })});
    if (!report.ok) process.exitCode = 1;
  `;
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: 10000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(output.length, size);
  assert.equal(statSync(join(directory, "large.log")).size, size);
  assert.ok(/^a+$/.test(output));
});

test("a closed output consumer neither crashes the runner nor hides a subsequent failing check", async (t) => {
  const directory = fixture(t);
  const code = `
    import { runChecks, printCheckReport } from ${JSON.stringify(new URL("./check-runner.ts", import.meta.url).href)};
    const report = await runChecks(${JSON.stringify([
      nodeCheck("stream", 'process.stdout.write("a".repeat(2 * 1024 * 1024))'),
      nodeCheck("failure", "process.exitCode = 17"),
    ])}, ${JSON.stringify({ ...runOptions(directory), output: "full" })});
    printCheckReport(report, "full");
    process.exitCode = report.ok ? 0 : 1;
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
    cwd: root,
    stdio: ["ignore", "pipe", "ignore"],
  });
  child.stdout.destroy();
  const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
  t.after(() => clearTimeout(timer));
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  assert.equal(exitCode, 1);
  const report = JSON.parse(readFileSync(join(directory, "report.json"), "utf8"));
  assert.equal(report.checks[0].status, "passed");
  assert.equal(report.checks[1].exitCode, 17);
  assert.equal(report.ok, false);
  assert.equal(statSync(join(directory, "stream.log")).size, 2 * 1024 * 1024);
});

test("a stalled full-output consumer cannot prevent a check's timeout from completing its report", async (t) => {
  const directory = fixture(t);
  const code = `
    import { runChecks } from ${JSON.stringify(new URL("./check-runner.ts", import.meta.url).href)};
    const report = await runChecks(${JSON.stringify([
      {
        ...nodeCheck(
          "blocked-output",
          'process.stdout.write("a".repeat(8 * 1024 * 1024)); setInterval(() => {}, 1000)',
        ),
        timeoutSeconds: 0.3,
      },
    ])}, ${JSON.stringify({ ...runOptions(directory), output: "full" })});
    process.exitCode = report.ok ? 0 : 1;
  `;
  const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
    cwd: root,
    stdio: ["ignore", "pipe", "ignore"],
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  t.after(() => {
    child.stdout.resume();
    child.kill("SIGKILL");
  });
  const path = join(directory, "report.json");
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (existsSync(path) && JSON.parse(readFileSync(path, "utf8")).finishedAt) break;
    await delay(20);
  }
  const report = JSON.parse(readFileSync(path, "utf8"));
  assert.ok(report.finishedAt, "The check must finish even while its output consumer is stalled");
  assert.equal(report.ok, false);
  assert.match(report.checks[0].reason, /Timed out/);
  child.stdout.resume();
  assert.equal(await exited, 1);
});
