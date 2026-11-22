/** Installed root-owned. Never executes code or commands from the application checkout. */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadHostSettings, privateHostEnvironment, type HostSettings } from "./host-configuration.ts";
import { releaseTagPattern, verifyCheckpoint, privateReleasePath, fileDigest } from "./release-checkpoint.ts";

export function releaseBackupUnit(tag: string): string {
  if (!releaseTagPattern.test(tag)) throw new Error("Expected a revision release tag");
  return "slk-release-backup.service";
}

export async function commandDigest(program: string, args: string[], environment: NodeJS.ProcessEnv) {
  const hash = createHash("sha256");
  await new Promise<void>((accept, reject) => {
    const child = spawn(program, args, { env: environment, stdio: ["ignore", "pipe", "ignore"] });
    child.stdout.on("data", (chunk: Buffer) => hash.update(chunk));
    child.on("error", () => reject(new Error("Remote backup verification could not start")));
    child.on("close", (code) => (code === 0 ? accept() : reject(new Error("Remote backup verification failed"))));
  });
  return hash.digest("hex");
}

export async function verifyRemoteCheckpoint(
  directory: string,
  owner: number,
  snapshot: string,
  digest: (path: string) => Promise<string>,
) {
  if (!/^[a-f0-9]{8,64}$/.test(snapshot)) throw new Error("Invalid cloud snapshot identity");
  const entries = await verifyCheckpoint(directory, owner);
  entries.set("backups.sha256", await fileDigest(join(directory, "backups.sha256")));
  for (const [name, expected] of entries)
    if ((await digest(join(directory, name))) !== expected) throw new Error("Off-host release checksum mismatch");
  return entries.get("backups.sha256")!;
}

export async function backupReleaseToCloud(settings: HostSettings, tag: string) {
  releaseBackupUnit(tag);
  const directory = join(settings.home, ".local/state/slk-releases", tag);
  await verifyCheckpoint(directory, settings.uid);
  const fields = privateHostEnvironment(settings.backupConfig, 0);
  if (!fields.RESTIC_REPOSITORY || !fields.RESTIC_PASSWORD_FILE)
    throw new Error("The installed private Restic configuration is incomplete");
  if (!/^(sftp|s3|b2|azure|gs|rest|swift):/.test(fields.RESTIC_REPOSITORY))
    throw new Error("Release backups require an off-host Restic repository");
  const environment = {
    PATH: "/usr/local/bin:/usr/bin:/bin",
    HOME: "/root",
    RESTIC_REPOSITORY: fields.RESTIC_REPOSITORY,
    RESTIC_PASSWORD_FILE: fields.RESTIC_PASSWORD_FILE,
    RESTIC_CACHE_DIR: "/var/cache/restic-staedtechallenge",
  };
  const run = (program: string, args: string[]) => {
    const result = spawnSync(program, args, { env: environment, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    if (result.status !== 0) throw new Error("Encrypted release backup failed; private diagnostics withheld");
    return result.stdout;
  };
  // An existing remote repository is mandatory. Never initialise one on errors.
  run("restic", ["cat", "config"]);
  const cloudTag = settings.backupTag + "-release";
  if (cloudTag.length > 100) throw new Error("Release backup tag is too long");
  const output = run("restic", ["backup", "--json", "--host", settings.backupHost, "--tag", cloudTag, directory]);
  const summary = output
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { message_type?: string; snapshot_id?: string })
    .findLast((item) => item.message_type === "summary");
  const snapshot = summary?.snapshot_id ?? "";
  const manifest = await verifyRemoteCheckpoint(directory, settings.uid, snapshot, (path) =>
    commandDigest("restic", ["dump", snapshot, path], environment),
  );
  // Retention has no access to application code and only addresses this release scope.
  const retention = spawnSync(
    process.execPath,
    [join(import.meta.dirname, "cloud-retention.ts"), "--host", settings.backupHost, "--tag", cloudTag, "--apply"],
    { env: environment, stdio: "inherit" },
  );
  if (retention.status !== 0) throw new Error("Release cloud retention failed");
  const proof = JSON.stringify({ tag, snapshot, manifest, verifiedAt: new Date().toISOString() });
  // Write as deploy: root must never write through a deployment-user-controlled path.
  const writer = spawnSync(
    "runuser",
    [
      "-u",
      settings.user,
      "--",
      "env",
      `HOME=${settings.home}`,
      process.execPath,
      fileURLToPath(import.meta.url),
      "write-proof",
      tag,
      proof,
    ],
    { stdio: "inherit" },
  );
  if (writer.status !== 0) throw new Error("Cloud verification proof could not be recorded");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === "write-proof") {
      const [tag, proof] = process.argv.slice(3);
      if (process.getuid?.() === 0 || !tag || !proof || !releaseTagPattern.test(tag) || process.argv.length !== 5)
        throw new Error("A deployment-user proof destination is required");
      const directory = join(homedir(), ".local/state/slk-releases", tag);
      privateReleasePath(directory, process.getuid!(), true);
      const temporary = join(directory, `cloud-proof.${process.pid}.tmp`);
      writeFileSync(temporary, proof + "\n", { mode: 0o600, flag: "wx" });
      renameSync(temporary, join(directory, "backup.offhost.json"));
    } else {
      const config = process.argv[2];
      if (!config || process.argv.length !== 3) throw new Error("Expected host configuration");
      const settings = loadHostSettings(config);
      const request = join(settings.home, ".local/state/slk-releases/backup.request.json");
      privateReleasePath(request, settings.uid);
      const tag: unknown = JSON.parse(readFileSync(request, "utf8")).tag;
      if (typeof tag !== "string") throw new Error("Missing release backup request");
      await backupReleaseToCloud(settings, tag);
    }
  } catch {
    console.error(
      "Release cloud backup or verification failed; application remains unchanged. Inspect the private service journal.",
    );
    process.exitCode = 1;
  }
}
