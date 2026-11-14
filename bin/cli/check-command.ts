import { join } from "node:path";
import { checkPlan, type CheckProfile } from "./check-plan.ts";
import {
  createCheckDirectory,
  handleCheckOutputErrors,
  printCheckReport,
  runChecks,
  type OutputMode,
} from "./check-runner.ts";
import { root } from "./process.ts";

export async function checkCommand(options: {
  profile: CheckProfile;
  only: string[];
  output: OutputMode;
  list: boolean;
  tail: number;
  timeoutSeconds?: number;
  target?: "staging" | "production";
}): Promise<void> {
  handleCheckOutputErrors();
  if (!Number.isSafeInteger(options.tail) || options.tail < 1 || options.tail > 200)
    throw new Error("--tail must be an integer between 1 and 200.");
  if (
    options.timeoutSeconds !== undefined &&
    (!Number.isSafeInteger(options.timeoutSeconds) || options.timeoutSeconds < 1 || options.timeoutSeconds > 7200)
  )
    throw new Error("--timeout-seconds must be an integer between 1 and 7200.");
  const planOptions = {
    profile: options.profile,
    only: options.only,
    ...(options.target ? { target: options.target } : {}),
    reportDirectory: join(root, ".reports/checks/PLAN"),
  };
  const checks = checkPlan(planOptions);
  if (options.list) {
    if (options.output === "json") process.stdout.write(JSON.stringify({ profile: options.profile, checks }) + "\n");
    else
      for (const check of checks)
        process.stdout.write(
          `${check.id.padEnd(44)} ${check.group}${check.dependencies?.length ? ` (requires ${check.dependencies.join(", ")})` : ""}\n`,
        );
    return;
  }
  // The ready profile creates disposable CMS fixtures. Ambient test overrides
  // must not silently redirect those writes to staging or production.
  for (const check of checks.filter((check) => check.id === "dev")) {
    const offset = check.args.indexOf("src/run.ts") + 1;
    for (const value of check.args.slice(offset, offset + 2)) {
      const url = new URL(value);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error(
          "check ready live tests require loopback URLs without credentials, queries or fragments. Use slk test explicitly for other isolated test environments.",
        );
    }
  }
  const directory = createCheckDirectory();
  const report = await runChecks(checkPlan({ ...planOptions, reportDirectory: directory }), {
    profile: options.profile,
    selectors: options.only,
    directory,
    output: options.output,
    tail: options.tail,
    ...(options.timeoutSeconds === undefined ? {} : { timeoutSeconds: options.timeoutSeconds }),
    ...(options.target ? { target: options.target } : {}),
  });
  printCheckReport(report, options.output);
  process.exitCode = report.interrupted ? 130 : report.ok ? 0 : 1;
}
