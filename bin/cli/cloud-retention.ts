/** Standalone, root-owned installable helper; credentials stay in Restic's environment. */
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function cloudRetentionArguments(host: string, tag: string, apply = false) {
  if (![host, tag].every((value) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value)))
    throw new Error("Explicit safe backup host and tag are required");
  return [
    "forget",
    "--host",
    host,
    "--tag",
    tag,
    // Group by host, rather than paths: changing an input path must not create
    // another five-snapshot retention group. The tag filter isolates this app.
    "--group-by",
    "host",
    "--keep-last",
    "5",
    ...(apply ? ["--prune"] : ["--dry-run"]),
  ];
}

export function retainCloudBackups(host: string, tag: string, apply = false) {
  const result = spawnSync("restic", cloudRetentionArguments(host, tag, apply), { stdio: "inherit" });
  if (result.status !== 0) throw new Error("Cloud retention failed; local backups must be preserved");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: { host: { type: "string" }, tag: { type: "string" }, apply: { type: "boolean", default: false } },
    });
    retainCloudBackups(values.host ?? "", values.tag ?? "", values.apply);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Cloud retention failed");
    process.exitCode = 1;
  }
}
