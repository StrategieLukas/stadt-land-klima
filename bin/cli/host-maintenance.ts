/** Reproducible, explicit installation; never deploys or restarts application/data containers. */
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  chownSync,
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hostPath,
  loadHostSettings,
  privateHostEnvironment,
  privateHostFile,
  type HostSettings,
} from "./host-configuration.ts";
import {
  HOST_LOGGING_PATHS,
  assertVectorBuild,
  HOST_VECTOR_SHA256,
  RETIRED_LOGGING_PATHS,
  hostLoggingArtifacts,
  loggingSettings,
  type LoggingSettings,
} from "./host-logging.ts";

export const HOST_NODE = {
  version: "24.22.3",
  platform: "linux",
  arch: "x64",
  archiveSha256: "4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb",
  binarySha256: "a7ec1b37e6ff9d187e4198c5b6df9a4eb1c74dd31804fb3bac55cc4ceca1ac01",
} as const;
const library = "/usr/local/lib/slk";
const helpers = [
  "host-backup.ts",
  "host-configuration.ts",
  "cloud-retention.ts",
  "release-retention.ts",
  "image-retention.ts",
];
export type HostArtifact = { path: string; bytes: Buffer; mode: number; uid: number; gid: number };
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function run(tool: string, args: string[], input?: string) {
  const result = spawnSync(tool, args, {
    encoding: "utf8",
    ...(input === undefined ? {} : { input }),
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) throw new Error(`Host operation failed: ${tool} ${args[0] ?? ""}; private output withheld`);
  return result.stdout;
}

export function hostArtifacts(
  root: string,
  settings: HostSettings,
  config: string,
  caddyGid: number,
  logging?: { settings: LoggingSettings; gid: number },
) {
  hostPath(config);
  const files: HostArtifact[] = [];
  const text = (path: string, value: string, mode = 0o644, uid = 0, gid = 0) =>
    files.push({ path, bytes: Buffer.from(value), mode, uid, gid });
  const source = (path: string) => readFileSync(join(root, path), "utf8");
  for (const helper of helpers) text(`${library}/${helper}`, source(`bin/cli/${helper}`));
  text("/etc/apparmor.d/slk-rootless", source("podman/apparmor/slk-rootless"));
  for (const file of [
    "application.caddy",
    "directus.caddy",
    "legacy-cms.caddy",
    "global-options.caddy",
    "global.future.caddy",
  ])
    text(`/etc/caddy/${file}`, source(`caddy/${file}`), 0o640, 0, caddyGid);
  text("/etc/caddy/Caddyfile", source("caddy/Caddyfile.production"), 0o640, 0, caddyGid);
  text("/etc/systemd/system/caddy.service", source("caddy/caddy.service.example"));
  text(
    "/etc/systemd/system/staedtechallenge-backup.service",
    `[Unit]\nDescription=Encrypted Stadt-Land-Klima cloud backup\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=oneshot\nExecStart=${library}/node ${library}/host-backup.ts ${config}\nNice=10\nIOSchedulingClass=best-effort\nUMask=0077\nStandardOutput=journal\nStandardError=journal\n`,
  );
  text("/etc/systemd/system/staedtechallenge-backup.timer", source("podman/host-backup.timer"));
  const applicationUnit = source("podman/slk-application-only.service.example")
    .replaceAll("slk-podman-production", settings.project)
    .replaceAll("%h/.config/slk/production.env", settings.appConfig)
    .replaceAll("http://127.0.0.1:9001/", `http://127.0.0.1:${settings.cmsPort}/`)
    .replaceAll("http://127.0.0.1:9000/", `http://127.0.0.1:${settings.webPort}/`)
    .replace("EnvironmentFile=", `Environment=PATH=${library}:/usr/local/bin:/usr/bin:/bin\nEnvironmentFile=`);
  text(`${settings.home}/.config/systemd/user/slk.service`, applicationUnit, 0o600, settings.uid, settings.gid);
  if (logging) files.push(...hostLoggingArtifacts(root, settings.project, logging.settings, logging.gid));
  return files;
}

/** Never follow a destination symlink or write through an untrusted root-owned parent. */
export function assertHostParents(path: string, owner: number) {
  for (let parent = dirname(path); ; parent = dirname(parent)) {
    if (existsSync(parent)) {
      const stat = lstatSync(parent);
      if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== owner || (stat.mode & 0o022) !== 0)
        throw new Error(`Unsafe installation directory: ${parent}`);
    }
    if (parent === "/") break;
  }
}

export function verifyHostArtifact(file: HostArtifact): boolean {
  try {
    const stat = lstatSync(file.path);
    return (
      stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.uid === file.uid &&
      stat.gid === file.gid &&
      (stat.mode & 0o777) === file.mode &&
      hash(readFileSync(file.path)) === hash(file.bytes)
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export function installHostArtifact(file: HostArtifact) {
  assertHostParents(file.path, 0);
  mkdirSync(dirname(file.path), { recursive: true, mode: 0o755 });
  if (existsSync(file.path) && !lstatSync(file.path).isFile())
    throw new Error(`Refusing non-regular target: ${file.path}`);
  // lstat, rather than existsSync alone, also refuses dangling symlinks.
  try {
    if (lstatSync(file.path).isSymbolicLink()) throw new Error(`Refusing symlink: ${file.path}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = `${file.path}.${randomUUID()}.tmp`;
  const fd = openSync(
    temporary,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    file.mode,
  );
  try {
    writeFileSync(fd, file.bytes);
    chownSync(temporary, file.uid, file.gid);
    chmodSync(temporary, file.mode);
    renameSync(temporary, file.path);
  } finally {
    closeSync(fd);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function installApplicationUnit(file: HostArtifact, settings: HostSettings) {
  // Write into the deployment user's directories without root privileges.
  const code = `const {mkdirSync,writeFileSync,renameSync,chmodSync}=require('node:fs');const{dirname}=require('node:path');const p=process.argv[1];const t=p+'.install-'+process.pid;mkdirSync(dirname(p),{recursive:true,mode:448});writeFileSync(t,require('node:fs').readFileSync(0),{mode:384,flag:'wx'});chmodSync(t,384);renameSync(t,p);`;
  run("runuser", ["-u", settings.user, "--", `${library}/node`, "-e", code, file.path], file.bytes.toString("utf8"));
}

export function performHostMaintenance(action: "plan" | "install" | "verify", config: string, nodeBinary?: string) {
  const settings = loadHostSettings(config);
  if (process.arch !== HOST_NODE.arch) throw new Error("This reviewed host profile requires Linux x64");
  const root = resolve(import.meta.dirname, "../..");
  const group = run("getent", ["group", "caddy"]).trim().split(":");
  const caddyGid = Number(group[2]);
  if (!Number.isInteger(caddyGid) || caddyGid <= 0) throw new Error("The existing caddy group is required");
  let logging: { settings: LoggingSettings; gid: number } | undefined;
  if (settings.loggingConfig) {
    const logSettings = loggingSettings(privateHostEnvironment(settings.loggingConfig, 0));
    const credential = privateHostFile(logSettings.passwordFile, 0).toString("utf8");
    if (!/^[\x21-\x7e]{32,256}\n?$/.test(credential))
      throw new Error("Logging password must contain 32–256 printable ASCII characters");
    const vector = run("getent", ["passwd", "slk-vector"]).trim().split(":");
    const gid = Number(run("getent", ["group", "slk-vector"]).trim().split(":")[2]);
    if (
      !Number.isInteger(Number(vector[2])) ||
      Number(vector[2]) <= 0 ||
      !Number.isInteger(gid) ||
      gid <= 0 ||
      Number(vector[3]) !== gid
    )
      throw new Error("Create the dedicated slk-vector account and group first");
    const binary = lstatSync("/usr/local/bin/vector");
    if (!binary.isFile() || binary.uid !== 0 || (binary.mode & 0o022) !== 0)
      throw new Error("Vector must be a root-owned, non-writable executable");
    if (hash(readFileSync("/usr/local/bin/vector")) !== HOST_VECTOR_SHA256)
      throw new Error("Vector differs from the reviewed Linux x64 release binary");
    assertVectorBuild(run("/usr/local/bin/vector", ["--version"]));
    logging = { settings: logSettings, gid };
  }
  const files = hostArtifacts(root, settings, config, caddyGid, logging);
  const disabledLoggingArtifacts = (
    logging ? RETIRED_LOGGING_PATHS : [...HOST_LOGGING_PATHS, ...RETIRED_LOGGING_PATHS]
  ).filter((path) => existsSync(path));
  if (action === "install" && disabledLoggingArtifacts.length)
    throw new Error("Inactive or retired SLK logging files remain; explicitly retire them before installing");
  privateHostEnvironment(settings.backupConfig, 0);
  const binaryPath = nodeBinary ?? `${library}/node`;
  const binary = readFileSync(binaryPath);
  if (hash(binary) !== HOST_NODE.binarySha256)
    throw new Error("Node binary differs from the reviewed pinned Linux x64 runtime");
  files.unshift({ path: `${library}/node`, bytes: binary, mode: 0o755, uid: 0, gid: 0 });
  // Stop legacy Bash entrypoints from becoming an invisible dependency again.
  const retired = "/usr/local/sbin/staedtechallenge-backup";
  if (action !== "plan") {
    const checkout = run("git", [
      "-c",
      `safe.directory=${root}`,
      "-C",
      root,
      "status",
      "--porcelain",
      "--untracked-files=normal",
    ]);
    if (checkout.trim()) throw new Error("Install and verify only from a clean, reviewed checkout");
  }
  if (action === "install") {
    for (const file of files) {
      if (file.uid === 0) installHostArtifact(file);
      else installApplicationUnit(file, settings);
    }
    if (existsSync(retired)) {
      const stat = lstatSync(retired);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== 0)
        throw new Error("Unexpected legacy backup entrypoint; inspect before retiring it");
      unlinkSync(retired);
    }
    run("systemctl", ["daemon-reload"]);
    if (logging) run("systemctl", ["enable", "slk-vector.service"]);
    run("runuser", [
      "-u",
      settings.user,
      "--",
      "env",
      `XDG_RUNTIME_DIR=/run/user/${settings.uid}`,
      `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${settings.uid}/bus`,
      "systemctl",
      "--user",
      "daemon-reload",
    ]);
    run("systemctl", ["enable", "--now", "staedtechallenge-backup.timer"]);
    run("runuser", [
      "-u",
      settings.user,
      "--",
      "env",
      `XDG_RUNTIME_DIR=/run/user/${settings.uid}`,
      `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${settings.uid}/bus`,
      "systemctl",
      "--user",
      "enable",
      "slk.service",
    ]);
  }
  for (const file of files) if (file.uid === 0) assertHostParents(file.path, 0);
  const results = files.map((file) => ({
    path: file.path,
    sha256: hash(file.bytes),
    mode: file.mode.toString(8),
    matches: verifyHostArtifact(file),
  }));
  const unexpected = existsSync(library)
    ? readdirSync(library).filter((name) => !["node", ...helpers].includes(name))
    : [];
  const ok =
    results.every((result) => result.matches) &&
    !existsSync(retired) &&
    unexpected.length === 0 &&
    disabledLoggingArtifacts.length === 0;
  console.log(
    JSON.stringify(
      {
        action,
        revision: run("git", ["-c", `safe.directory=${root}`, "-C", root, "rev-parse", "HEAD"]).trim(),
        ok,
        files: results,
        retiredEntrypointPresent: existsSync(retired),
        unexpectedLibraryFiles: unexpected,
        disabledLoggingArtifacts,
        pending: [
          "Validate/reload Caddy and AppArmor explicitly during the approved deployment",
          "Restart/verify application only after the approved Git release",
          ...(logging
            ? ["Validate Vector; activate persistent journaling and slk-vector explicitly after monitoring is ready"]
            : []),
        ],
      },
      null,
      2,
    ),
  );
  if (action !== "plan" && !ok)
    throw new Error("Installed host artifacts differ from Git; see the verification report");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, config, nodeBinary] = process.argv.slice(2);
    if (!["plan", "install", "verify"].includes(action ?? "") || !config || process.argv.length > 5)
      throw new Error("Expected plan|install|verify, host configuration and optional Node binary");
    performHostMaintenance(action as "plan" | "install" | "verify", config, nodeBinary);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Host maintenance failed");
    process.exitCode = 1;
  }
}
