/** Installed root-owned; no dependencies on the deployment checkout or npm. */
import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadHostSettings,
  privateHostEnvironment,
  hostLoggingBackupPaths,
  type HostSettings,
} from "./host-configuration.ts";

type CommandOptions = { input?: string; output?: string; quiet?: boolean; environment?: NodeJS.ProcessEnv };
export type BackupCommand = (command: string, args: string[], options?: CommandOptions) => string;

function command(command: string, args: string[], options: CommandOptions = {}): string {
  const input = options.input ? openSync(options.input, "r") : undefined;
  const output = options.output ? openSync(options.output, "w", 0o600) : undefined;
  try {
    const result = spawnSync(command, args, {
      env: options.environment ?? process.env,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: [input ?? "ignore", output ?? "pipe", options.quiet ? "pipe" : "inherit"],
    });
    if (result.status !== 0) throw new Error(`Backup command failed: ${command} ${args[0] ?? ""}`);
    return typeof result.stdout === "string" ? result.stdout : "";
  } finally {
    if (input !== undefined) closeSync(input);
    if (output !== undefined) closeSync(output);
  }
}

/** Cleanup is deliberately unreachable until remote backup, retention and checks succeed. */
export function backupAndRetain(settings: HostSettings, paths: string[], run: BackupCommand, sunday: boolean) {
  run("restic", ["cat", "config"], { quiet: true });
  run("restic", ["backup", "--tag", settings.backupTag, "--host", settings.backupHost, "--exclude-caches", ...paths]);
  run(process.execPath, [
    join(import.meta.dirname, "cloud-retention.ts"),
    "--host",
    settings.backupHost,
    "--tag",
    settings.backupTag,
    "--apply",
  ]);
  if (sunday) run("restic", ["check", "--read-data-subset=10%"]);
  for (const [helper, args] of [
    ["release-retention.ts", ["--apply"]],
    ["image-retention.ts", ["--project", settings.project, "--apply"]],
  ] as const) {
    run("runuser", [
      "-u",
      settings.user,
      "--",
      "env",
      `HOME=${settings.home}`,
      `XDG_RUNTIME_DIR=/run/user/${settings.uid}`,
      process.execPath,
      join(import.meta.dirname, helper),
      ...args,
    ]);
  }
}

export function dumpHostDatabases(dumps: string, database: string, podman: BackupCommand) {
  for (const file of readdirSync(dumps)) if (file.endsWith(".partial")) unlinkSync(join(dumps, file));
  podman("", [database, "sh", "-c", 'pg_dumpall -U "$POSTGRES_USER" --globals-only'], {
    output: `${dumps}/globals.sql.partial`,
  });
  renameSync(`${dumps}/globals.sql.partial`, `${dumps}/globals.sql`);
  const databases = podman("", [
    database,
    "sh",
    "-c",
    `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres' ORDER BY 1"`,
  ])
    .trim()
    .split("\n");
  if (!databases.length || databases.some((db) => !/^[A-Za-z0-9_]+$/.test(db)))
    throw new Error("No safe database names found");
  for (const db of databases) {
    const partial = `${dumps}/${db}.pgdump.partial`;
    podman("", [database, "sh", "-c", 'pg_dump -U "$POSTGRES_USER" -Fc -Z 6 "$1"', "_", db], { output: partial });
    podman("", ["-i", database, "pg_restore", "--list"], { input: partial });
    renameSync(partial, `${dumps}/${db}.pgdump`);
  }
  for (const file of readdirSync(dumps))
    if (file.endsWith(".pgdump") && !databases.includes(file.slice(0, -7))) unlinkSync(join(dumps, file));
  return databases;
}

export function runHostBackup(settings: HostSettings) {
  process.umask(0o077);
  const environment = privateHostEnvironment(settings.backupConfig, 0);
  // Whitelist credentials; dotenv data never becomes shell code or arbitrary process settings.
  for (const key of ["RESTIC_REPOSITORY", "RESTIC_PASSWORD_FILE"] as const) {
    if (!environment[key]) throw new Error(`Missing ${key} in the private backup configuration`);
    process.env[key] = environment[key];
  }
  process.env.RESTIC_CACHE_DIR = "/var/cache/restic-staedtechallenge";
  const dumps = "/var/backups/staedtechallenge";
  const status = "/var/lib/staedtechallenge-backup";
  const metrics = "/var/lib/node-exporter-textfile/staedtechallenge_backup.prom";
  for (const path of [dumps, status, process.env.RESTIC_CACHE_DIR]) mkdirSync(path, { recursive: true, mode: 0o700 });
  mkdirSync(dirname(metrics), { recursive: true, mode: 0o755 });
  const started = Math.floor(Date.now() / 1000);
  const atomic = (path: string, content: string, mode = 0o600) => {
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, content, { mode });
    chmodSync(temporary, mode);
    renameSync(temporary, path);
  };
  const writeMetrics = (success: boolean) => {
    const finished = Math.floor(Date.now() / 1000);
    const previous = existsSync(`${status}/last-success`) ? readFileSync(`${status}/last-success`, "utf8").trim() : "0";
    const values = {
      last_success_timestamp_seconds: /^\d+$/.test(previous) ? previous : "0",
      last_run_success: Number(success),
      last_run_timestamp_seconds: finished,
      last_run_duration_seconds: finished - started,
    };
    atomic(
      metrics,
      Object.entries(values)
        .map(
          ([key, value]) => `# TYPE slk_backup_${key} gauge\nslk_backup_${key}{backup="staedtechallenge"} ${value}\n`,
        )
        .join("") + (existsSync(`${status}/sizes.prom`) ? readFileSync(`${status}/sizes.prom`, "utf8") : ""),
      0o644,
    );
  };
  const app: BackupCommand = (tool, args, options) =>
    command(
      "runuser",
      [
        "-u",
        settings.user,
        "--",
        "env",
        `HOME=${settings.home}`,
        `XDG_RUNTIME_DIR=/run/user/${settings.uid}`,
        ...(tool === "podman" ? ["aa-exec", "-p", "slk-rootless", "--"] : []),
        tool,
        ...args,
      ],
      options,
    );
  const database = `${settings.project}_db_1`;
  const podman: BackupCommand = (_tool, args, options) => app("podman", ["exec", ...args], options);
  try {
    const databases = dumpHostDatabases(dumps, database, podman);
    atomic(
      `${dumps}/deployment-state.txt`,
      `time=${new Date().toISOString()}\ndatabases=${databases.join(" ")}\n` +
        app("git", ["-C", settings.repository, "log", "-1", "--format=git_commit=%H %cI %s"]) +
        app("podman", ["ps", "-a", "--format", "{{.Names}} {{.Image}} {{.Status}}"]),
    );
    backupAndRetain(
      settings,
      [
        dumps,
        `${settings.home}/.local/share/containers/storage/volumes/${settings.project}_uploads/_data`,
        `${settings.home}/.config/slk`,
        `${settings.home}/.config/systemd/user`,
        `${settings.repository}/src/directus/.env`,
        `${settings.repository}/src/frontend/.env`,
        "/etc/caddy",
        ...hostLoggingBackupPaths(settings),
      ],
      command,
      new Date().getDay() === 0,
    );
    try {
      const stored = JSON.parse(command("restic", ["stats", "--json", "--mode", "raw-data"])) as {
        total_size: number;
        snapshots_count: number;
      };
      const restored = JSON.parse(
        command("restic", [
          "stats",
          "--json",
          "--mode",
          "restore-size",
          "--host",
          settings.backupHost,
          "--tag",
          settings.backupTag,
          "latest",
        ]),
      ) as { total_size: number };
      const values = {
        repository_size_bytes: stored.total_size,
        snapshot_size_bytes: restored.total_size,
        snapshots: stored.snapshots_count,
      };
      if (Object.values(values).some((value) => !Number.isSafeInteger(value) || value < 0))
        throw new Error("Invalid backup statistics");
      atomic(
        `${status}/sizes.prom`,
        Object.entries(values)
          .map(
            ([key, value]) => `# TYPE slk_backup_${key} gauge\nslk_backup_${key}{backup="staedtechallenge"} ${value}\n`,
          )
          .join(""),
      );
    } catch {
      console.error("Could not collect backup size statistics; previous metrics preserved.");
    }
    atomic(`${status}/last-success`, `${Math.floor(Date.now() / 1000)}\n`);
    writeMetrics(true);
    console.log(`Backup succeeded for ${databases.length} database(s); uploads streamed directly to Restic.`);
  } catch (error) {
    writeMetrics(false);
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [config, locked] = process.argv.slice(2);
    if (!config || (locked && locked !== "--locked") || process.argv.length > 4)
      throw new Error("Expected a private host configuration path");
    const settings = loadHostSettings(config);
    if (locked === "--locked") runHostBackup(settings);
    else {
      const result = spawnSync(
        "flock",
        [
          "--nonblock",
          "--conflict-exit-code",
          "75",
          "/run/lock/staedtechallenge-backup.lock",
          process.execPath,
          fileURLToPath(import.meta.url),
          config,
          "--locked",
        ],
        { stdio: "inherit" },
      );
      if (result.status !== 0 && result.status !== 75) throw new Error("Backup failed");
      if (result.status === 75) console.log("Another backup is running; skipped.");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Host backup failed");
    process.exitCode = 1;
  }
}
