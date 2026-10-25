import ts from "typescript";
import { z } from "zod";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ignored = new Set(["node_modules", ".nuxt", ".output", ".git", "public", "dist"]);
export function maintainedSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return ignored.has(entry.name) ? [] : maintainedSources(path);
    return /\.(?:[cm]?[jt]s|[jt]sx|vue)$/.test(entry.name) ? [path] : [];
  });
}
export function checkTypeCoverage(directory = root) {
  const covered = new Set<string>();
  const contexts = ["app", "server", "shared", "node"];
  const configs = contexts
    .map((context) => `.nuxt/tsconfig.${context}.json`)
    .concat(["scripts/tsconfig.json", "tsconfig.tooling.json"]);
  for (const config of configs) {
    const filename = resolve(directory, config);
    const parsed = ts.getParsedCommandLineOfConfigFile(
      filename,
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
          throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
        },
      },
      undefined,
      undefined,
      [{ extension: ".vue", isMixedContent: true, scriptKind: ts.ScriptKind.Deferred }],
    );
    if (!parsed || parsed.errors.length) throw new Error(`Invalid typecheck config: ${config}`);
    for (const option of [
      "strict",
      "noUncheckedIndexedAccess",
      "exactOptionalPropertyTypes",
      "noImplicitReturns",
      "noFallthroughCasesInSwitch",
    ] as const) {
      if (parsed.options[option] !== true) throw new Error(`${config} must enable ${option}`);
    }
    if (config.startsWith(".nuxt/") && parsed.options.allowJs !== false)
      throw new Error(`${config} must disable application JS`);
    if (
      config === ".nuxt/tsconfig.app.json" &&
      !z
        .object({
          vueCompilerOptions: z.object({ strictTemplates: z.literal(true), checkUnknownEvents: z.literal(true) }),
        })
        .safeParse(parsed.raw).success
    ) {
      throw new Error("Application templates must enable strictTemplates");
    }
    for (const file of parsed.fileNames) covered.add(resolve(file));
  }
  const sources = maintainedSources(directory);
  const missing = sources.filter((file) => !covered.has(file));
  if (missing.length)
    throw new Error(`Unchecked sources:\n${missing.map((file) => relative(directory, file)).join("\n")}`);
  for (const file of sources.filter((file) => file.endsWith(".vue"))) {
    for (const match of readFileSync(file, "utf8").matchAll(/<script\b([^>]*)>/g)) {
      if (!/\blang=["']ts["']/.test(match[1] ?? ""))
        throw new Error(`Unchecked Vue script: ${relative(directory, file)}`);
    }
  }
  return sources.length;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Type coverage verified: ${checkTypeCoverage()} maintained source files.`);
}
