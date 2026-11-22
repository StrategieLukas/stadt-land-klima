/** Shared by the deployment CLI and its separately installed, root-owned backup helper. */
import { createHash } from "node:crypto";
import { createReadStream, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const releaseTagPattern = /^release-[a-f0-9]{8,40}$/;
export const releasePayloads = [
  "database.before.dump",
  "database.before.json",
  "uploads.before.tar",
  "frontend-output.before.tar",
  "source.before.tar.gz",
  "config.before.tar.gz",
  "private-env.before.tar.gz",
] as const;
export function privateReleasePath(path: string, owner: number, directory = false): void {
  const stat = lstatSync(path);
  if (
    stat.isSymbolicLink() ||
    (directory ? !stat.isDirectory() : !stat.isFile()) ||
    stat.uid !== owner ||
    (stat.mode & 0o077) !== 0
  )
    throw new Error("Release checkpoints must be private regular files/directories owned by the deployment user");
}
export function checkpointManifest(directory: string, owner: number): Map<string, string> {
  privateReleasePath(directory, owner, true);
  privateReleasePath(join(directory, "backups.sha256"), owner);
  const entries = new Map<string, string>();
  for (const line of readFileSync(join(directory, "backups.sha256"), "utf8").trim().split("\n")) {
    const match = /^([a-f0-9]{64})  ([a-z.-]+)$/.exec(line);
    if (!match || !releasePayloads.some((name) => name === match[2]) || entries.has(match[2]!))
      throw new Error("Unexpected release backup manifest entry");
    privateReleasePath(join(directory, match[2]!), owner);
    entries.set(match[2]!, match[1]!);
  }
  if (entries.size !== releasePayloads.length) throw new Error("Incomplete automatic-release backup");
  return entries;
}
export async function fileDigest(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function verifyCheckpoint(directory: string, owner: number) {
  const entries = checkpointManifest(directory, owner);
  for (const [name, expected] of entries)
    if ((await fileDigest(join(directory, name))) !== expected) throw new Error("Release backup checksum mismatch");
  return entries;
}
export function checkedDataCounts(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") throw new Error("Missing application backup counts");
  const values = Object.entries(input);
  if (
    values.length !== 3 ||
    !["municipalities", "elections", "content_translation_memory"].every((key) => Object.hasOwn(input, key)) ||
    values.some(([, value]) => !Number.isSafeInteger(value) || Number(value) < 0)
  )
    throw new Error("Invalid application backup counts");
  return Object.fromEntries(values) as Record<string, number>;
}
