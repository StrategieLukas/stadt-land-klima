/** Bounded local rollback checkpoints; independent of encrypted nightly cloud backups. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const RELEASE_BACKUPS_TO_KEEP = 5;
const required = [
  "database.before.dump",
  "uploads.before.tar",
  "frontend-output.before.tar",
  "source.before.tar.gz",
  "config.before.tar.gz",
];
const payloads = [...required, "database.before.list", "private-env.before.tar.gz"];
const namePattern = /^(?:release-[a-f0-9]{8,40}|20\d{6}-[a-f0-9]{8,40})$/;

async function regular(path: string) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Backup files must be regular files");
  return stat;
}

async function checkpoint(directory: string) {
  const hashes = new Map<string, string>();
  const stat = await regular(join(directory, "backups.sha256"));
  for (const line of (await readFile(join(directory, "backups.sha256"), "utf8")).trim().split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match) throw new Error("Malformed backup manifest");
    const name = basename(match[2]!);
    if (!payloads.includes(name) || hashes.has(name) || resolve(directory, match[2]!) !== join(directory, name))
      throw new Error("Unexpected backup manifest path");
    hashes.set(name, match[1]!);
  }
  if (required.some((name) => !hashes.has(name))) throw new Error("Incomplete backup manifest");
  for (const name of hashes.keys()) {
    if (!(await regular(join(directory, name))).size) throw new Error("Empty backup payload");
  }
  return { directory, capturedAt: stat.mtimeMs, hashes };
}

export async function releaseRetentionPlan(root: string) {
  root = resolve(root);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Unsafe release directory");
  const records = [];
  const skipped: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!namePattern.test(entry.name)) continue;
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error("Unsafe release checkpoint");
    const directory = join(root, entry.name);
    try {
      records.push(await checkpoint(directory));
    } catch (error) {
      // Already offloaded/expired and incomplete attempts are not usable rollback sets.
      // Never recursively remove an unrecognised or incomplete recovery directory.
      if (!(error instanceof Error)) throw error;
      skipped.push(entry.name);
    }
  }
  records.sort((a, b) => b.capturedAt - a.capturedAt || b.directory.localeCompare(a.directory));
  return {
    keep: records.slice(0, RELEASE_BACKUPS_TO_KEEP),
    expire: records.slice(RELEASE_BACKUPS_TO_KEEP),
    skipped,
  };
}

async function verify(directory: string, hashes: ReadonlyMap<string, string>) {
  for (const [name, expected] of hashes) {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(join(directory, name))) hash.update(chunk as Buffer);
    if (hash.digest("hex") !== expected) throw new Error("Retained backup checksum mismatch; nothing expired");
  }
}

export async function retainReleaseBackups(root: string, apply = false) {
  const plan = await releaseRetentionPlan(root);
  const result = {
    keep: plan.keep.map((record) => basename(record.directory)),
    expire: plan.expire.map((record) => basename(record.directory)),
    skipped: plan.skipped,
    applied: apply,
    busy: [] as string[],
  };
  if (!apply || !plan.expire.length) return result;
  // Verify every surviving full set before allowing the first deletion.
  for (const record of plan.keep) await verify(record.directory, record.hashes);
  for (const record of plan.expire) {
    const child = spawnSync(
      "flock",
      [
        "--nonblock",
        "--conflict-exit-code",
        "75",
        join(record.directory, "release.lock"),
        process.execPath,
        fileURLToPath(import.meta.url),
        "expire",
        record.directory,
      ],
      { stdio: "inherit" },
    );
    if (child.status === 75) result.busy.push(basename(record.directory));
    else if (child.status !== 0) throw new Error("Backup retention failed; remaining checkpoints preserved");
  }
  return result;
}

async function expire(directory: string) {
  if (!isAbsolute(directory) || !namePattern.test(basename(directory))) throw new Error("Invalid checkpoint");
  const root = resolve(directory, "..");
  // Recheck eligibility after acquiring its coordinator lock.
  const plan = await releaseRetentionPlan(root);
  if (!plan.expire.some((record) => record.directory === directory)) throw new Error("Checkpoint is protected");
  for (const name of [...payloads, "backup.verified"]) {
    try {
      await regular(join(directory, name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  await writeFile(
    join(directory, "retention.json"),
    JSON.stringify({ expiredAt: new Date().toISOString(), keepLast: RELEASE_BACKUPS_TO_KEEP }) + "\n",
    { mode: 0o600, flag: "wx" },
  );
  // Invalidate activation/rollback approval before deleting its known payloads.
  for (const name of ["backup.verified", ...payloads]) {
    await unlink(join(directory, name)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.platform !== "linux" || process.getuid?.() === 0)
      throw new Error("Run release retention as the deployment user on Linux");
    if (process.argv[2] === "expire" && process.argv.length === 4) await expire(process.argv[3]!);
    else if (process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--apply")) {
      console.log(
        JSON.stringify(
          await retainReleaseBackups(join(homedir(), ".local/state/slk-releases"), process.argv[2] === "--apply"),
        ),
      );
    } else throw new Error("Expected --apply or no arguments");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Backup retention failed");
    process.exitCode = 1;
  }
}
