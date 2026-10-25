import { createHash } from "node:crypto";
import {
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const marker = ".slk-production.json";
const generated = new Set([
  "node_modules",
  ".nuxt",
  ".output",
  ".git",
  ".cache",
  ".npm",
  ".reports",
  "coverage",
  ".data",
  "logs",
]);
const volatileEnvironment = new Set(["HOSTNAME", "PWD", "OLDPWD", "SHLVL", "_", "TERM"]);

function treeHash(root: string, source: boolean): string {
  const hash = createHash("sha256");
  function visit(directory: string) {
    for (const name of readdirSync(directory).sort()) {
      if (
        source &&
        (name === "node_modules" ||
          (directory === root &&
            (generated.has(name) || name === ".eslintcache" || /^report\.\d.*\.json$/.test(name))) ||
          name.endsWith(".tsbuildinfo"))
      )
        continue;
      if (!source && directory === root && name === marker) continue;
      const path = join(directory, name);
      const info = lstatSync(path);
      const label = relative(root, path).split(sep).join("/");
      if (info.isSymbolicLink()) {
        const target = realpathSync(path);
        if (!target.startsWith(resolve(root) + sep))
          throw new Error("Production input/output symlink escapes its root");
        hash.update(`L${label}\0${readlinkSync(path)}\0`);
      } else if (info.isDirectory()) {
        hash.update(`D${label}\0`);
        visit(path);
      } else if (info.isFile()) {
        hash.update(`F${label}\0`).update(readFileSync(path)).update("\0");
      } else throw new Error("Unsupported production input/output file");
    }
  }
  visit(root);
  return hash.digest("hex");
}

export function productionInputHash(
  frontend: string,
  translations: string,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const stable = Object.fromEntries(
    Object.entries(environment)
      .filter(([key, value]) => value !== undefined && !volatileEnvironment.has(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const report = process.report.getReport();
  const header = typeof report === "object" && "header" in report ? report.header : undefined;
  const libc =
    header && typeof header === "object" && "glibcVersionRuntime" in header ? header.glibcVersionRuntime : undefined;
  return createHash("sha256")
    .update(
      JSON.stringify({
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        libc,
        environment: stable,
      }),
    )
    .update(treeHash(frontend, true))
    .update(treeHash(translations, true))
    .digest("hex");
}

export function invalidateProductionOutput(frontend: string) {
  rmSync(join(frontend, ".output", marker), { force: true });
  rmSync(join(frontend, ".output", marker + ".tmp"), { force: true });
}

export function stampProductionOutput(
  frontend: string,
  translations: string,
  expected: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const input = productionInputHash(frontend, translations, environment);
  if (input !== expected) throw new Error("Production inputs changed during the build; rebuild before starting");
  const output = join(frontend, ".output");
  if (!lstatSync(join(output, "server/index.mjs")).isFile()) throw new Error("Production server output is missing");
  const value = { version: 1, input, output: treeHash(output, false) };
  const temporary = join(output, marker + ".tmp");
  writeFileSync(temporary, JSON.stringify(value) + "\n", { mode: 0o600 });
  renameSync(temporary, join(output, marker));
}

export function verifyProductionOutput(
  frontend: string,
  translations: string,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    const output = join(frontend, ".output");
    const value: unknown = JSON.parse(readFileSync(join(output, marker), "utf8"));
    return (
      !!value &&
      typeof value === "object" &&
      "version" in value &&
      value.version === 1 &&
      "input" in value &&
      value.input === productionInputHash(frontend, translations, environment) &&
      "output" in value &&
      value.output === treeHash(output, false) &&
      lstatSync(join(output, "server/index.mjs")).isFile()
    );
  } catch {
    return false;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const translations = resolve(frontend, "../directus/translations");
  switch (process.argv[2]) {
    case "verify":
      process.exitCode = verifyProductionOutput(frontend, translations) ? 0 : 1;
      break;
    case "prepare":
      invalidateProductionOutput(frontend);
      console.log(productionInputHash(frontend, translations));
      break;
    case "stamp":
      if (!/^[a-f0-9]{64}$/.test(process.argv[3] ?? "")) throw new Error("Expected production input fingerprint");
      stampProductionOutput(frontend, translations, process.argv[3]!);
      break;
    case undefined:
    default:
      throw new Error("Usage: productionOutput.mts verify|prepare|stamp <input-fingerprint>");
  }
}
