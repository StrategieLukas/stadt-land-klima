import yaml from "yaml";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  run,
  capture,
  succeeds,
  node,
  pause,
  root,
  CommandError,
  type Environment,
  type RunOptions,
} from "./process.ts";

export type StackOptions = {
  import?: boolean;
  prepareOnly?: boolean;
  noDirectusBuild?: boolean;
  noFrontendBuild?: boolean;
};
export class Runtime {
  readonly environment: Environment;
  readonly project: string;
  readonly args: string[];
  readonly env: NodeJS.ProcessEnv;
  readonly webPort: number;
  readonly cmsPort: number;
  constructor(
    environment: Environment,
    project: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    webPort: number,
    cmsPort: number,
  ) {
    this.environment = environment;
    this.project = project;
    this.args = args;
    this.env = env;
    this.webPort = webPort;
    this.cmsPort = cmsPort;
  }
  raw(args: string[], options: RunOptions = {}) {
    const at = args[0] === "ps" ? 0 : args[0] === "--profile" && args[2] === "ps" ? 2 : -1;
    if (at >= 0) {
      const tail = args.slice(at + 1);
      const service = tail.find((value) =>
        ["db", "cache", "meilisearch", "directus", "frontend", "maintenance", "frontend-build"].includes(value),
      );
      if (service || tail.includes("--services")) {
        const filters = ["--filter", `label=io.podman.compose.project=${this.project}`];
        if (service) filters.push("--filter", `label=io.podman.compose.service=${service}`);
        const format = tail.includes("--services") ? '{{.Label "io.podman.compose.service"}}' : "{{.ID}}";
        return run(
          "podman",
          ["--remote=false", "ps", ...(tail.includes("running") ? [] : ["--all"]), ...filters, "--format", format],
          { ...options, env: this.env },
        );
      }
    }
    return run("podman-compose", [...this.args, ...args], { ...options, env: this.env });
  }
  async useStorageOverlay(path: string) {
    // Podman Compose 1.6 appends long-form volume overrides. Flatten before
    // applying storage cutover so each destination has exactly one mount.
    type Mount = string | { type?: string; source?: string; target: string };
    type Service = { volumes?: Mount[]; build?: string | { context?: string }; image?: string };
    const config = yaml.parse(await this.raw(["config"], { capture: true })) as {
      services: Record<string, Service>;
      volumes?: Record<string, unknown>;
    };
    const overlay = yaml.parse(readFileSync(path, "utf8")) as {
      services: Record<string, Service>;
      volumes?: Record<string, unknown>;
    };
    const destination = (mount: Mount) => (typeof mount === "string" ? mount.split(":")[1] : mount.target);
    for (const [name, changes] of Object.entries(overlay.services)) {
      const service = config.services[name];
      if (!service) throw new Error("Storage overlay names an unknown service");
      if (changes.image) service.image = changes.image;
      for (const mount of changes.volumes ?? [])
        service.volumes = [...(service.volumes ?? []).filter((old) => destination(old) !== destination(mount)), mount];
    }
    config.volumes = { ...config.volumes, ...overlay.volumes };
    for (const service of Object.values(config.services)) {
      if (typeof service.build === "string") service.build = resolve(root, service.build);
      else if (service.build?.context) service.build.context = resolve(root, service.build.context);
      if (service.volumes)
        service.volumes = service.volumes.map((mount) => {
          if (typeof mount !== "string")
            return mount.type === "bind" && mount.source ? { ...mount, source: resolve(root, mount.source) } : mount;
          const parts = mount.split(":");
          if (parts.length > 1 && /^[./]/.test(parts[0]!)) parts[0] = resolve(root, parts[0]!);
          return parts.join(":");
        });
    }
    const directory = join(this.env.XDG_RUNTIME_DIR || process.env.XDG_RUNTIME_DIR!, "slk-podman");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const output = join(directory, this.project + ".storage.compose.json"),
      temporary = output + "." + randomUUID();
    writeFileSync(temporary, JSON.stringify(config) + "\n", { mode: 0o600, flag: "wx" });
    renameSync(temporary, output);
    const args: string[] = [];
    for (let index = 0; index < this.args.length; index++) {
      if (this.args[index] === "-f") {
        index++;
        continue;
      }
      args.push(this.args[index]!);
    }
    this.args.splice(0, this.args.length, ...args, "-f", output);
  }
  compose(args: string[], options: RunOptions = {}) {
    if (args[0] !== "exec") return this.raw(args, options);
    const command = args.slice(1),
      flags: string[] = [],
      keep: string[] = [];
    while (command[0]?.startsWith("-")) {
      const flag = command.shift()!;
      flags.push(flag);
      if (["-e", "--env", "-u", "--user", "-w", "--workdir", "--index"].includes(flag)) {
        const value = command.shift();
        if (!value) throw new Error("Missing exec option value");
        flags.push(value);
        if (["-e", "--env"].includes(flag)) keep.push(value.split("=")[0]!);
      } else if (flag.startsWith("--env=")) keep.push(flag.slice(6).split("=")[0]!);
    }
    const service = command.shift();
    if (!service || !command.length) throw new Error("Provide an exec service and command");
    const prefix = ["db", "meilisearch", "directus", "frontend"].includes(service)
      ? ["/usr/local/bin/slk-env", `--keep=${keep.join(",")}`]
      : [];
    if (service === "frontend") prefix.push("node", "scripts/runtimeEnvironment.mts");
    return this.raw(["exec", ...flags, service, ...prefix, ...command], options);
  }
  get metadataPath() {
    return join(process.env.XDG_RUNTIME_DIR!, "slk-podman", this.project + ".maintenance-meta.js");
  }
  async ready(url: string) {
    const deadline = Date.now() + 360_000;
    while (Date.now() < deadline) {
      if (
        await succeeds("curl", [
          "--fail",
          "--silent",
          "--output",
          "/dev/null",
          "--connect-timeout",
          "2",
          "--max-time",
          "5",
          url,
        ])
      )
        return;
      await pause(2000);
    }
    throw new Error("Readiness failed. Maintenance remains active; inspect private logs.");
  }
  async prepare() {
    if (this.environment !== "production") return;
    const ids = await capture("podman", [
      "--remote=false",
      "ps",
      "-q",
      "--filter",
      `label=io.podman.compose.project=${this.project}`,
      "--filter",
      "label=io.podman.compose.service=frontend",
    ]);
    if (ids) throw new Error("Stop frontend before preparing its output; live artifacts must not be overwritten.");
    try {
      await this.raw(["run", "--rm", "--no-deps", "frontend", "node", "scripts/productionOutput.mts", "verify"]);
    } catch {
      await this.raw(["--profile", "build", "run", "-T", "--rm", "--no-deps", "frontend-build"]);
    }
  }
}
export async function runtime(environment: Environment, doctor = false): Promise<Runtime> {
  if (
    existsSync("/etc/apparmor.d/slk-rootless") &&
    !readFileSync("/proc/self/attr/current", "utf8").includes("slk-rootless")
  ) {
    if (!process.execve) throw new Error("Node 24 or newer is required");
    process.execve(
      "/usr/bin/env",
      ["env", "aa-exec", "-p", "slk-rootless", "--", process.execPath, ...process.argv.slice(1)],
      process.env,
    );
  }
  if (process.getuid?.() === 0) throw new Error("Use a non-root deployment account, without sudo.");
  if (process.env.CONTAINER_HOST || process.env.CONTAINER_CONNECTION)
    throw new Error("Remote Podman connections are not supported.");
  const port = (value: string | undefined, fallback: number) => {
    const result = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(result) || result < 1024 || result > 65535)
      throw new Error("Podman ports must be between 1024 and 65535.");
    return result;
  };
  const web = port(process.env.SLK_PODMAN_WEB_PORT, environment === "production" ? 9000 : 8080);
  const cms = port(process.env.SLK_PODMAN_CMS_PORT, environment === "production" ? 9001 : 8081);
  const maintenance = port(process.env.SLK_PODMAN_MAINTENANCE_PORT, 9090);
  const project = process.env.SLK_PODMAN_PROJECT || `slk-podman-${environment}`;
  if (!/^[a-z0-9][a-z0-9_-]+$/.test(project)) throw new Error("Invalid SLK_PODMAN_PROJECT.");
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/.test(process.env.SLK_PODMAN_TAG || "local"))
    throw new Error("Invalid SLK_PODMAN_TAG.");
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Node 24 or newer is required.");
  const provider = /podman-compose version (\d+)\.(\d+)\.(\d+)/.exec(await capture("podman-compose", ["--version"]));
  if (!provider || +provider[1]! < 1 || (+provider[1]! === 1 && +provider[2]! < 6))
    throw new Error("podman-compose 1.6 or newer is required.");
  const seccomp = await node("bin/lib/podman-security.ts", ["host", environment], { capture: true });
  process.env.CONTAINERS_CONF_OVERRIDE = join(process.env.XDG_RUNTIME_DIR!, "slk-podman/engine.conf");
  await node("bin/lib/podman-security.ts", ["environment"]);
  const env = {
    ...process.env,
    SLK_PODMAN_WEB_PORT: String(web),
    SLK_PODMAN_CMS_PORT: String(cms),
    SLK_PODMAN_MAINTENANCE_PORT: String(maintenance),
    SLK_PODMAN_SECCOMP: seccomp,
  };
  const args = [
    "--podman-path",
    join(root, "bin/cli/podman-local.mjs"),
    "--in-pod=false",
    "-p",
    project,
    "-f",
    "podman-compose.yaml",
    "-f",
    `podman-compose.${environment === "production" ? "prod" : "dev"}.yaml`,
  ];
  if (!doctor)
    args.push("-f", await node("bin/lib/podman-environment.ts", [environment, project], { capture: true, env }));
  const storage = `podman/core-storage/${environment}.compose.json`;
  const rt = new Runtime(environment, project, args, env, web, cms);
  if (existsSync(join(root, storage))) await rt.useStorageOverlay(join(root, storage));
  if (!doctor && process.env.SLK_PODMAN_VOLUME_OVERLAY)
    await rt.useStorageOverlay(resolve(process.env.SLK_PODMAN_VOLUME_OVERLAY));
  return rt;
}
export async function performStack(
  environment: Environment,
  action: string,
  args: string[] = [],
  options: StackOptions = {},
) {
  const rt = await runtime(environment, action === "doctor");
  if (
    ["start", "prepare", "build", "restart", "stop", "maintenance"].includes(action) &&
    process.env.SLK_DEPLOYMENT_LOCK !== rt.project
  ) {
    return run(
      "flock",
      [
        "--nonblock",
        join(process.env.XDG_RUNTIME_DIR!, "slk-podman", `${rt.project}.lock`),
        process.execPath,
        fileURLToPath(import.meta.url),
        environment,
        action,
        JSON.stringify(args),
        JSON.stringify(options),
      ],
      { env: { ...process.env, SLK_DEPLOYMENT_LOCK: rt.project } },
    );
  }
  switch (action) {
    case "doctor":
      console.log("Rootless Podman, resource delegation and the selected seccomp profile passed preflight.");
      break;
    case "compose":
      return rt.compose(args);
    case "prepare":
      await rt.prepare();
      break;
    case "restart":
      await node("bin/lib/maintenance-meta.ts", [rt.metadataPath]);
      return rt.raw(["restart", ...args]);
    case "maintenance":
      await maintenance(rt);
      break;
    case "stop":
      return rt.raw(["--profile", "maintenance", "stop"]);
    case "build": {
      if (options.noDirectusBuild && options.noFrontendBuild) return "";
      await run("podman", [
        "--remote=false",
        "build",
        "--pull=always",
        "-t",
        "localhost/slk-runtime-env:local",
        "-f",
        "podman/environment/Containerfile",
        "podman/environment",
      ]);
      const services = ["db", "meilisearch", "maintenance"];
      for (const service of ["directus", "frontend"] as const) {
        if (service === "directus" ? options.noDirectusBuild : options.noFrontendBuild) continue;
        await run("podman", [
          "--remote=false",
          "build",
          "--pull=missing",
          "--build-arg",
          "UID=1000",
          "--build-arg",
          "GID=1000",
          "-t",
          `localhost/slk-podman-${service}-runtime:local`,
          "-f",
          `podman/${service}/RuntimeContainerfile`,
          `podman/${service}`,
        ]);
        services.push(service);
      }
      await run("podman", [
        "--remote=false",
        "build",
        "--pull=always",
        "-t",
        "localhost/slk-caddy:2.11.9",
        "-f",
        "caddy/Containerfile",
        "caddy",
      ]);
      await rt.raw(["--profile", "maintenance", "build", ...services]);
      break;
    }
    case "start": {
      if (environment === "production") {
        await node("bin/lib/maintenance-meta.ts", [rt.metadataPath]);
        await rt.raw(["--profile", "maintenance", "up", "-d", "--no-build", "maintenance"]);
        await rt.raw(["stop", "frontend"]);
      }
      await rt.raw(["up", "-d", "--no-build", "db", "cache", "meilisearch"]);
      if (options.import) {
        await rt.raw(["stop", "directus"]);
        // Compose run publishes no service ports. Import before loading hooks
        // that require application tables, then enforce normal startup checks.
        await rt.raw([
          "run",
          "--rm",
          "--no-deps",
          "--entrypoint",
          "/usr/local/bin/slk-env",
          "directus",
          "node",
          "/directus/cli/bootstrapConfiguration.ts",
        ]);
      }
      await rt.raw(["up", "-d", "--no-build", "--no-deps", "--force-recreate", "directus"]);
      await rt.ready(`http://127.0.0.1:${rt.cmsPort}/server/health`);
      if (options.prepareOnly) break;
      await rt.prepare();
      await rt.raw(["up", "-d", "--no-build", "--no-deps", "--force-recreate", "frontend"]);
      await rt.ready(`http://127.0.0.1:${rt.webPort}/`);
      if (environment === "production") {
        await audit(rt);
        await rt.raw(["--profile", "maintenance", "stop", "maintenance"]);
      }
      break;
    }
    case "audit":
      await audit(rt);
      break;
    default:
      throw new Error("Unknown stack action");
  }
  return "";
}
export async function maintenance(rt: Runtime) {
  await node("bin/lib/maintenance-meta.ts", [rt.metadataPath]);
  await rt.raw(["--profile", "maintenance", "up", "-d", "--no-build", "--force-recreate", "maintenance"]);
  await rt.raw(["stop", "frontend", "directus", "meilisearch", "cache", "db"]);
}
async function audit(rt: Runtime) {
  if (rt.environment !== "production")
    throw new Error("Runtime audit targets production; development mounts source writable.");
  for (const service of ["db", "cache", "meilisearch", "directus", "frontend", "maintenance"]) {
    const id = await rt.raw(["--profile", "maintenance", "ps", "-q", service], { capture: true });
    if (!id) throw new Error(`Missing runtime service: ${service}`);
    const metadata = await capture("podman", ["--remote=false", "inspect", id]);
    await node("bin/lib/podman-security.ts", ["container", service], { input: metadata, env: rt.env });
    if (
      service === "maintenance" &&
      (await capture("podman", ["--remote=false", "inspect", "--format", "{{.State.Running}}", id])) !== "true"
    )
      continue;
    await run("podman", [
      "--remote=false",
      "exec",
      id,
      "sh",
      "-ec",
      'test "$(id -u)" != 0; grep -Eq "^NoNewPrivs:[[:space:]]+1$" /proc/1/status; grep -Eq "^Seccomp:[[:space:]]+2$" /proc/1/status; grep -Eq "^CapEff:[[:space:]]+0+$" /proc/1/status; grep -Eq "^CapBnd:[[:space:]]+0+$" /proc/1/status',
    ]);
    if (readFileSync("/proc/self/attr/current", "utf8").includes("slk-rootless")) {
      const label = await capture("podman", ["--remote=false", "exec", id, "cat", "/proc/1/attr/current"]);
      await node("bin/lib/podman-security.ts", ["apparmor"], { input: label });
    }
    console.log(`Runtime confinement verified: ${service}`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [environment, action, args, options] = process.argv.slice(2);
  try {
    await performStack(environment as Environment, action!, JSON.parse(args!), JSON.parse(options!));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Stack command failed");
    process.exitCode = error instanceof CommandError ? error.code : 1;
  }
}
