import { spawn, execFileSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { stripVTControlCharacters } from "node:util";
import type { Check, CheckProfile } from "./check-plan.ts";
import { root } from "./process.ts";

export type CheckResult = {
  id: string;
  status: "passed" | "failed" | "blocked";
  durationMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  reason: string | null;
  log: string | null;
  excerpt: string;
};
export type CheckReport = {
  version: 1;
  profile: CheckProfile;
  selectors: string[];
  target: string | null;
  platform: NodeJS.Platform;
  arch: string;
  node: string;
  revision: string | null;
  dirty: boolean | null;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean;
  interrupted: boolean;
  directory: string;
  checks: CheckResult[];
  pending: string[];
};
export type OutputMode = "summary" | "json" | "full";

let outputHandlersInstalled = false;
export function handleCheckOutputErrors(): void {
  if (outputHandlersInstalled) return;
  outputHandlersInstalled = true;
  for (const stream of [process.stdout, process.stderr]) {
    stream.on("error", (error: NodeJS.ErrnoException) => {
      // A consumer such as head may close early. Continue running checks and
      // writing their logs; an output pipe must never turn a failure into a pass.
      if (error.code !== "EPIPE") throw error;
    });
  }
}

export function createCheckDirectory(): string {
  const parent = join(root, ".reports/checks");
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const directory = mkdtempSync(join(parent, new Date().toISOString().replace(/[:.]/g, "-") + "-"));
  chmodSync(directory, 0o700);
  return directory;
}

// npm.cmd cannot be spawned without a shell on Windows. Execute npm's JS entry
// with Node on every OS, preserving argv boundaries without shell interpolation.
export function npmInvocation(args: string[]): { executable: string; args: string[] } {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    join(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
    ...(process.env.PATH || "").split(delimiter).flatMap((directory) => {
      const path = join(directory, "npm");
      return [...(existsSync(path) ? [realpathSync(path)] : []), join(directory, "node_modules/npm/bin/npm-cli.js")];
    }),
  ];
  const entry = candidates.find((path) => path?.endsWith("npm-cli.js") && existsSync(path));
  if (!entry) throw new Error("Cannot locate npm-cli.js; install Node/npm using .node-version.");
  return { executable: process.execPath, args: [resolve(entry), ...args] };
}

export function logExcerpt(path: string, lines: number): string {
  // Read only the final 32 KiB: large logs and unbroken lines cannot exhaust
  // memory or the agent's context. Complete bytes remain in the private log.
  const fd = openSync(path, "r");
  try {
    const size = statSync(path).size;
    const length = Math.min(size, 32768);
    const buffer = Buffer.alloc(length);
    const bytesRead = readSync(fd, buffer, 0, length, size - length);
    const clean = stripVTControlCharacters(buffer.subarray(0, bytesRead).toString("utf8")).replace(
      /[^\S\n\t\r]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,
      " ",
    );
    const tail = clean.trimEnd().split(/\r?\n/).slice(-lines).join("\n");
    return tail.slice(-12000);
  } finally {
    closeSync(fd);
  }
}

function gitValue(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

async function executeCheck(
  check: Check,
  directory: string,
  output: OutputMode,
  tail: number,
  signal: AbortSignal,
  timeoutSeconds: number,
): Promise<CheckResult> {
  const started = Date.now();
  const log = join(directory, `${check.id}.log`);
  const fd = openSync(log, "wx", 0o600);
  let reason: string | null = null;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  try {
    const invocation = check.executable === "npm" ? npmInvocation(check.args) : check;
    await new Promise<void>((done) => {
      const child = spawn(invocation.executable, invocation.args, {
        cwd: check.cwd,
        env: { ...process.env, ...check.env },
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const pausedWriters = new Set<() => void>();
      const kill = (force: boolean) => {
        if (!child.pid) return;
        try {
          if (process.platform === "win32") {
            // Fixed executable/arguments; never interpolate a command string.
            execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", timeout: 5000 });
          } else process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
        } catch {
          /* Child/process group may already have exited. */
        }
      };
      const stop = (message: string) => {
        reason ??= message;
        kill(false);
        for (const resume of pausedWriters) resume();
        killTimer ??= setTimeout(() => kill(true), 5000);
      };
      const abort = () => stop("Interrupted");
      signal.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(() => stop(`Timed out after ${timeoutSeconds}s`), timeoutSeconds * 1000);
      const write = (chunk: Buffer, stream: NodeJS.WriteStream, source: NodeJS.ReadableStream) => {
        writeFileSync(fd, chunk);
        if (output === "full" && reason === null && !stream.destroyed && !stream.write(chunk)) {
          source.pause();
          const resume = () => {
            pausedWriters.delete(resume);
            stream.removeListener("drain", resume);
            stream.removeListener("error", resume);
            stream.removeListener("close", resume);
            source.resume();
          };
          pausedWriters.add(resume);
          stream.once("drain", resume);
          stream.once("error", resume);
          stream.once("close", resume);
        }
      };
      child.stdout.on("data", (chunk: Buffer) => write(chunk, process.stdout, child.stdout));
      child.stderr.on("data", (chunk: Buffer) => write(chunk, process.stderr, child.stderr));
      child.on("error", (error: NodeJS.ErrnoException) => {
        reason = `Could not start ${check.executable}: ${error.code ?? "spawn error"}`;
      });
      child.on("close", (code, childSignal) => {
        clearTimeout(timer);
        for (const resume of pausedWriters) resume();
        // Kill surviving descendants after timeout/interruption even if the
        // immediate parent closed first. Normal commands are left untouched.
        if (reason) kill(true);
        if (killTimer) clearTimeout(killTimer);
        signal.removeEventListener("abort", abort);
        exitCode = code;
        exitSignal = childSignal;
        done();
      });
      if (signal.aborted) abort();
    });
  } catch (error) {
    reason = error instanceof Error ? error.message : "Check could not start";
  } finally {
    closeSync(fd);
  }
  const passed = exitCode === 0 && reason === null;
  return {
    id: check.id,
    status: passed ? "passed" : "failed",
    durationMs: Date.now() - started,
    exitCode,
    signal: exitSignal,
    reason: reason ?? (passed ? null : `Exited ${exitCode ?? exitSignal ?? "without a status"}`),
    log,
    excerpt: passed ? "" : logExcerpt(log, tail),
  };
}

export async function runChecks(
  checks: Check[],
  options: {
    profile: CheckProfile;
    selectors: string[];
    target?: string;
    directory: string;
    output: OutputMode;
    tail: number;
    timeoutSeconds?: number;
    signal?: AbortSignal;
  },
): Promise<CheckReport> {
  handleCheckOutputErrors();
  const status = gitValue(["status", "--porcelain"]);
  const report: CheckReport = {
    version: 1,
    profile: options.profile,
    selectors: options.selectors,
    target: options.target ?? null,
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    revision: gitValue(["rev-parse", "HEAD"]),
    dirty: status === null ? null : status !== "",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    ok: false,
    interrupted: false,
    directory: options.directory,
    checks: [],
    pending:
      options.profile === "ready"
        ? [
            "Native macOS and Windows clean installs/builds require those hosts or the manual native workflow.",
            "Deployed release acceptance requires an authorized target serving this revision.",
          ]
        : options.profile === "native"
          ? [
              "This result covers the current host only; the native workflow requires clean macOS and Windows installs/builds.",
            ]
          : options.profile === "release"
            ? [
                "Confirm the deployed target serves the intended revision; these read-only tests do not deploy or attest its Git revision.",
              ]
            : [],
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const save = () => {
    const temporary = join(options.directory, "report.json.tmp");
    writeFileSync(temporary, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    renameSync(temporary, join(options.directory, "report.json"));
  };
  try {
    save();
    for (const check of checks) {
      const missing =
        check.dependencies?.filter(
          (id) => !report.checks.some((result) => result.id === id && result.status === "passed"),
        ) ?? [];
      if (controller.signal.aborted || missing.length) {
        report.checks.push({
          id: check.id,
          status: "blocked",
          durationMs: 0,
          exitCode: null,
          signal: null,
          reason: controller.signal.aborted ? "Run interrupted" : `Requires passing: ${missing.join(", ")}`,
          log: null,
          excerpt: "",
        });
      } else {
        process.stderr.write(`Running ${check.id}\n`);
        report.checks.push(
          await executeCheck(
            check,
            options.directory,
            options.output,
            options.tail,
            controller.signal,
            options.timeoutSeconds ?? check.timeoutSeconds ?? 600,
          ),
        );
        const result = report.checks.at(-1)!;
        process.stderr.write(
          `${result.status.toUpperCase()} ${result.id} (${(result.durationMs / 1000).toFixed(1)}s)\n`,
        );
      }
      save();
    }
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
    options.signal?.removeEventListener("abort", abort);
    report.finishedAt = new Date().toISOString();
    report.interrupted = controller.signal.aborted;
    report.ok =
      checks.length > 0 &&
      !report.interrupted &&
      report.checks.length === checks.length &&
      report.checks.every((check) => check.status === "passed");
    save();
  }
  return report;
}

export function printCheckReport(report: CheckReport, output: OutputMode): void {
  if (output === "json") {
    process.stdout.write(JSON.stringify(report) + "\n");
    return;
  }
  process.stdout.write(
    `\n${report.ok ? "PASS" : "FAIL"} ${report.profile}${report.selectors.length ? ` (selected: ${report.selectors.join(", ")}; prerequisites included)` : ""} — ${report.platform}/${report.arch}, Node ${report.node}\n`,
  );
  for (const check of report.checks) {
    process.stdout.write(
      `${check.status.toUpperCase().padEnd(7)} ${check.id} ${(check.durationMs / 1000).toFixed(1)}s${check.reason ? ` — ${check.reason}` : ""}\n`,
    );
    if (check.status === "failed") {
      if (check.excerpt && output !== "full") process.stdout.write(check.excerpt + "\n");
      process.stdout.write(`Log: ${check.log}\n`);
    }
  }
  for (const pending of report.pending) process.stdout.write(`PENDING ${pending}\n`);
  process.stdout.write(`Report: ${join(report.directory, "report.json")}\n`);
}
