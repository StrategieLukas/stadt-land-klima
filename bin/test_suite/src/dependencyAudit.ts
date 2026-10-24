import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import {
  auditAnnotation,
  auditExitCode,
  auditSummary,
  parseAudit,
  type AuditReport,
} from "./lib/dependencyAuditReport.js";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = resolve(process.argv[2] || join(root, ".reports", "dependency-audit"));
mkdirSync(output, { recursive: true, mode: 0o700 });
const packages = [
  "src/frontend",
  "src/directus/cli",
  "bin/test_suite",
  "docker/directus/security-patches",
  "src/directus/openapi-documentation",
  ...readdirSync(join(root, "src/directus/extensions"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => "src/directus/extensions/" + entry.name)
    .filter((path) => {
      try {
        readFileSync(join(root, path, "package-lock.json"));
        return true;
      } catch {
        return false;
      }
    }),
];
const reports: AuditReport[] = [];
for (const directory of packages) {
  const name = directory.replaceAll("/", "-");
  console.log(`Auditing ${directory}...`);
  const result = spawnSync("npm", ["audit", "--package-lock-only", "--json"], {
    cwd: join(root, directory),
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(join(output, name + ".json"), result.stdout || "{}", { mode: 0o600 });
  const report = parseAudit(directory, result);
  reports.push(report);
  if (report.error) console.error(`${directory}: ${report.error}`);
  else {
    console.log(`${directory}: ${report.critical} critical, ${report.high} high`);
    if (report.affected.length) console.log(`  Affected packages: ${report.affected.join(", ")}`);
    for (const advisory of report.advisories) console.log(`  Advisory: ${advisory}`);
  }
  if (process.env.GITHUB_ACTIONS === "true" && (report.error || report.high || report.critical)) {
    console.log(auditAnnotation(report));
  }
}
const summary = auditSummary(reports);
writeFileSync(join(output, "summary.md"), summary, { mode: 0o600 });
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(`Reports: ${output}`);
process.exitCode = auditExitCode(reports);
