/** Replace every reviewed pnpm store copy; keep the Directus host pinned. */
import { readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { dependencyReplacements } from "./dependency-replacements.ts";
import { streamJsonPatches } from "./stream-json-patches.ts";

const store = "/directus/node_modules/.pnpm";
const directories = await readdir(store, { withFileTypes: true });
const checked: { installed: string; replacement: string; name: string; version: string }[] = [];
for (const { name, original: originalVersion, replacement: alias, version } of dependencyReplacements) {
  const replacement = await realpath(new URL(`./node_modules/${alias}`, import.meta.url));
  const patched = JSON.parse(await readFile(join(replacement, "package.json"), "utf8")) as {
    name: string;
    version: string;
  };
  if (patched.name !== name || patched.version !== version) throw new Error(`Unexpected ${name} replacement`);
  let count = 0;
  for (const entry of directories) {
    const prefix = `${name.replace("/", "+")}@${originalVersion}`;
    if (!entry.isDirectory() || (entry.name !== prefix && !entry.name.startsWith(prefix + "_"))) continue;
    const installed = join(store, entry.name, "node_modules", name);
    const original = JSON.parse(await readFile(join(installed, "package.json"), "utf8")) as {
      name: string;
      version: string;
    };
    if (original.name !== name || original.version !== originalVersion)
      throw new Error(`Unreviewed deployed ${name} version`);
    checked.push({ installed, replacement, name, version });
    count++;
  }
  if (!count) throw new Error(`Directus layout changed: missing ${name}@${originalVersion}`);
}
const jsonFiles = await Promise.all(
  streamJsonPatches.map(async ({ file, sha256, replacements }) => {
    const installed = join(store, "stream-json@1.9.1/node_modules/stream-json", file);
    let source = await readFile(installed, "utf8");
    if (createHash("sha256").update(source).digest("hex") !== sha256)
      throw new Error(`Unreviewed stream-json source: ${file}`);
    for (const [marker, replacement] of replacements) {
      if (!source.includes(marker)) throw new Error(`Missing stream-json patch marker: ${file}`);
      source = source.replaceAll(marker, replacement);
    }
    return { installed, source };
  }),
);
// Validate the entire layout and source hashes before mutating any package.
for (const { installed, replacement, name, version } of checked) {
  await rm(installed, { recursive: true });
  await symlink(replacement, installed, "dir");
  console.info(`Patched deployed ${name} to ${version}`);
}
for (const { installed, source } of jsonFiles) await writeFile(installed, source);
