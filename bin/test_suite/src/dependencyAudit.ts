import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
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
let status = 0;
for (const directory of packages) {
  const name = directory.replaceAll("/", "-");
  const result = spawnSync("npm", ["audit", "--package-lock-only", "--json"], {
    cwd: join(root, directory),
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  writeFileSync(join(output, name + ".json"), result.stdout || "{}", { mode: 0o600 });
  try {
    const parsed: unknown = JSON.parse(result.stdout);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("metadata" in parsed) ||
      !parsed.metadata ||
      typeof parsed.metadata !== "object" ||
      !("vulnerabilities" in parsed.metadata)
    )
      throw new Error("No audit metadata");
    const vulnerabilities = parsed.metadata.vulnerabilities as Record<string, number>;
    const high = Number(vulnerabilities.high || 0),
      critical = Number(vulnerabilities.critical || 0);
    console.log(`${directory}: ${critical} critical, ${high} high`);
    if (high || critical) status = Math.max(status, 1);
    if (result.status !== 0 && result.status !== 1) throw new Error("Audit command failed");
  } catch {
    console.error(`${directory}: audit failed; inspect registry access and report`);
    status = 2;
  }
}
console.log(`Reports: ${output}`);
process.exitCode = status;
