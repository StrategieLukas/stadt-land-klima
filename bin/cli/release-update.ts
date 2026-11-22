/** Unattended application releases. Git/backup/build failures leave the live applications alone. */
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  openSync,
  closeSync,
  writeFileSync,
  renameSync,
  statfsSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { hostEnvironment } from "./host-environment.ts";
import { run, root, CommandError, type RunOptions } from "./process.ts";
import { runtime } from "./stack.ts";
import { releaseBackupUnit } from "./release-cloud.ts";
import {
  checkedDataCounts,
  fileDigest,
  privateReleasePath,
  releaseTagPattern,
  verifyCheckpoint,
} from "./release-checkpoint.ts";
import { applicationCountsSql, releaseSqlCommand } from "./release-backup.ts";

export type UpdateCommand = (program: string, args: string[], options?: RunOptions) => Promise<string>;
const revisionPattern = /^[a-f0-9]{40}$/;

export function assertReleaseResources(meminfo: string, diskBytes: number) {
  const kib = (key: string) => Number(new RegExp(`^${key}:\\s+(\\d+) kB$`, "m").exec(meminfo)?.[1] ?? 0);
  if (kib("MemAvailable") < 512 * 1024 || kib("MemAvailable") + kib("SwapFree") < 4.5 * 1024 * 1024)
    throw new Error("Release builds need at least 512 MiB available RAM and 4.5 GiB available RAM plus swap");
  if (diskBytes < 8 * 1024 ** 3) throw new Error("Free at least 8 GiB in the Podman image store before updating");
}

export function releaseUpdateConfig(home: string, explicit?: string): string {
  if (explicit) return resolve(explicit);
  const choices = ["production.env", "future.env"].map((name) => join(home, ".config/slk", name)).filter(existsSync);
  if (choices.length !== 1)
    throw new Error("Select one private host config: slk release update /absolute/host.env --env production");
  return choices[0]!;
}

export function releasePublicOrigin(repository: string, environment: NodeJS.ProcessEnv): string {
  const fields = dotenv.parse(
    readFileSync(environment.SLK_PODMAN_FRONTEND_ENV_FILE || join(repository, "src/frontend/.env")),
  );
  try {
    const url = new URL(fields.NUXT_PUBLIC_SITE_URL || fields.PUBLIC_URL || "");
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/")
      throw new Error();
    return url.origin;
  } catch {
    throw new Error("Configure a credential-free HTTPS PUBLIC_URL in the private frontend environment");
  }
}

export function checkReleaseRead(path: string, text: string): void {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("Public release read returned non-JSON content");
  }
  if (path === "/api/public/site-layout") {
    if (
      !body ||
      typeof body !== "object" ||
      !("pages" in body) ||
      !Array.isArray(body.pages) ||
      !body.pages.length ||
      !("municipalities" in body) ||
      !Array.isArray(body.municipalities)
    )
      throw new Error("Public site layout is missing its checked content");
  } else if (!Array.isArray(body) || (path === "/api/public/catalogs" && !body.length)) {
    throw new Error("Public release read is missing its checked content");
  }
}

export async function resolveReleaseMain(repository: string, active: string, execute: UpdateCommand) {
  const git = (args: string[], capture = true) => execute("git", args, { cwd: repository, capture });
  if (!revisionPattern.test(active)) throw new Error("Cannot identify the active application revision");
  if (await git(["status", "--porcelain", "--untracked-files=normal"]))
    throw new Error("Commit or preserve working-tree changes before updating");
  await git(["fetch", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main"], false);
  const target = (await git(["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"])).trim();
  if (!revisionPattern.test(target)) throw new Error("origin/main did not identify a commit");
  // Main is the approved source of truth, including squash/rebase histories.
  // Reject an actually older ancestor; never silently merge live-only source into main.
  let older = false;
  try {
    await git(["cat-file", "-e", `${active}^{commit}`]);
  } catch {
    await git(["fetch", "--no-tags", "origin", active], false);
  }
  if (target !== active) {
    try {
      await git(["merge-base", "--is-ancestor", target, active]);
      older = true;
    } catch (error) {
      if (!(error instanceof CommandError) || error.code !== 1) throw error;
    }
  }
  if (older) throw new Error("main is behind the deployed revision; merge the production changes into main first");
  return target;
}

export async function restoreReleaseDatabase(directory: string, container: string, execute: UpdateCommand) {
  if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error("Invalid database container identity");
  const expected = checkedDataCounts(JSON.parse(readFileSync(join(directory, "database.before.json"), "utf8")));
  const temporary = `slk_release_verify_${randomUUID().replaceAll("-", "")}`;
  const command = (script: string, args: string[], options: RunOptions = {}) =>
    execute(
      "podman",
      [
        "--remote=false",
        "exec",
        ...(options.input === undefined ? [] : ["-i"]),
        container,
        "sh",
        "-ec",
        `if command -v slk-env >/dev/null 2>&1; then exec slk-env sh -ec '${script}' slk-verify "$@"; fi; ${script}`,
        "slk-verify",
        ...args,
      ],
      options,
    );
  await command('exec createdb -U "${POSTGRES_USER:?}" --template template0 "$1"', [temporary]);
  try {
    const fd = openSync(join(directory, "database.before.dump"), "r");
    try {
      await command(
        'exec pg_restore -U "${POSTGRES_USER:?}" --no-owner --no-privileges --exit-on-error -d "$1"',
        [temporary],
        { input: fd },
      );
    } finally {
      closeSync(fd);
    }
    const actual = checkedDataCounts(
      JSON.parse(
        await execute(
          "podman",
          ["--remote=false", "exec", container, ...releaseSqlCommand(temporary, applicationCountsSql)],
          { capture: true },
        ),
      ),
    );
    if (Object.keys(expected).some((key) => expected[key] !== actual[key]))
      throw new Error("Restored application/translation-memory counts differ from the backup");
  } finally {
    await command('exec dropdb -U "${POSTGRES_USER:?}" --force "$1"', [temporary]);
  }
}

export async function prepareReleaseRuntimes(repository: string, execute: UpdateCommand) {
  const caddy = /^FROM localhost\/slk-caddy:([\d.]+)$/m.exec(
    readFileSync(join(repository, "podman/maintenance/Containerfile"), "utf8"),
  )?.[1];
  if (!caddy) throw new Error("Cannot identify the pinned Caddy runtime");
  for (const [image, file, context] of [
    ["slk-runtime-env:local", "podman/environment/Containerfile", "podman/environment"],
    ["slk-podman-directus-runtime:local", "podman/directus/RuntimeContainerfile", "podman/directus"],
    ["slk-podman-frontend-runtime:local", "podman/frontend/RuntimeContainerfile", "podman/frontend"],
    [`slk-caddy:${caddy}`, "caddy/Containerfile", "caddy"],
  ]) {
    const paths = (await execute("git", ["ls-files", "--", context!], { capture: true })).split("\n").filter(Boolean);
    const hash = createHash("sha256");
    // Include the shared runtime source in dependant runtime hashes too.
    const shared = (await execute("git", ["ls-files", "--", "podman/environment"], { capture: true }))
      .split("\n")
      .filter(Boolean);
    for (const path of [...new Set([...paths, ...shared])].sort())
      hash.update(path + "\0").update(readFileSync(join(repository, path)));
    const digest = hash.digest("hex");
    let previous = "";
    try {
      previous = await execute(
        "podman",
        [
          "--remote=false",
          "image",
          "inspect",
          `localhost/${image}`,
          "--format",
          '{{index .Config.Labels "io.slk.release.inputs"}}',
        ],
        { capture: true },
      );
    } catch {
      /* First build. */
    }
    if (previous.trim() === digest) continue;
    await execute("podman", [
      "--remote=false",
      "build",
      "--pull=missing",
      "--memory=3g",
      "--memory-swap=6g",
      "--label",
      `io.slk.release.inputs=${digest}`,
      "-t",
      `localhost/${image}`,
      "-f",
      file!,
      context!,
    ]);
  }
}

async function verifyPublicReads(publicOrigin: string, port: string, execute: UpdateCommand): Promise<void> {
  for (const origin of [`http://127.0.0.1:${port}`, publicOrigin])
    for (const path of ["/api/public/site-layout", "/api/public/catalogs", "/api/public/wahlcheck"]) {
      const response = await execute(
        "curl",
        ["--fail", "--silent", "--show-error", "--max-time", "30", `${origin}${path}`],
        { capture: true },
      );
      checkReleaseRead(path, response);
    }
}

export async function updateProductionRelease(
  options: {
    repository: string;
    home: string;
    config: string;
    environment: NodeJS.ProcessEnv;
  },
  command: UpdateCommand = run,
) {
  const { repository, home, config } = options;
  const environment = { ...options.environment };
  const project = environment.SLK_PODMAN_PROJECT ?? "";
  const previous = environment.SLK_PODMAN_TAG ?? "";
  if (
    !/^[a-z0-9][a-z0-9_-]+$/.test(project) ||
    !releaseTagPattern.test(previous) ||
    environment.SLK_DEPLOYMENT_TARGET !== "production"
  )
    throw new Error("An explicit existing production project and active release tag are required");
  const publicOrigin = releasePublicOrigin(repository, environment);
  const port = environment.SLK_PODMAN_WEB_PORT || "9000";
  if (!/^\d{4,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
    throw new Error("Invalid production web port");
  const execute: UpdateCommand = (program, args, settings = {}) =>
    command(program, args, { cwd: repository, env: environment, ...settings });
  const cli = (args: string[]) => execute(process.execPath, ["bin/slk", ...args]);
  const active = await execute(
    "podman",
    [
      "--remote=false",
      "inspect",
      `${project}_frontend_1`,
      "--format",
      '{{index .Config.Labels "org.opencontainers.image.revision"}}',
    ],
    { capture: true },
  );
  const cms = await execute(
    "podman",
    [
      "--remote=false",
      "inspect",
      `${project}_directus_1`,
      "--format",
      '{{index .Config.Labels "org.opencontainers.image.revision"}}',
    ],
    { capture: true },
  );
  if (active !== cms || !revisionPattern.test(active) || !active.startsWith(previous.slice(8)))
    throw new Error("Running application images do not match the active release configuration");
  const target = await resolveReleaseMain(repository, active, execute);
  const pinnedNode = (await execute("git", ["show", `${target}:.node-version`], { capture: true }))
    .replace(/^v/, "")
    .trim();
  if (pinnedNode !== process.versions.node) throw new Error(`Install/use Node ${pinnedNode} before updating`);
  // Refuse tracked secrets before Git can replace ignored private files.
  const tree = (await execute("git", ["ls-tree", "-r", "--name-only", target], { capture: true })).split("\n");
  const privatePaths = Object.entries(environment)
    .filter(([key]) => /^SLK_PODMAN_.*_ENV_FILE$/.test(key))
    .map(([, path]) => relative(repository, path || ""));
  if (tree.some((path) => /(?:^|\/)\.env(?:$|\.(?!example$))/.test(path) || privatePaths.includes(path)))
    throw new Error("main must not track private environment files");
  let localMain = "";
  try {
    localMain = await execute("git", ["rev-parse", "--verify", "refs/heads/main"], { capture: true });
  } catch {
    /* A detached release need not have local main. */
  }
  if (localMain) {
    try {
      await execute("git", ["merge-base", "--is-ancestor", localMain, target], { capture: true });
    } catch {
      throw new Error("Local main has diverged; preserve its commits before updating");
    }
  }
  const selectMain = async () => {
    await execute(
      "git",
      localMain
        ? ["switch", "--no-overwrite-ignore", "main"]
        : ["switch", "--no-overwrite-ignore", "--create", "main", target],
    );
    await execute("git", ["merge", "--ff-only", target]);
    if ((await execute("git", ["rev-parse", "HEAD"], { capture: true })) !== target)
      throw new Error("main changed during the update; retry with its reviewed revision");
    await execute("git", ["branch", "--set-upstream-to=origin/main", "main"]);
    await execute("git", ["submodule", "sync", "--recursive"]);
    await execute("git", ["submodule", "update", "--init", "--recursive"]);
  };
  if (target === active) {
    await selectMain();
    await verifyPublicReads(publicOrigin, port, execute);
    console.log(`Production already serves ${target}; checked out main.`);
    return;
  }
  let tag = "";
  const releases = join(home, ".local/state/slk-releases");
  mkdirSync(releases, { recursive: true, mode: 0o700 });
  for (let length = 12; length <= 40; length++) {
    const candidate = `release-${target.slice(0, length)}`;
    if (!existsSync(join(releases, candidate))) {
      tag = candidate;
      break;
    }
  }
  if (!tag) throw new Error("Existing release attempts must be reviewed before retrying");
  const unit = releaseBackupUnit(tag);
  if (
    (await execute("systemctl", ["show", unit, "--property=LoadState", "--value"], { capture: true })).trim() !==
    "loaded"
  )
    throw new Error("Install the reviewed host maintenance configuration once to enable release backups");
  try {
    await execute("sudo", ["-n", "-l", "/usr/bin/systemctl", "start", unit], { capture: true });
  } catch {
    throw new Error("Install the reviewed release-backup sudo rule before updating; no application was changed");
  }
  const state = join(releases, tag);
  environment.SLK_RELEASE_PREVIOUS_REVISION = active;
  const release = (action: string) => cli(["release", action, config, tag, previous, "--env", "production"]);
  console.log(`Backing up ${previous}; preparing ${tag} from origin/main.`);
  await release("backup");
  await verifyCheckpoint(state, process.getuid!());
  const request = join(releases, `backup.request.${randomUUID()}.tmp`);
  writeFileSync(request, JSON.stringify({ tag }) + "\n", { mode: 0o600, flag: "wx" });
  renameSync(request, join(releases, "backup.request.json"));
  await execute("sudo", ["-n", "/usr/bin/systemctl", "start", unit]);
  privateReleasePath(join(state, "backup.offhost.json"), process.getuid!());
  const proof = JSON.parse(readFileSync(join(state, "backup.offhost.json"), "utf8")) as Record<string, unknown>;
  if (
    proof.tag !== tag ||
    typeof proof.snapshot !== "string" ||
    !/^[a-f0-9]{8,64}$/.test(proof.snapshot) ||
    proof.manifest !== (await fileDigest(join(state, "backups.sha256")))
  )
    throw new Error("Off-host verification does not match this checkpoint");
  const database = await execute(
    "podman",
    [
      "--remote=false",
      "ps",
      "-q",
      "--filter",
      `label=io.podman.compose.project=${project}`,
      "--filter",
      "label=io.podman.compose.service=db",
    ],
    { capture: true },
  );
  await restoreReleaseDatabase(state, database, execute);
  writeFileSync(join(state, "backup.verified"), "Off-host checksums and isolated database restore verified.\n", {
    mode: 0o600,
    flag: "wx",
  });
  await selectMain();
  await execute("npm", ["ci", "--prefix", "bin", "--ignore-scripts", "--no-audit", "--no-fund"]);
  await prepareReleaseRuntimes(repository, execute);
  await release("stage");
  // stage completes while the old application continues serving requests.
  await release("activate");
  try {
    await verifyPublicReads(publicOrigin, port, execute);
    for (const service of ["frontend", "directus"]) {
      const revision = await execute(
        "podman",
        [
          "--remote=false",
          "inspect",
          `${project}_${service}_1`,
          "--format",
          '{{index .Config.Labels "org.opencontainers.image.revision"}}',
        ],
        { capture: true },
      );
      if (revision !== target) throw new Error("Application revision differs from origin/main");
    }
  } catch (error) {
    await release("rollback");
    throw error;
  }
  writeFileSync(join(state, "update.ok"), target + "\n", { mode: 0o600 });
  console.log(`Production updated to ${target}. YAML imported, application reads verified, datastores preserved.`);
}

export function releaseUpdateServiceArguments(
  unit: string,
  project: string,
  lock: string,
  config: string,
  environment: NodeJS.ProcessEnv,
  apparmor: boolean,
): string[] {
  return [
    "--user",
    "--wait",
    "--collect",
    "--unit",
    unit,
    "--property=KillMode=process",
    "--property=StandardOutput=journal",
    "--property=StandardError=journal",
    "--setenv",
    `PATH=${environment.PATH}`,
    "--setenv",
    `XDG_RUNTIME_DIR=${environment.XDG_RUNTIME_DIR}`,
    "--setenv",
    `DBUS_SESSION_BUS_ADDRESS=${environment.DBUS_SESSION_BUS_ADDRESS}`,
    "--setenv",
    `SLK_RELEASE_UPDATE_LOCKED=${project}`,
    "--setenv",
    `CONTAINERS_CONF_OVERRIDE=${environment.CONTAINERS_CONF_OVERRIDE || ""}`,
    ...(apparmor ? ["aa-exec", "-p", "slk-rootless", "--"] : []),
    "flock",
    "--close",
    "--nonblock",
    lock,
    process.execPath,
    fileURLToPath(import.meta.url),
    "--locked",
    config,
  ];
}

export async function releaseUpdate(explicit?: string) {
  if (process.platform !== "linux" || !process.getuid?.())
    throw new Error("Run release update as the deployment user on Linux");
  const expected = readFileSync(join(root, ".node-version"), "utf8").trim().replace(/^v/, "");
  if (process.versions.node !== expected) {
    for (const binary of [
      "/usr/local/lib/slk/node",
      join(homedir(), `.local/lib/node-v${expected}-linux-x64/bin/node`),
      join(homedir(), `.local/opt/node-v${expected}-linux-x64/bin/node`),
    ]) {
      if (!existsSync(binary)) continue;
      if ((await run(binary, ["--version"], { capture: true })) !== `v${expected}`) continue;
      if (!process.execve) throw new Error("Native process replacement is required");
      process.execve(binary, [binary, ...process.argv.slice(1)], {
        ...process.env,
        PATH: `${dirname(binary)}:${process.env.PATH || ""}`,
      });
    }
    throw new Error(`Install the pinned Node ${expected} runtime before updating`);
  }
  process.env.PATH = `${dirname(process.execPath)}:${process.env.PATH || ""}`;
  const config = releaseUpdateConfig(homedir(), explicit);
  Object.assign(process.env, hostEnvironment(config, false));
  process.env.XDG_RUNTIME_DIR ||= `/run/user/${process.getuid()}`;
  process.env.DBUS_SESSION_BUS_ADDRESS ||= `unix:path=${process.env.XDG_RUNTIME_DIR}/bus`;
  const rt = await runtime("production", "doctor");
  const store = await run("podman", ["--remote=false", "info", "--format", "{{.Store.GraphRoot}}"], { capture: true });
  const disk = statfsSync(store);
  assertReleaseResources(readFileSync("/proc/meminfo", "utf8"), disk.bavail * disk.bsize);
  const lock = join(process.env.XDG_RUNTIME_DIR, "slk-podman", `${rt.project}.update.lock`);
  const unit = `slk-release-update-${rt.project}-${randomUUID().slice(0, 8)}`;
  console.log(`Updating production from origin/main. Follow progress: journalctl --user -u ${unit} -f`);
  await run(
    "systemd-run",
    releaseUpdateServiceArguments(
      unit,
      rt.project,
      lock,
      config,
      process.env,
      existsSync("/etc/apparmor.d/slk-rootless"),
    ),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== "--locked" || !process.argv[3] || process.argv.length !== 4 || !process.getuid?.())
      throw new Error("Use slk release update --env production");
    await updateProductionRelease({
      repository: root,
      home: homedir(),
      config: process.argv[3],
      environment: hostEnvironment(process.argv[3], false),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Production update failed");
    process.exitCode = 1;
  }
}
