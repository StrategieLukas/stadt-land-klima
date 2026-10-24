import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const configFile = join(root, "tsconfig.json");
const raw = ts.readConfigFile(configFile, ts.sys.readFile);
if (raw.error) throw new Error("Cannot read CLI compiler configuration");
const config = ts.parseJsonConfigFileContent(raw.config, ts.sys, root, undefined, configFile);
if (config.errors.length || !config.options.strict || config.options.allowJs !== false || !config.options.noEmit) {
  throw new Error("CLI sources require strict noEmit checking with JavaScript disabled");
}
const checked = new Set(config.fileNames.map((file) => resolve(file)));
let count = 0;
function inspect(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      inspect(file);
      continue;
    }
    if (!/\.(?:ts|mts|cts|tsx|js|mjs|cjs|jsx)$/.test(entry.name)) continue;
    // The historical executable remains a minimal ESM/tsx bootstrap, covered by CLI tests.
    if (file === join(root, "index.mjs")) continue;
    if (!checked.has(resolve(file))) throw new Error(`Unchecked CLI source: ${file}`);
    count++;
  }
}
inspect(root);
console.info(`CLI source coverage: ${count} checked files`);
