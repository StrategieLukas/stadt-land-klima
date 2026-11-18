/** Monitoring-only installer. Run locally as the existing Podman owner; no SSH or sudo. */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { hostPath, privateHostFile } from "./host-configuration.ts";

const repository = resolve(import.meta.dirname, "../..");
const assets = join(repository, "podman/logging/monitoring");
const plugin = "victoriametrics-logs-datasource";
const pluginVersion = "0.33.1";
const begin = "# BEGIN SLK CENTRAL LOGGING — managed";
const end = "# END SLK CENTRAL LOGGING — managed";
const managed = "# Managed by slk monitoring\n";
const backendFiles = ["slk-logs.network", "slk-victorialogs.volume", "slk-victorialogs.container"];
const clientImage = "docker.io/library/node:24.22.3-trixie-slim";
export type MonitoringRun = (tool: string, args: string[], input?: string) => string;
type Artifact = { path: string; content: string; mode: number };
type Snapshot = { path: string; content: string | null; mode: number };
type Container = {
  Id: string;
  Image: string;
  Name: string;
  State: { Running: boolean };
  Config: { Env: string[]; Labels: Record<string, string>; User: string };
  Mounts: { Source: string; Destination: string; Type: string }[];
  NetworkSettings: { Networks: Record<string, unknown>; Ports: Record<string, unknown> };
};

/** No subprocess output is reflected: configs, environment and diagnostics can contain secrets. */
const execute: MonitoringRun = (tool, args, input) => {
  const result = spawnSync(tool, args, {
    encoding: "utf8",
    timeout: args[0] === "build" ? 1_200_000 : 180_000,
    maxBuffer: 16 * 1024 * 1024,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    ...(input === undefined ? {} : { input }),
  });
  if (result.status !== 0) throw new Error(`Monitoring operation failed: ${tool} ${args[0] ?? ""}; output withheld`);
  return result.stdout.trim();
};

export function monitoringSettings(value: unknown, home = homedir(), uid = process.getuid!()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON settings object");
  const fields = value as Record<string, unknown>;
  const keys = [
    "scope",
    "grafanaUnit",
    "caddyUnit",
    "caddyfile",
    "caddyfileInContainer",
    "hostname",
    "username",
    "hostLabel",
    "environment",
    "directory",
    "buildCaddyIfNeeded",
  ];
  if (Object.keys(fields).some((key) => !keys.includes(key))) throw new Error("Unknown monitoring setting");
  const text = (key: string, fallback = "") => {
    const result = fields[key] ?? fallback;
    if (typeof result !== "string") throw new Error(`Invalid setting: ${key}`);
    return result;
  };
  const scope = text("scope");
  if ((scope !== "user" && scope !== "system") || (scope === "system") !== (uid === 0))
    throw new Error("Explicit scope must match the current Podman owner: user/non-root or system/root");
  const unit = (key: string) => {
    const name = text(key);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.service$/.test(name) || name === "slk-victorialogs.service")
      throw new Error(`Invalid unit: ${key}`);
    return name;
  };
  const label = (key: string, fallback: string) => {
    const result = text(key, fallback);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(result)) throw new Error(`Invalid label: ${key}`);
    return result;
  };
  const hostname = text("hostname");
  if (hostname.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname))
    throw new Error("A lowercase public DNS hostname is required");
  const buildCaddyIfNeeded = fields.buildCaddyIfNeeded ?? true;
  if (typeof buildCaddyIfNeeded !== "boolean") throw new Error("buildCaddyIfNeeded must be boolean");
  const quadlets = scope === "user" ? join(home, ".config/containers/systemd") : "/etc/containers/systemd";
  const settings = {
    scope,
    quadlets: hostPath(quadlets),
    directory: hostPath(text("directory", join(home, ".config/slk-monitoring"))),
    grafanaUnit: unit("grafanaUnit"),
    caddyUnit: unit("caddyUnit"),
    caddyfile: hostPath(text("caddyfile")),
    caddyfileInContainer: hostPath(text("caddyfileInContainer", "/etc/caddy/Caddyfile")),
    hostname,
    username: label("username", "slk-production"),
    hostLabel: label("hostLabel", "slk-production-1"),
    environment: label("environment", "production"),
    buildCaddyIfNeeded,
  };
  if (
    settings.grafanaUnit === settings.caddyUnit ||
    settings.directory === "/" ||
    settings.caddyfile.startsWith(`${settings.directory}/`)
  )
    throw new Error("Separate Grafana, Caddy and installer state paths are required");
  return settings;
}
export type MonitoringSettings = ReturnType<typeof monitoringSettings>;

/** Quote an INI value, including literal systemd specifiers; never evaluate shell syntax. */
export function quadletQuote(value: string) {
  if (/[\x00-\x1f\x7f]/.test(value)) throw new Error("Control characters in Quadlet value");
  return `"${value.replaceAll("%", "%%").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function mergeIngestion(current: string, site: string, hostname: string) {
  let remainder = current;
  const start = current.indexOf(begin);
  if (start !== -1) {
    const stop = current.indexOf(end, start);
    if (
      stop === -1 ||
      current.indexOf(begin, start + begin.length) !== -1 ||
      current.indexOf(end, stop + end.length) !== -1
    )
      throw new Error("Malformed managed Caddy block");
    remainder = current.slice(0, start) + current.slice(stop + end.length).replace(/^\r?\n/, "");
  } else if (current.includes(end)) throw new Error("Malformed managed Caddy block");
  if (remainder.includes(hostname))
    throw new Error("Ingestion hostname already appears outside the managed Caddy block");
  return `${remainder.replace(/\n*$/, "\n")}${begin}\n${site.trim()}\n${end}\n`;
}

export function pluginEnvironment(environment: string[], syncList = true) {
  const values = Object.fromEntries(
    environment.map((value) => {
      const i = value.indexOf("=");
      return [value.slice(0, i), value.slice(i + 1)];
    }),
  );
  if (
    (values.GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .includes(plugin)
  )
    throw new Error("Remove the VictoriaLogs unsigned-plugin exception before installation");
  if (values.GF_PLUGINS_PREINSTALL_DISABLED?.toLowerCase() === "true")
    throw new Error("Grafana plugin preinstallation is explicitly disabled; resolve its policy before installation");
  const keep = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && !new RegExp(`^${plugin}(?:@|\\s|$)`).test(item));
  const entries = [
    ...keep(values.GF_PLUGINS_PREINSTALL_SYNC ?? ""),
    ...(!syncList ? keep(values.GF_PLUGINS_PREINSTALL ?? "") : []),
    `${plugin}@${pluginVersion}`,
  ];
  const key = syncList ? "GF_PLUGINS_PREINSTALL_SYNC" : "GF_PLUGINS_PREINSTALL";
  return [
    `Environment=${quadletQuote(`${key}=${entries.join(",")}`)}`,
    ...(!syncList ? [`Environment="GF_PLUGINS_PREINSTALL_ASYNC=false"`] : []),
    ...[...(syncList ? ["GF_PLUGINS_PREINSTALL"] : []), "GF_INSTALL_PLUGINS"]
      .filter((key) => values[key] !== undefined)
      .map((key) => `Environment=${quadletQuote(`${key}=${keep(values[key]!).join(",")}`)}`),
  ].join("\n");
}

/** Read only the active plugin settings; Grafana evaluates environment overrides first. */
export function configuredPluginEnvironment(environment: string[], ini: string) {
  const values = new Map(environment.map((value) => [value.slice(0, value.indexOf("=")), value]));
  let plugins = false;
  for (const line of ini.split(/\r?\n/)) {
    const section = /^\s*\[([^\]]+)\]/.exec(line);
    if (section) plugins = section[1] === "plugins";
    const setting =
      plugins &&
      /^\s*(preinstall|preinstall_sync|preinstall_disabled|allow_loading_unsigned_plugins)\s*=\s*(.*?)\s*$/.exec(line);
    if (setting) {
      const key = `GF_PLUGINS_${setting[1]!.toUpperCase()}`;
      if (!values.has(key)) {
        if (/\$__|\$\{/.test(setting[2]!))
          throw new Error("Resolve indirect Grafana plugin configuration before installation");
        const value = setting[2]!.replace(/^(["'])(.*)\1$/, "$2");
        values.set(key, `${key}=${value}`);
      }
    }
  }
  return [...values.values()];
}

function safeParents(path: string, uid: number) {
  hostPath(path);
  for (let parent = dirname(path); ; parent = dirname(parent)) {
    if (existsSync(parent)) {
      const stat = lstatSync(parent);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        (stat.uid !== uid && stat.uid !== 0) ||
        ((stat.mode & 0o022) !== 0 && (stat.mode & 0o1000) === 0)
      )
        throw new Error(`Unsafe installation parent: ${parent}`);
    }
    if (parent === "/") break;
  }
}
function assertWritableFile(path: string, uid: number) {
  safeParents(path, uid);
  if (existsSync(path)) {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== uid || (stat.mode & 0o022) !== 0)
      throw new Error(`Unsafe installation file: ${path}`);
  } else {
    // existsSync follows links and returns false for a dangling symlink.
    try {
      lstatSync(path);
      throw new Error(`Unsafe installation link: ${path}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
function outsideCheckout(path: string) {
  for (let parent = dirname(path); ; parent = dirname(parent)) {
    if (existsSync(join(parent, ".git")))
      throw new Error("Install runtime copies outside Git checkouts; tracked server configuration is never edited");
    if (parent === "/") break;
  }
}
function atomicWrite(file: Artifact, uid: number) {
  assertWritableFile(file.path, uid);
  mkdirSync(dirname(file.path), { recursive: true, mode: 0o700 });
  const temporary = `${file.path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, file.content, { mode: file.mode, flag: "wx" });
    chmodSync(temporary, file.mode);
    renameSync(temporary, file.path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function inspectContainer(unit: string, run: MonitoringRun) {
  const ids = run("podman", ["ps", "--filter", `label=PODMAN_SYSTEMD_UNIT=${unit}`, "--format", "{{.ID}}"]);
  if (!/^[a-f0-9]{12,64}$/.test(ids)) throw new Error(`Expected exactly one running Quadlet container for ${unit}`);
  const container = (JSON.parse(run("podman", ["inspect", ids])) as Container[])[0]!;
  if (!container.State.Running || container.Config.Labels.PODMAN_SYSTEMD_UNIT !== unit)
    throw new Error(`Container scope mismatch for ${unit}`);
  return container;
}
function environment(container: Container, key: string, fallback: string) {
  return container.Config.Env.findLast((value) => value.startsWith(`${key}=`))?.slice(key.length + 1) ?? fallback;
}
function moduleNames(output: string) {
  return new Set(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^[a-zA-Z][a-zA-Z0-9_.-]+$/.test(line)),
  );
}

export function discoverMonitoring(settings: MonitoringSettings, run: MonitoringRun = execute) {
  const systemctl = (args: string[]) => run("systemctl", [...(settings.scope === "user" ? ["--user"] : []), ...args]);
  if (run("podman", ["info", "--format", "{{.Host.CgroupsVersion}}"]) !== "v2")
    throw new Error("Podman cgroup v2 is required");
  const sources = [settings.grafanaUnit, settings.caddyUnit].map((unit) => {
    const source = hostPath(systemctl(["show", unit, "--property=SourcePath", "--value"]));
    if (
      !source.endsWith(".container") ||
      dirname(source) !== settings.quadlets ||
      `${basename(source, ".container")}.service` !== unit
    )
      throw new Error("Installer requires source Quadlets in the standard owner directory with default service names");
    systemctl(["is-active", "--quiet", unit]);
    return source;
  });
  const grafana = inspectContainer(settings.grafanaUnit, run);
  const caddy = inspectContainer(settings.caddyUnit, run);
  const mounted = caddy.Mounts.some((mount) => {
    if (mount.Type !== "bind") return false;
    return (
      (mount.Destination === settings.caddyfileInContainer && mount.Source === settings.caddyfile) ||
      (settings.caddyfileInContainer.startsWith(`${mount.Destination}/`) &&
        join(mount.Source, settings.caddyfileInContainer.slice(mount.Destination.length)) === settings.caddyfile)
    );
  });
  if (!mounted) throw new Error("caddyfile must map to the running Caddy container's configured bind mount");
  const version = run("podman", ["exec", grafana.Id, "grafana", "-v"]).match(/(?:Version |version[= ]|v)(\d+)\.(\d+)/i);
  if (!version || Number(version[1]) < 11 || (Number(version[1]) === 11 && Number(version[2]) < 5))
    throw new Error(
      "Automated synchronous plugin installation requires Grafana 11.5+; use the manual guide for older Grafana",
    );
  const provision = hostPath(environment(grafana, "GF_PATHS_PROVISIONING", "/etc/grafana/provisioning"));
  const configPath = hostPath(environment(grafana, "GF_PATHS_CONFIG", "/etc/grafana/grafana.ini"));
  const ini = run("podman", ["exec", grafana.Id, "/bin/cat", configPath]);
  const defaults = run("podman", [
    "exec",
    grafana.Id,
    "/bin/cat",
    `${hostPath(environment(grafana, "GF_PATHS_HOME", "/usr/share/grafana"))}/conf/defaults.ini`,
  ]);
  const syncList = /^\s*preinstall_sync\s*=/m.test(defaults);
  if (!syncList && !/^\s*preinstall_async\s*=/m.test(defaults))
    throw new Error("Grafana does not expose a supported synchronous plugin installation setting");
  const pluginEnv = configuredPluginEnvironment(grafana.Config.Env, ini);
  pluginEnvironment(pluginEnv, syncList);
  const target = `${provision}/datasources/slk-victorialogs.yaml`;
  const existing = run("podman", [
    "exec",
    grafana.Id,
    "/bin/sh",
    "-c",
    'grep -R -l -- slk-victorialogs "$1" 2>/dev/null || test "$?" = 1',
    "sh",
    `${provision}/datasources`,
  ]);
  const ownMount = grafana.Mounts.some(
    (mount) => mount.Destination === target && mount.Source === join(settings.directory, "slk-victorialogs.yaml"),
  );
  if (existing.split("\n").some((path) => path && (path !== target || !ownMount)))
    throw new Error(
      "Existing Grafana provisioning contains the reserved datasource UID; reconcile it before installation",
    );
  const modules = moduleNames(run("podman", ["exec", caddy.Id, "/usr/bin/caddy", "list-modules"]));
  const needsBuild = !modules.has("http.handlers.rate_limit");
  if (!modules.size) throw new Error("Could not identify current Caddy modules");
  if (needsBuild && !settings.buildCaddyIfNeeded)
    throw new Error("Caddy lacks http.handlers.rate_limit; enable buildCaddyIfNeeded or provide a reviewed image");
  return { systemctl, sources, grafana, caddy, provision, modules, needsBuild, pluginEnv, syncList };
}
type Discovery = ReturnType<typeof discoverMonitoring>;

export function monitoringArtifacts(
  settings: MonitoringSettings,
  discovery: Discovery,
  hash: string,
  currentCaddy: string,
  caddyImage?: string,
): Artifact[] {
  if (!/^\$2[aby]\$\d{2}\$[./a-zA-Z0-9]{53}$/.test(hash)) throw new Error("Invalid bcrypt hash");
  const site = readFileSync(join(assets, "ingestion.caddy.example"), "utf8")
    .replaceAll("logs.stadt-land-klima.de", settings.hostname)
    .replace("slk-production REPLACE_WITH_CADDY_PASSWORD_HASH", `${settings.username} ${hash}`);
  const files: Artifact[] = backendFiles.map((name) => ({
    path: join(settings.quadlets, name),
    content: readFileSync(join(assets, name), "utf8"),
    mode: 0o644,
  }));
  const drop = (source: string, name: string, content: string) =>
    files.push({ path: join(`${source}.d`, name), content: managed + content, mode: 0o600 });
  drop(
    discovery.sources[0]!,
    "90-slk-logs.conf",
    `[Container]\nNetwork=slk-logs.network\nVolume=${settings.directory}/slk-victorialogs.yaml:${discovery.provision}/datasources/slk-victorialogs.yaml:ro,Z\n${pluginEnvironment(discovery.pluginEnv, discovery.syncList)}\n`,
  );
  drop(
    discovery.sources[1]!,
    "90-slk-logs.conf",
    `[Container]\nNetwork=slk-logs.network\n${caddyImage ? `Image=${caddyImage}\n` : ""}`,
  );
  files.push(
    {
      path: join(settings.directory, "slk-victorialogs.yaml"),
      content: readFileSync(join(assets, "grafana-datasource.yaml"), "utf8"),
      mode: 0o644,
    },
    {
      path: settings.caddyfile,
      content: mergeIngestion(currentCaddy, site, settings.hostname),
      mode: lstatSync(settings.caddyfile).mode & 0o777,
    },
    {
      path: join(settings.directory, "vector.env"),
      content: `# Copy to the application host as its private logging.env.\nSLK_LOG_ENDPOINT=https://${settings.hostname}/insert/jsonline\nSLK_LOG_USERNAME=${settings.username}\nSLK_LOG_PASSWORD_FILE=/root/.config/slk/victorialogs-password\nSLK_LOG_HOST=${settings.hostLabel}\nSLK_LOG_ENVIRONMENT=${settings.environment}\n`,
      mode: 0o600,
    },
  );
  return files;
}

function backendPreflight(settings: MonitoringSettings, run: MonitoringRun) {
  const names = run("podman", ["ps", "--all", "--format", "{{.Names}}"]).split("\n");
  const networks = run("podman", ["network", "ls", "--format", "{{.Name}}"]).split("\n");
  const volumes = run("podman", ["volume", "ls", "--format", "{{.Name}}"]).split("\n");
  const existing = names.includes("slk-victorialogs");
  let running = false;
  if (
    (existing || networks.includes("slk-logs") || volumes.includes("slk-victorialogs")) &&
    !backendFiles.every((name) => existsSync(join(settings.quadlets, name)))
  )
    throw new Error("Reserved logging resource collision; review the existing backend before adoption");
  if (existing) {
    const container = (JSON.parse(run("podman", ["inspect", "slk-victorialogs"])) as Container[])[0]!;
    if (container.Config.Labels.PODMAN_SYSTEMD_UNIT !== "slk-victorialogs.service")
      throw new Error("Existing backend is not the expected Quadlet");
    running = container.State.Running;
  }
  if (networks.includes("slk-logs")) {
    const network = JSON.parse(run("podman", ["network", "inspect", "slk-logs"])) as { internal: boolean }[];
    if (network[0]?.internal !== true) throw new Error("Existing slk-logs network is not internal");
  }
  return running;
}

export function caddyOverlayFile(baseImage: string, binaryImage: string) {
  if (!/^(?:sha256:)?[a-f0-9]{64}$/.test(baseImage) || !/^[a-zA-Z0-9/_.:-]+$/.test(binaryImage))
    throw new Error("Invalid Caddy overlay image reference");
  return `FROM ${binaryImage} AS logging_binary\nFROM ${baseImage.replace(/^sha256:/, "")}\nCOPY --from=logging_binary /usr/bin/caddy /usr/bin/caddy\nCOPY --from=logging_binary /usr/share/slk-caddy /usr/share/slk-caddy\n`;
}

function buildCaddy(discovery: Discovery, run: MonitoringRun, directory: string) {
  const candidate = "localhost/slk-monitoring-caddy-binary:2.11.9";
  run("podman", [
    "build",
    "--tag",
    candidate,
    "--file",
    join(repository, "caddy/Containerfile"),
    join(repository, "caddy"),
  ]);
  const modules = moduleNames(
    run("podman", [
      "run",
      "--rm",
      "--network",
      "none",
      "--cap-drop=ALL",
      "--entrypoint",
      "/usr/bin/caddy",
      candidate,
      "list-modules",
    ]),
  );
  if (!modules.has("http.handlers.rate_limit") || [...discovery.modules].some((name) => !modules.has(name)))
    throw new Error(
      "Built Caddy does not preserve every existing module; integrate custom modules in the reviewed build first",
    );
  const image = `localhost/slk-monitoring-caddy:logs-${createHash("sha256").update(discovery.caddy.Image).digest("hex").slice(0, 16)}`;
  const file = join(directory, "Containerfile");
  writeFileSync(file, caddyOverlayFile(discovery.caddy.Image, candidate), { mode: 0o600 });
  run("podman", ["build", "--tag", image, "--file", file, directory]);
  const id = run("podman", ["image", "inspect", "--format", "{{.Id}}", image]);
  if (!/^(?:sha256:)?[a-f0-9]{64}$/.test(id)) throw new Error("Invalid derived Caddy image ID");
  return id.startsWith("sha256:") ? id : `sha256:${id}`;
}

function validateCaddy(
  settings: MonitoringSettings,
  discovery: Discovery,
  text: string,
  run: MonitoringRun,
  temporary: string,
  image?: string,
) {
  if (!image || image.replace(/^sha256:/, "") === discovery.caddy.Image.replace(/^sha256:/, "")) {
    run(
      "podman",
      [
        "exec",
        "--interactive",
        "--workdir",
        dirname(settings.caddyfileInContainer),
        discovery.caddy.Id,
        "/usr/bin/caddy",
        "validate",
        "--config",
        "-",
        "--adapter",
        "caddyfile",
      ],
      text,
    );
  } else {
    const file = join(temporary, "caddy.env");
    if (discovery.caddy.Config.Env.some((value) => /[\r\n]/.test(value)))
      throw new Error("Multiline Caddy environment needs manual validation");
    writeFileSync(file, discovery.caddy.Config.Env.join("\n"), { mode: 0o600 });
    run(
      "podman",
      [
        "run",
        "--rm",
        "--interactive",
        "--network",
        "none",
        "--volumes-from",
        `${discovery.caddy.Id}:ro`,
        "--env-file",
        file,
        "--workdir",
        dirname(settings.caddyfileInContainer),
        "--entrypoint",
        "/usr/bin/caddy",
        image,
        "validate",
        "--config",
        "-",
        "--adapter",
        "caddyfile",
      ],
      text,
    );
  }
}

async function retry(check: () => Promise<void> | void, attempts = 30) {
  for (let n = 0; ; n++) {
    try {
      await check();
      return;
    } catch (error) {
      if (n >= attempts - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

export async function verifyMonitoring(settings: MonitoringSettings, run: MonitoringRun = execute) {
  const discovery = discoverMonitoring(settings, run);
  const backend = inspectContainer("slk-victorialogs.service", run);
  if (
    !backend.NetworkSettings.Networks["slk-logs"] ||
    Object.values(backend.NetworkSettings.Ports).some((value) => value !== null)
  )
    throw new Error("Backend private network/publication check failed");
  for (const container of [discovery.grafana, discovery.caddy])
    if (!container.NetworkSettings.Networks["slk-logs"])
      throw new Error("A monitoring client is missing the private network");
  run("podman", ["healthcheck", "run", backend.Id]);
  const mountedDatasource = run("podman", [
    "exec",
    discovery.grafana.Id,
    "/bin/cat",
    `${discovery.provision}/datasources/slk-victorialogs.yaml`,
  ]);
  if (mountedDatasource.trim() !== readFileSync(join(assets, "grafana-datasource.yaml"), "utf8").trim())
    throw new Error("Grafana datasource mount differs from the prepared configuration");
  const installed = run("podman", ["exec", discovery.grafana.Id, "grafana", "cli", "plugins", "ls"]);
  if (!installed.includes(`${plugin} @ ${pluginVersion}`))
    throw new Error("Pinned Grafana plugin is not installed yet");
  const response = await fetch(`https://${settings.hostname}/select/logsql/query`, {
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status !== 404) throw new Error("Public query endpoint was not denied");
  const unauthorized = await fetch(`https://${settings.hostname}/insert/jsonline`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  if (unauthorized.status !== 401) throw new Error("Ingestion did not require authentication");
}

export async function monitoringInstall(
  action: string,
  config: string,
  run: MonitoringRun = execute,
  notify = console.log,
  home = homedir(),
) {
  if (process.platform !== "linux") throw new Error("Monitoring installation requires Linux");
  if (!["plan", "install", "verify"].includes(action)) throw new Error("Expected plan, install or verify");
  const uid = process.getuid!();
  const settings = monitoringSettings(JSON.parse(privateHostFile(config, uid).toString("utf8")), home);
  if (action === "verify") {
    await verifyMonitoring(settings, run);
    notify("Monitoring connectivity, plugin, health and public boundary checks passed.");
    return;
  }
  assertWritableFile(settings.caddyfile, uid);
  outsideCheckout(settings.caddyfile);
  if (!existsSync(settings.caddyfile)) throw new Error("Existing Caddyfile not found");
  const discovery = discoverMonitoring(settings, run);
  const hadBackend = backendPreflight(settings, run);
  const currentCaddy = readFileSync(settings.caddyfile, "utf8");
  const placeholder = "$2a$14$" + "A".repeat(53);
  const plan = monitoringArtifacts(settings, discovery, placeholder, currentCaddy);
  if (new Set(plan.map((file) => file.path)).size !== plan.length) throw new Error("Installation paths overlap");
  for (const file of plan) {
    assertWritableFile(file.path, uid);
    outsideCheckout(file.path);
    if (
      file.path.endsWith("/90-slk-logs.conf") &&
      existsSync(file.path) &&
      !readFileSync(file.path, "utf8").startsWith(managed)
    )
      throw new Error(`Unmanaged drop-in collision: ${file.path}`);
  }
  for (const name of backendFiles) {
    const path = join(settings.quadlets, name);
    if (existsSync(path) && readFileSync(path, "utf8") !== readFileSync(join(assets, name), "utf8"))
      throw new Error(`Existing backend configuration differs: ${path}; reconcile in Git first`);
  }
  notify(`Scope: ${settings.scope}; units: ${settings.grafanaUnit}, ${settings.caddyUnit}`);
  notify(`Ingestion: https://${settings.hostname}/insert/jsonline; private backend: slk-victorialogs:9428`);
  notify(
    `Caddy binary build: ${discovery.needsBuild ? "required (existing modules checked before activation)" : "not required"}`,
  );
  notify(`Files: ${plan.map((file) => file.path).join(", ")}`);
  if (action === "plan") {
    notify("Plan only: no files, images or services changed. Installation restarts the three monitoring services.");
    return;
  }
  if (
    settings.scope === "user" &&
    run("loginctl", ["show-user", String(uid), "--property=Linger", "--value"]) !== "yes"
  )
    throw new Error("Rootless startup requires existing account linger; ask the host administrator to enable it first");
  safeParents(join(settings.directory, ".install.lock"), uid);
  mkdirSync(settings.directory, { recursive: true, mode: 0o700 });
  const state = lstatSync(settings.directory);
  if (!state.isDirectory() || state.isSymbolicLink() || state.uid !== uid || (state.mode & 0o077) !== 0)
    throw new Error("Installer state directory must belong to this user and have mode 0700");
  const lock = join(settings.directory, ".install.lock");
  const fd = openSync(lock, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  const temporary = mkdtempSync(join(tmpdir(), "slk-monitoring-"));
  const snapshots: Snapshot[] = [];
  let changed = false;
  try {
    writeFileSync(fd, `${process.pid}\n`);
    notify("Preparing pinned images and validating Caddy before service changes...");
    const currentDropIn = join(`${discovery.sources[1]!}.d`, "90-slk-logs.conf");
    const retainedImage = existsSync(currentDropIn)
      ? /^Image=(sha256:[a-f0-9]{64})$/m.exec(readFileSync(currentDropIn, "utf8"))?.[1]
      : undefined;
    const image = discovery.needsBuild ? buildCaddy(discovery, run, temporary) : retainedImage;
    const passwordPath = join(settings.directory, "vector-password");
    const hashPath = join(settings.directory, "ingestion.hash");
    if (!existsSync(passwordPath) && existsSync(hashPath))
      throw new Error("Password file is missing; refusing silent credential rotation");
    const password = existsSync(passwordPath)
      ? privateHostFile(passwordPath, uid).toString("utf8").replace(/\n$/, "")
      : randomBytes(36).toString("base64url");
    if (!/^[\x21-\x7e]{32,256}$/.test(password)) throw new Error("Invalid ingestion password file");
    const hash = existsSync(hashPath)
      ? privateHostFile(hashPath, uid).toString("utf8").trim()
      : run(
          "podman",
          image
            ? [
                "run",
                "--rm",
                "--interactive",
                "--network",
                "none",
                "--entrypoint",
                "/usr/bin/caddy",
                image,
                "hash-password",
              ]
            : ["exec", "--interactive", discovery.caddy.Id, "/usr/bin/caddy", "hash-password"],
          `${password}\n`,
        );
    const files = [
      ...monitoringArtifacts(settings, discovery, hash, currentCaddy, image),
      { path: passwordPath, content: `${password}\n`, mode: 0o600 },
      { path: hashPath, content: `${hash}\n`, mode: 0o600 },
    ];
    validateCaddy(
      settings,
      discovery,
      files.find((file) => file.path === settings.caddyfile)!.content,
      run,
      temporary,
      image,
    );
    const backendImage = /^Image=(.+)$/m.exec(readFileSync(join(assets, "slk-victorialogs.container"), "utf8"))![1]!;
    run("podman", ["pull", backendImage]);
    run("podman", ["pull", clientImage]);
    for (const file of files) {
      assertWritableFile(file.path, uid);
      snapshots.push({
        path: file.path,
        content: existsSync(file.path) ? readFileSync(file.path).toString("base64") : null,
        mode: existsSync(file.path) ? lstatSync(file.path).mode & 0o777 : file.mode,
      });
    }
    const backup = join(settings.directory, "backups", randomUUID());
    safeParents(join(backup, "manifest.json"), uid);
    mkdirSync(backup, { recursive: true, mode: 0o700 });
    writeFileSync(join(backup, "manifest.json"), JSON.stringify(snapshots, null, 2), { mode: 0o600 });
    notify(`Private rollback snapshot: ${backup}/manifest.json`);
    changed = true;
    for (const file of files) atomicWrite(file, uid);
    const generator = [
      "/usr/lib/systemd/system-generators/podman-system-generator",
      "/usr/libexec/podman/quadlet",
    ].find((path) => existsSync(path));
    if (!generator) throw new Error("Podman Quadlet generator not found");
    const generated = run(generator, [...(settings.scope === "user" ? ["--user"] : []), "--dryrun"]);
    if (!generated.includes("---slk-victorialogs.service---")) throw new Error("Backend Quadlet was not generated");
    const backendUnit = generated.split("---slk-victorialogs.service---")[1]?.split("---")[0] ?? "";
    if (/--publish|--network[= ]host/.test(backendUnit))
      throw new Error("Backend generation exposed an unexpected port/network");
    discovery.systemctl(["daemon-reload"]);
    for (const unit of ["slk-victorialogs.service", settings.grafanaUnit, settings.caddyUnit]) {
      notify(`Restarting ${unit}...`);
      discovery.systemctl(["restart", unit]);
    }
    notify("Waiting for signed plugin installation, TLS and ingestion boundary checks...");
    await retry(() => verifyMonitoring(settings, run));
    const canary = `slk-monitoring-install-${randomUUID()}`;
    const inserted = await fetch(`https://${settings.hostname}/insert/jsonline`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Basic ${Buffer.from(`${settings.username}:${password}`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: `${JSON.stringify({ message: canary, timestamp: new Date().toISOString(), project: "stadt-land-klima", service_name: "monitoring-installer" })}\n`,
    });
    if (!inserted.ok) throw new Error("Authenticated HTTPS canary insertion failed");
    const code = `const r=await fetch('http://slk-victorialogs:9428/select/logsql/query',{method:'POST',body:new URLSearchParams({query:JSON.stringify(${JSON.stringify(canary)})})});if(!r.ok||!(await r.text()).includes(${JSON.stringify(canary)}))process.exit(1);`;
    await retry(() => {
      run("podman", [
        "run",
        "--rm",
        "--network",
        "slk-logs",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--user",
        "1000:1000",
        clientImage,
        "node",
        "--input-type=module",
        "-e",
        code,
      ]);
    }, 10);
    notify(`Installed and verified. Application-host settings: ${settings.directory}/vector.env`);
    notify(`Transfer the private password file separately: ${passwordPath}. No password was printed.`);
  } catch (error) {
    if (changed) {
      let rollbackFailed = false;
      if (!hadBackend) {
        try {
          discovery.systemctl(["stop", "slk-victorialogs.service"]);
        } catch {
          rollbackFailed = true;
        }
      }
      for (const snapshot of [...snapshots].reverse()) {
        try {
          if (snapshot.content === null) rmSync(snapshot.path, { force: true });
          else
            atomicWrite(
              {
                path: snapshot.path,
                content: Buffer.from(snapshot.content, "base64").toString("utf8"),
                mode: snapshot.mode,
              },
              uid,
            );
        } catch {
          rollbackFailed = true;
        }
      }
      try {
        discovery.systemctl(["daemon-reload"]);
      } catch {
        rollbackFailed = true;
      }
      for (const unit of [
        ...(hadBackend ? ["slk-victorialogs.service"] : []),
        settings.grafanaUnit,
        settings.caddyUnit,
      ]) {
        try {
          discovery.systemctl(["restart", unit]);
        } catch {
          rollbackFailed = true;
        }
      }
      notify(
        rollbackFailed
          ? "Automatic rollback needs operator attention; use the private snapshot. Volumes were retained."
          : "Previous files and services restored. Backend volumes were retained.",
      );
    }
    throw error;
  } finally {
    closeSync(fd);
    rmSync(lock, { force: true });
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  const { values, positionals } = parseArgs({
    options: { config: { type: "string" } },
    allowPositionals: true,
    strict: true,
  });
  try {
    await monitoringInstall(positionals[0] ?? "", values.config ?? "");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Monitoring installation failed");
    process.exitCode = 1;
  }
}
