import { containerEnvironment } from "./container-environment.ts";
/** Application recovery bundle. Container commands are read-only; operators quiesce writers first. */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const services = ["db", "directus", "frontend", "cache", "meilisearch"] as const;
type Service = (typeof services)[number];
type Container = {
  Id: string;
  Image: string;
  Config: { Image: string; Env?: string[] };
  State: { Running: boolean; ExitCode: number; Status: string; StartedAt?: string; FinishedAt?: string };
  Mounts: { Destination: string; Source?: string }[];
};
type Manifest = {
  format: 1;
  created: string;
  engine: string;
  project: string;
  revision: string;
  containers: Record<Service, Container>;
  databases: { name: string; file: string }[];
  configs: { file: string; original: string }[];
};

async function command(
  program: string,
  args: string[],
  output?: string,
  input?: string,
  discardOutput = false,
): Promise<string> {
  const fd = output ? openSync(output, "wx", 0o600) : undefined;
  let inputFd: number | undefined;
  try {
    inputFd = input ? openSync(input, "r") : undefined;
    return await new Promise((accept, reject) => {
      const child = spawn(program, args, {
        cwd: root,
        stdio: [inputFd ?? "ignore", fd ?? (discardOutput ? "ignore" : "pipe"), "pipe"],
      });
      const chunks: Buffer[] = [];
      // Failure output may contain runtime secrets. Keep it out of terminals/logs.
      child.stderr?.resume();
      child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.on("error", () => reject(new Error(`Cannot execute ${program}`)));
      child.on("close", (code) =>
        code === 0
          ? accept(Buffer.concat(chunks).toString("utf8"))
          : reject(new Error(`${program} ${args[0]} failed; bundle is incomplete`)),
      );
    });
  } finally {
    if (fd !== undefined) closeSync(fd);
    if (inputFd !== undefined) closeSync(inputFd);
  }
}

async function digest(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function regular(path: string): void {
  const stat = lstatSync(path);
  if (!stat.isFile()) throw new Error("Expected a regular file, without symlinks");
}

/** New bundles stay in this checkout; no host state, temporary directories or services are changed. */
export function outputDirectory(path: string): string {
  const target = resolve(path);
  const rel = relative(realpathSync(root), target);
  if (!rel.startsWith("backups" + sep) || rel === "backups" || isAbsolute(rel) || existsSync(target))
    throw new Error("Output must be a new directory under this repository’s backups/");
  let parent = dirname(target);
  const missing: string[] = [];
  while (!existsSync(parent)) {
    missing.push(parent);
    parent = dirname(parent);
  }
  if (realpathSync(parent) !== parent) throw new Error("Output ancestors must not be symlinks");
  for (const path of missing.reverse()) mkdirSync(path, { mode: 0o700 });
  mkdirSync(target, { mode: 0o700 });
  return target;
}

export async function verifyBundle(directory: string): Promise<void> {
  const path = realpathSync(directory);
  regular(join(path, "SHA256SUMS"));
  const records = readFileSync(join(path, "SHA256SUMS"), "utf8").trim().split("\n");
  const names = new Set<string>();
  for (const record of records) {
    const match = /^([a-f0-9]{64})  ([a-zA-Z0-9][a-zA-Z0-9._-]*)$/.exec(record);
    if (!match || names.has(match[2]!)) throw new Error("Invalid or duplicate checksum entry");
    const [, hash, name] = match;
    names.add(name!);
    const file = join(path, name!);
    regular(file);
    if ((await digest(file)) !== hash) throw new Error(`Checksum mismatch: ${name}`);
  }
  for (const required of [
    "manifest.json",
    "RESTORE.md",
    "source.tar.gz",
    "repository.bundle",
    "images.tar",
    "globals.sql",
    "uploads.tar",
    "frontend-output.tar",
    "redis.tar",
    "search.tar",
  ]) {
    if (!names.has(required)) throw new Error(`Missing bundle payload: ${required}`);
  }
  const manifest = JSON.parse(readFileSync(join(path, "manifest.json"), "utf8")) as Manifest;
  if (
    manifest.format !== 1 ||
    !Array.isArray(manifest.databases) ||
    !manifest.databases.length ||
    !Array.isArray(manifest.configs)
  )
    throw new Error("Unsupported backup manifest");
  for (const entry of [...manifest.databases, ...manifest.configs]) {
    if (!names.has(entry.file)) throw new Error("Manifest references a missing payload");
  }
  const actual = readdirSync(path).filter((name) => name !== "SHA256SUMS");
  if (actual.length !== names.size || actual.some((name) => !names.has(name)))
    throw new Error("Unexpected or incomplete bundle contents");
}

export async function createBundle(options: {
  engine: "podman";
  project: string;
  output: string;
  configs: string[];
  writersStopped: boolean;
}): Promise<string> {
  if (!options.writersStopped)
    throw new Error("Stop external writers and deployment automation, then pass --writers-stopped");
  if (!/^[a-z0-9][a-z0-9_-]+$/.test(options.project)) throw new Error("Invalid project name");
  if (
    process.env.DOCKER_HOST ||
    process.env.DOCKER_CONTEXT ||
    process.env.CONTAINER_HOST ||
    process.env.CONTAINER_CONNECTION
  )
    throw new Error("Remote/container context overrides are unsupported; use the local engine on the source host");
  if (options.engine !== "podman") throw new Error("Only local Podman is supported");
  const engineArgs = ["--remote=false"];
  const engine = (args: string[], output?: string) => command(options.engine, [...engineArgs, ...args], output);
  const containers = {} as Record<Service, Container>;
  for (const service of services) {
    const label = "io.podman.compose";
    const ids = (
      await engine([
        "ps",
        "-aq",
        "--filter",
        `label=${label}.project=${options.project}`,
        "--filter",
        `label=${label}.service=${service}`,
      ])
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (ids.length !== 1) throw new Error(`Expected exactly one ${service} container, including stopped containers`);
    const [container] = JSON.parse(await engine(["inspect", ids[0]!])) as Container[];
    if (
      !container ||
      !/^(sha256:)?[a-f0-9]{64}$/.test(container.Image) ||
      container.State.Status === "paused" ||
      container.State.Status === "restarting"
    )
      throw new Error(`Invalid ${service} state`);
    if (container.State.Running !== (service === "db"))
      throw new Error("Database must be running; frontend, Directus, Redis and Meilisearch must be stopped");
    if (["cache", "meilisearch"].includes(service) && container.State.ExitCode !== 0)
      throw new Error("Redis/search must have shut down cleanly");
    containers[service] = container;
  }
  const db = containers.db.Id;
  const dbEntry = containers.db.Config.Env?.some((entry) => entry.startsWith("SLK_ENV_FILES="))
    ? ["/usr/local/bin/slk-env"]
    : [];
  const sql = (query: string) =>
    engine([
      "exec",
      db,
      ...dbEntry,
      "sh",
      "-ec",
      'exec psql -XqAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "$1"',
      "sh",
      query,
    ]);
  if ((await sql("SELECT spcname FROM pg_tablespace WHERE spcname NOT IN ('pg_default','pg_global')")).trim())
    throw new Error("Custom tablespaces need a separate recovery plan");
  const names = JSON.parse(
    (
      await sql("SELECT coalesce(json_agg(datname ORDER BY datname), '[]') FROM pg_database WHERE NOT datistemplate")
    ).trim(),
  ) as string[];
  if (!names.length) throw new Error("No databases found");
  // Non-local Directus storage cannot be recovered by archiving /directus/uploads.
  const cmsEnv = Object.entries(containerEnvironment(containers.directus)).map(([key, value]) => `${key}=${value}`);
  const storage =
    cmsEnv.find((entry) => entry.startsWith("STORAGE_LOCATIONS="))?.slice("STORAGE_LOCATIONS=".length) ?? "local";
  if (
    storage !== "local" ||
    cmsEnv.some(
      (entry) =>
        /^STORAGE_LOCAL_(DRIVER|ROOT)=/.test(entry) &&
        ![
          "STORAGE_LOCAL_DRIVER=local",
          "STORAGE_LOCAL_ROOT=/directus/uploads",
          "STORAGE_LOCAL_ROOT=./uploads",
        ].includes(entry),
    )
  )
    throw new Error("Nonstandard upload storage requires a separate recovery plan");
  if (!containers.directus.Mounts.some((mount) => mount.Destination === "/directus/uploads"))
    throw new Error("Missing standard uploads mount");

  const configs = [
    `db=${process.env.SLK_PODMAN_DB_ENV_FILE || join(root, "podman/database/.env")}`,
    `meilisearch=${process.env.SLK_PODMAN_MEILI_ENV_FILE || join(root, "podman/meilisearch/.env")}`,
    `directus=${process.env.SLK_PODMAN_DIRECTUS_ENV_FILE || join(root, "src/directus/.env")}`,
    `frontend=${process.env.SLK_PODMAN_FRONTEND_ENV_FILE || join(root, "src/frontend/.env")}`,
    ...options.configs,
  ];
  const configFiles = new Map<string, string>();
  for (const value of configs) {
    const index = value.indexOf("=");
    const label = value.slice(0, index),
      path = resolve(value.slice(index + 1));
    if (index < 1 || !/^[a-z][a-z0-9-]*$/.test(label)) throw new Error("Use --config label=/absolute/path");
    configFiles.set(`config-${label}`, path);
  }
  for (const path of configFiles.values()) regular(path);
  const directusConfig = readFileSync(configFiles.get("config-directus")!, "utf8");
  for (const line of directusConfig.split(/\r?\n/)) {
    if (!/^\s*(?:export\s+)?STORAGE_(?:LOCATIONS|LOCAL_DRIVER|LOCAL_ROOT)\s*=/.test(line)) continue;
    const match = /^\s*(?:export\s+)?(STORAGE_[A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line)!;
    const value = match[2]!.replace(/^(['"])(.*)\1$/, "$2");
    const allowed: Record<string, string[]> = {
      STORAGE_LOCATIONS: ["local"],
      STORAGE_LOCAL_DRIVER: ["local"],
      STORAGE_LOCAL_ROOT: ["/directus/uploads", "./uploads"],
    };
    if (!allowed[match[1]!]!.includes(value))
      throw new Error("Nonstandard upload storage requires a separate recovery plan");
  }
  if ((await command("git", ["rev-parse", "--is-shallow-repository"])).trim() !== "false")
    throw new Error("A shallow checkout cannot produce a standalone Git bundle; fetch full history first");
  const output = outputDirectory(options.output);
  const manifest: Manifest = {
    format: 1,
    created: new Date().toISOString(),
    engine: options.engine,
    project: options.project,
    revision: (await command("git", ["rev-parse", "HEAD"])).trim(),
    containers,
    databases: [],
    configs: [],
  };
  await engine(
    ["exec", db, ...dbEntry, "sh", "-ec", 'exec pg_dumpall -U "$POSTGRES_USER" --globals-only --quote-all-identifiers'],
    join(output, "globals.sql"),
  );
  for (const [index, name] of names.entries()) {
    const file = `database-${index}.dump`;
    await engine(
      [
        "exec",
        db,
        ...dbEntry,
        "sh",
        "-ec",
        'exec pg_dump -U "$POSTGRES_USER" --format=custom --create --quote-all-identifiers -d "$1"',
        "sh",
        name,
      ],
      join(output, file),
    );
    // Listing checks archive readability without performing a restore on the source host.
    await command(
      options.engine,
      [...engineArgs, "exec", "-i", db, "pg_restore", "--list"],
      undefined,
      join(output, file),
      true,
    );
    manifest.databases.push({ name, file });
  }
  for (const [service, path, file] of [
    ["directus", "/directus/uploads", "uploads.tar"],
    ["frontend", "/frontend/.output", "frontend-output.tar"],
    ["cache", "/data", "redis.tar"],
    ["meilisearch", "/meili_data", "search.tar"],
  ] as const) {
    await engine(["cp", `${containers[service].Id}:${path}/.`, "-"], join(output, file));
    await command("tar", ["-tf", join(output, file)], undefined, undefined, true);
  }
  for (const [file, original] of configFiles) {
    writeFileSync(join(output, file), readFileSync(original), { mode: 0o600, flag: "wx" });
    manifest.configs.push({ file, original });
  }
  // Exclude generated data and every backup to avoid recursion.
  await command("tar", [
    "--exclude=.git",
    "--exclude=node_modules",
    "--exclude=.nuxt",
    "--exclude=.output",
    "--exclude=./docker",
    "--exclude=./podman/data",
    "--exclude=./src/directus/uploads",
    "--exclude=./backups",
    "--exclude=./.reports",
    "--exclude=*.log",
    "--exclude=core.*",
    "-czf",
    join(output, "source.tar.gz"),
    "-C",
    root,
    ".",
  ]);
  await command("git", ["bundle", "create", join(output, "repository.bundle"), "--all"]);
  await command("git", ["bundle", "verify", join(output, "repository.bundle")], undefined, undefined, true);
  const imageIds = [...new Set(Object.values(containers).map((container) => container.Image))];
  await engine(
    ["save", "--format", "docker-archive", "--multi-image-archive", ...imageIds],
    join(output, "images.tar"),
  );
  await command("tar", ["-tf", join(output, "images.tar")], undefined, undefined, true);
  // Recheck source state: never certify a capture if a service was restarted mid-backup.
  for (const service of services) {
    const [after] = JSON.parse(await engine(["inspect", containers[service].Id])) as Container[];
    if (
      !after ||
      after.State.Running !== (service === "db") ||
      after.State.StartedAt !== containers[service].State.StartedAt ||
      after.State.FinishedAt !== containers[service].State.FinishedAt
    )
      throw new Error("Source state changed during backup");
  }
  writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  writeFileSync(join(output, "RESTORE.md"), readFileSync(join(root, "bin/PORTABLE_BACKUP.md")), {
    mode: 0o600,
    flag: "wx",
  });
  const files = readdirSync(output).sort();
  const hashes = await Promise.all(files.map(async (file) => `${await digest(join(output, file))}  ${file}`));
  writeFileSync(join(output, "SHA256SUMS.partial"), hashes.join("\n") + "\n", { mode: 0o600, flag: "wx" });
  renameSync(join(output, "SHA256SUMS.partial"), join(output, "SHA256SUMS"));
  await verifyBundle(output);
  return output;
}

async function main(): Promise<void> {
  const [action, ...args] = process.argv.slice(2);
  if (action === "--help") {
    console.log(
      "bin/slk backup create --project NAME --output backups/NAME --writers-stopped [--config label=/path]\nbin/slk backup verify /path/to/bundle\nSee bin/PORTABLE_BACKUP.md for shutdown and restoration.",
    );
    return;
  }
  if (action === "verify" && args.length === 1) {
    await verifyBundle(resolve(args[0]!));
    console.log("All backup checksums verified.");
    return;
  }
  if (action !== "create") throw new Error("Use --help for usage");
  const values = new Map<string, string>(),
    configs: string[] = [];
  let writersStopped = false;
  while (args.length) {
    const key = args.shift()!;
    if (key === "--writers-stopped") {
      writersStopped = true;
      continue;
    }
    if (!["--engine", "--project", "--output", "--config"].includes(key) || !args.length)
      throw new Error("Invalid argument; use --help");
    const value = args.shift()!;
    if (key === "--config") configs.push(value);
    else {
      if (values.has(key)) throw new Error("Duplicate argument");
      values.set(key, value);
    }
  }
  const engine = values.get("--engine") ?? "podman",
    project = values.get("--project"),
    output = values.get("--output");
  if (engine !== "podman" || !project || !output) throw new Error("Missing arguments; use --help");
  const directory = await createBundle({ engine, project, output, configs, writersStopped });
  console.log(
    `Backup complete: ${directory}\nCopy the entire private directory off-host and run verify there. Restoration rehearsal is still required.`,
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Backup failed");
    process.exitCode = 1;
  });
}
