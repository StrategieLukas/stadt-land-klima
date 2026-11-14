import { readdirSync } from "node:fs";
import { join } from "node:path";
import { root } from "./process.ts";

export const CHECK_PROFILES = ["ready", "quality", "audit", "native", "release"] as const;
export type CheckProfile = (typeof CHECK_PROFILES)[number];
export type Check = {
  id: string;
  group: string;
  executable: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  dependencies?: string[];
  timeoutSeconds?: number;
};
export type PlanOptions = {
  profile: CheckProfile;
  only: string[];
  target?: "staging" | "production";
  reportDirectory: string;
};

export function checkPlan(options: PlanOptions): Check[] {
  if (options.profile === "release" && !options.target)
    throw new Error("The read-only release profile requires --target staging or --target production.");
  if (options.target && options.profile !== "release") throw new Error("--target is only supported by release.");
  const checks: Check[] = [
    {
      id: "runtime",
      group: "environment",
      executable: process.execPath,
      args: [
        "-e",
        'const fs = require("node:fs"); const expected = fs.readFileSync(".node-version", "utf8").trim().replace(/^v/, ""); if (process.versions.node !== expected) throw new Error(`Use Node ${expected} from .node-version; found ${process.versions.node}`); console.log(JSON.stringify({platform:process.platform,arch:process.arch,node:process.version}));',
      ],
      cwd: root,
    },
  ];
  const npm = (id: string, group: string, directory: string, script: string, args: string[] = []): Check => ({
    id,
    group,
    executable: "npm",
    args: ["--prefix", directory, "run", script, ...args],
    cwd: root,
  });
  const quality = options.profile === "quality" || options.profile === "ready";
  if (quality) {
    checks.push(
      npm("types.cli", "static", "bin", "typecheck"),
      npm("types.frontend", "static", "src/frontend", "typecheck"),
      npm("lint.frontend", "static", "src/frontend", "lint"),
      npm("lint.extensions", "static", "src/frontend", "lintExtensions"),
      npm("types.cms", "static", "src/directus/cli", "typecheck"),
      npm("types.tests", "static", "bin/test_suite", "typecheck"),
      npm("unit", "unit", "bin/test_suite", "test:unit"),
    );
    for (const entry of readdirSync(join(root, "src/directus/extensions"), { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name, "en"),
    )) {
      if (!entry.isDirectory()) continue;
      const directory = `src/directus/extensions/${entry.name}`;
      if (!readdirSync(join(root, directory)).includes("package-lock.json")) continue;
      checks.push(npm(`extensions.${entry.name}`, "extensions", directory, "build"));
    }
    checks.push(
      {
        id: "image.environment",
        group: "image",
        executable: "podman",
        args: [
          "build",
          "-t",
          "localhost/slk-runtime-env:local",
          "-f",
          "podman/environment/Containerfile",
          "podman/environment",
        ],
        cwd: root,
        timeoutSeconds: 1200,
      },
      {
        id: "image.build",
        group: "image",
        executable: "podman",
        args: [
          "build",
          "-t",
          "slk-directus-security:ci",
          "-f",
          "podman/directus/RuntimeContainerfile",
          "podman/directus",
        ],
        cwd: root,
        dependencies: ["image.environment"],
        timeoutSeconds: 1200,
      },
      {
        ...npm("image.audit", "image", "bin/test_suite", "audit:directus-image:reviewed", [
          "--",
          join(options.reportDirectory, "directus-image-audit"),
        ]),
        env: { SLK_SECURITY_IMAGE: "slk-directus-security:ci" },
        dependencies: ["image.build"],
      },
      { ...npm("caddy", "caddy", "bin/test_suite", "test:security:caddy"), timeoutSeconds: 1200 },
    );
  }
  if (options.profile === "audit" || options.profile === "ready")
    checks.push(
      npm("audit", "audit", "bin/test_suite", "audit:dependencies", [
        "--",
        join(options.reportDirectory, "dependency-audit"),
      ]),
    );
  if (options.profile === "native" || options.profile === "ready")
    checks.push({ ...npm("build", "build", "src/frontend", "build"), timeoutSeconds: 1200 });
  if (options.profile === "ready") {
    // This is the live half of `slk test dev`; unit already ran above.
    checks.push({
      id: "dev",
      group: "dev",
      executable: "npm",
      args: [
        "exec",
        "--no",
        "--",
        "tsx",
        "src/run.ts",
        process.env.SLK_TEST_BACKEND_URL || "http://localhost:8081",
        process.env.SLK_TEST_FRONTEND_URL || "http://localhost:8080",
        process.env.SLK_PODMAN_DIRECTUS_ENV_FILE || join(root, "src/directus/.env"),
      ],
      cwd: join(root, "bin/test_suite"),
      dependencies: ["unit"],
      timeoutSeconds: 900,
    });
    checks.push({ id: "diff", group: "diff", executable: "git", args: ["diff", "--check", "HEAD"], cwd: root });
  }
  if (options.profile === "release") {
    const origin =
      options.target === "staging" ? "https://staging.stadt-land-klima.de" : "https://www.stadt-land-klima.de";
    for (const [id, script] of [
      ["public", "test:public"],
      ["csp", "test:security:csp"],
      ["styles", "test:styles"],
    ] as const)
      checks.push(npm(id, "release", "bin/test_suite", script, ["--", origin]));
  }
  // Last, including after builds which may generate maintained source files.
  if (quality) checks.push(npm("format", "static", "src/frontend", "format:check"));

  for (const check of checks) {
    if (check.id !== "runtime") check.dependencies = ["runtime", ...(check.dependencies ?? [])];
  }
  if (!options.only.length) return checks;
  const selectors = options.only.flatMap((value) => value.split(","));
  for (const selector of selectors)
    if (!checks.some((check) => check.id === selector || check.group === selector))
      throw new Error(`Unknown check/group '${selector}' in ${options.profile}. Use --list to see valid selectors.`);
  const selected = new Set(
    checks.filter((check) => selectors.includes(check.id) || selectors.includes(check.group)).map((check) => check.id),
  );
  const includeDependencies = (id: string) => {
    for (const dependency of checks.find((check) => check.id === id)?.dependencies ?? []) {
      if (selected.has(dependency)) continue;
      selected.add(dependency);
      includeDependencies(dependency);
    }
  };
  for (const id of selected) includeDependencies(id);
  return checks.filter((check) => selected.has(check.id));
}
