import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  caddyOverlayFile,
  configuredPluginEnvironment,
  discoverMonitoring,
  mergeIngestion,
  monitoringArtifacts,
  monitoringInstall,
  monitoringSettings,
  pluginEnvironment,
  quadletQuote,
  type MonitoringRun,
} from "./monitoring-install.ts";

const root = resolve(import.meta.dirname, "../..");
const fixtureHash = "$2a$14$" + "A".repeat(53);
const uid = process.getuid!();
const originalCaddy = "{\n admin off\n}\nmonitoring.example.test {\n reverse_proxy grafana:3000\n}\n";

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "slk-monitoring-install-"));
  const fields = {
    scope: "user",
    grafanaUnit: "grafana.service",
    caddyUnit: "caddy.service",
    hostname: "logs.example.test",
    caddyfile: join(directory, "caddy/Caddyfile"),
    directory: join(directory, "state"),
  };
  // These tests use a private temporary home argument, never change HOME or touch real units.
  const settings = monitoringSettings(fields, directory, 1000);
  mkdirSync(settings.quadlets, { recursive: true, mode: 0o700 });
  mkdirSync(join(directory, "caddy"), { mode: 0o700 });
  writeFileSync(fields.caddyfile, originalCaddy, { mode: 0o640 });
  chmodSync(fields.caddyfile, 0o640);
  for (const name of ["grafana", "caddy"])
    writeFileSync(join(settings.quadlets, `${name}.container`), `[Container]\nImage=fixture\nNetwork=existing\n`, {
      mode: 0o644,
    });
  const config = join(directory, "install.json");
  writeFileSync(config, JSON.stringify(fields), { mode: 0o600 });
  const calls: { tool: string; args: string[]; input?: string }[] = [];
  let restarted = false;
  let needsBuild = false;
  let failRestart = false;
  let extraModule = false;
  let datasourceCollision = false;
  const container = (name: string, id: string) => ({
    Id: id,
    Image: "sha256:" + "a".repeat(64),
    Name: name,
    State: { Running: true },
    Config: {
      Env: ["GF_PLUGINS_PREINSTALL_SYNC=existing-plugin@1.0.0", "GF_PATHS_PROVISIONING=/etc/grafana/provisioning"],
      Labels: { PODMAN_SYSTEMD_UNIT: `${name}.service` },
      User: "1000",
    },
    Mounts: name === "caddy" ? [{ Type: "bind", Source: dirnameCaddy(), Destination: "/etc/caddy" }] : [],
    NetworkSettings: {
      Networks: restarted || name === "slk-victorialogs" ? { existing: {}, "slk-logs": {} } : { existing: {} },
      Ports: { "9428/tcp": null },
    },
  });
  const dirnameCaddy = () => join(directory, "caddy");
  const run: MonitoringRun = (tool, args, input) => {
    calls.push({ tool, args, ...(input === undefined ? {} : { input }) });
    if (tool === "loginctl") return "yes";
    if (tool === "systemctl") {
      if (args.includes("show"))
        return join(
          settings.quadlets,
          args.find((arg) => arg.endsWith(".service"))!.replace(/\.service$/, ".container"),
        );
      if (args.includes("restart")) {
        restarted = true;
        if (failRestart && args.includes("caddy.service")) {
          failRestart = false;
          throw new Error("restart failed");
        }
      }
      return "";
    }
    if (tool.includes("podman-system-generator") || tool.endsWith("/quadlet"))
      return "---slk-victorialogs.service---\nExecStart=podman run --network slk-logs\n";
    assert.equal(tool, "podman");
    if (args[0] === "info") return "v2";
    if (args[0] === "ps" && args.includes("--filter")) {
      const label = args.find((arg) => arg.startsWith("label="))!;
      return label.includes("grafana")
        ? "1".repeat(12)
        : label.includes("slk-victorialogs")
          ? "3".repeat(12)
          : "2".repeat(12);
    }
    if (args[0] === "ps") return restarted ? "slk-victorialogs" : "";
    if ((args[0] === "network" && args[1] === "ls") || (args[0] === "volume" && args[1] === "ls")) return "";
    if (args[0] === "image") return "sha256:" + "b".repeat(64);
    if (args[0] === "inspect")
      return JSON.stringify([
        container(
          args[1]!.startsWith("1") ? "grafana" : args[1]!.startsWith("2") ? "caddy" : "slk-victorialogs",
          args[1]!.startsWith("slk") ? "3".repeat(12) : args[1]!,
        ),
      ]);
    if (args[0] === "exec" && args.includes("-v")) return "grafana version 13.3.0";
    if (args.includes("/bin/cat") && args.at(-1)!.endsWith("slk-victorialogs.yaml"))
      return readFileSync(join(root, "podman/logging/monitoring/grafana-datasource.yaml"), "utf8");
    if (args.includes("/bin/cat"))
      return args.at(-1)!.endsWith("defaults.ini")
        ? "[plugins]\npreinstall_sync =\n"
        : "[plugins]\npreinstall = ini-plugin@2.0.0\n";
    if (args.includes("/bin/sh")) return datasourceCollision ? "/etc/grafana/provisioning/datasources/other.yaml" : "";
    if (args.includes("list-modules"))
      return (
        "http.handlers.reverse_proxy\n" +
        (args[0] === "run" || !needsBuild || restarted ? "http.handlers.rate_limit\n" : "") +
        (extraModule && args[0] === "exec" ? "dns.providers.custom\n" : "")
      );
    if (args.includes("hash-password")) return fixtureHash;
    if (args.includes("plugins") && args.includes("ls"))
      return "installed plugins:\nvictoriametrics-logs-datasource @ 0.33.1";
    return "";
  };
  return {
    directory,
    fields,
    config,
    settings,
    calls,
    run,
    setBuild: () => {
      needsBuild = true;
    },
    setRestartFailure: () => {
      failRestart = true;
    },
    setExtraModule: () => {
      extraModule = true;
    },
    setDatasourceCollision: () => {
      datasourceCollision = true;
    },
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("monitoring configuration rejects scope mistakes, unsafe paths, template hosts, labels and unknown settings", () => {
  const base = {
    scope: "user",
    grafanaUnit: "grafana.service",
    caddyUnit: "caddy.service",
    hostname: "logs.example.test",
    caddyfile: "/home/deploy/caddy/Caddyfile",
  };
  assert.equal(monitoringSettings(base, "/home/deploy", 1000).quadlets, "/home/deploy/.config/containers/systemd");
  assert.equal(monitoringSettings({ ...base, scope: "system" }, "/root", 0).quadlets, "/etc/containers/systemd");
  for (const extra of [
    { scope: "system" },
    { hostname: "logs.{env}.test" },
    { hostname: "a.test:443" },
    { caddyfile: "/home/deploy/%h/Caddyfile" },
    { username: "user\nroot" },
    { grafanaUnit: "--all" },
    { caddyUnit: "grafana.service" },
    { buildCaddyIfNeeded: "false" },
    { password: "never-accept-inline-passwords" },
  ])
    assert.throws(() => monitoringSettings({ ...base, ...extra }, "/home/deploy", 1000));
});

test("managed Caddy merge preserves existing sites, is idempotent and rejects duplicates or broken markers", () => {
  const merged = mergeIngestion(originalCaddy, "logs.example.test { respond 404 }", "logs.example.test");
  assert.ok(merged.startsWith(originalCaddy));
  assert.equal(mergeIngestion(merged, "logs.example.test { respond 404 }", "logs.example.test"), merged);
  assert.throws(() =>
    mergeIngestion(merged.replace("# END SLK CENTRAL LOGGING — managed", ""), "site", "logs.example.test"),
  );
  assert.throws(() => mergeIngestion("logs.example.test { respond 200 }", "site", "logs.example.test"));
});

test("plugin merge preserves INI/environment lists, pins only VictoriaLogs and quotes literal specifiers", () => {
  const env = configuredPluginEnvironment(
    ["GF_PLUGINS_PREINSTALL=environment-plugin@1"],
    "[plugins]\npreinstall = hidden@1\npreinstall_sync = ini-plugin@2\n",
  );
  const merged = pluginEnvironment([
    ...env,
    "GF_INSTALL_PLUGINS=legacy-plugin 2,victoriametrics-logs-datasource 0.1",
    "GF_PLUGINS_PREINSTALL_SYNC=ini-plugin@2,victoriametrics-logs-datasource@0.1",
  ]);
  assert.match(merged, /ini-plugin@2,victoriametrics-logs-datasource@0.33.1/);
  assert.match(merged, /environment-plugin@1/);
  assert.match(merged, /legacy-plugin 2/);
  assert.doesNotMatch(merged, /hidden@1|datasource@0.1|datasource 0.1/);
  assert.throws(() => pluginEnvironment(["GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=victoriametrics-logs-datasource"]));
  assert.throws(() => configuredPluginEnvironment([], "[plugins]\npreinstall = $__file{/secret}\n"));
  const legacy = pluginEnvironment(configuredPluginEnvironment([], '[plugins]\npreinstall = "legacy@2"\n'), false);
  assert.match(legacy, /GF_PLUGINS_PREINSTALL=legacy@2,victoriametrics-logs-datasource@0.33.1/);
  assert.match(legacy, /GF_PLUGINS_PREINSTALL_ASYNC=false/);
  assert.throws(() => pluginEnvironment(["GF_PLUGINS_PREINSTALL_DISABLED=true"]));
  assert.equal(quadletQuote('KEY=https://example.test/a%20b?x="a"'), '"KEY=https://example.test/a%%20b?x=\\"a\\""');
  assert.throws(() => quadletQuote("KEY=a\nNetwork=host"));
});

test(
  "plan is read-only and rejects provisioning collisions and unsafe destination symlinks",
  { skip: uid === 0 },
  async () => {
    const f = fixture();
    try {
      const output: string[] = [];
      await monitoringInstall("plan", f.config, f.run, (value) => output.push(value), f.directory);
      assert.equal(existsSync(f.settings.directory), false);
      assert.equal(readFileSync(f.settings.caddyfile, "utf8"), originalCaddy);
      assert.equal(
        f.calls.some((call) => ["build", "pull", "restart", "hash-password"].some((arg) => call.args.includes(arg))),
        false,
      );
      assert.ok(output.some((line) => line.includes("Plan only")));
      f.setDatasourceCollision();
      await assert.rejects(
        monitoringInstall("plan", f.config, f.run, () => {}, f.directory),
        /reserved datasource/,
      );
    } finally {
      f.cleanup();
    }
    const linked = fixture();
    try {
      symlinkSync("missing", join(linked.settings.quadlets, "slk-logs.network"));
      await assert.rejects(
        monitoringInstall("plan", linked.config, linked.run, () => {}, linked.directory),
        /Unsafe installation link/,
      );
      chmodSync(linked.config, 0o644);
      await assert.rejects(
        monitoringInstall("plan", linked.config, linked.run, () => {}, linked.directory),
        /owner-only/,
      );
    } finally {
      linked.cleanup();
    }
  },
);

test(
  "installer generates private credentials, validates before activation, preserves config and reuses image/password on rerun",
  { skip: uid === 0 },
  async (t) => {
    const f = fixture();
    f.setBuild();
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string | URL | Request, options?: RequestInit) => {
      requests.push(String(url));
      return new Response("", { status: String(url).includes("/select/") ? 404 : options?.headers ? 200 : 401 });
    });
    try {
      const messages: string[] = [];
      await monitoringInstall("install", f.config, f.run, (value) => messages.push(value), f.directory);
      const passwordPath = join(f.settings.directory, "vector-password");
      const password = readFileSync(passwordPath, "utf8");
      assert.match(password, /^[a-zA-Z0-9_-]{48}\n$/);
      assert.equal(lstatSync(passwordPath).mode & 0o777, 0o600);
      assert.equal(lstatSync(f.settings.directory).mode & 0o777, 0o700);
      assert.equal(messages.join(" ").includes(password.trim()), false);
      assert.equal(
        f.calls.some((call) => call.args.some((arg) => arg.includes(password.trim()))),
        false,
      );
      const validation = f.calls.findIndex((call) => call.args.includes("validate"));
      const activation = f.calls.findIndex((call) => call.args.includes("restart"));
      assert.ok(validation >= 0 && validation < activation);
      assert.ok(readFileSync(f.settings.caddyfile, "utf8").startsWith(originalCaddy));
      const grafanaDropIn = readFileSync(join(f.settings.quadlets, "grafana.container.d/90-slk-logs.conf"), "utf8");
      assert.match(grafanaDropIn, /existing-plugin@1.0.0,victoriametrics-logs-datasource@0.33.1/);
      assert.match(grafanaDropIn, /ini-plugin@2.0.0/);
      assert.ok(requests.some((url) => url.endsWith("/insert/jsonline")));
      const dropIn = join(f.settings.quadlets, "caddy.container.d/90-slk-logs.conf");
      assert.match(readFileSync(dropIn, "utf8"), new RegExp(`Image=sha256:${"b".repeat(64)}`));
      await monitoringInstall("install", f.config, f.run, () => {}, f.directory);
      assert.equal(readFileSync(passwordPath, "utf8"), password);
      assert.match(readFileSync(dropIn, "utf8"), /Image=sha256:/);
      assert.equal(f.calls.filter((call) => call.args.includes("hash-password")).length, 1);
      assert.equal(readdirSync(join(f.settings.directory, "backups")).length, 2);
      assert.equal(existsSync(join(f.settings.directory, ".install.lock")), false);
    } finally {
      f.cleanup();
    }
  },
);

test(
  "failed Caddy restart restores exact original files, restarts prior services and retains volumes",
  { skip: uid === 0 },
  async () => {
    const f = fixture();
    f.setRestartFailure();
    try {
      const messages: string[] = [];
      await assert.rejects(
        monitoringInstall("install", f.config, f.run, (value) => messages.push(value), f.directory),
        /restart failed/,
      );
      assert.equal(readFileSync(f.settings.caddyfile, "utf8"), originalCaddy);
      assert.equal(lstatSync(f.settings.caddyfile).mode & 0o777, 0o640);
      assert.equal(existsSync(join(f.settings.quadlets, "slk-victorialogs.container")), false);
      assert.equal(existsSync(join(f.settings.directory, "vector-password")), false);
      assert.ok(messages.some((line) => line.includes("Previous files and services restored")));
      assert.equal(
        f.calls.filter((call) => call.args.includes("restart") && call.args.includes("caddy.service")).length,
        2,
      );
      assert.equal(
        f.calls.some((call) => call.args[0] === "volume" && call.args.includes("rm")),
        false,
      );
      assert.equal(
        f.calls.some((call) => call.args.includes("prune")),
        false,
      );
    } finally {
      f.cleanup();
    }
  },
);

test("module loss aborts a Caddy build before config or services change", { skip: uid === 0 }, async () => {
  const f = fixture();
  f.setBuild();
  f.setExtraModule();
  try {
    await assert.rejects(
      monitoringInstall("install", f.config, f.run, () => {}, f.directory),
      /preserve every existing module/,
    );
    assert.equal(readFileSync(f.settings.caddyfile, "utf8"), originalCaddy);
    assert.equal(
      f.calls.some((call) => call.args.includes("restart")),
      false,
    );
  } finally {
    f.cleanup();
  }
});

test(
  "real Caddy accepts the generated merged site and real Quadlet merges its plugin/network drop-ins",
  { skip: !process.env.SLK_TEST_CADDY_IMAGE || uid === 0 },
  () => {
    const f = fixture();
    try {
      const discovery = discoverMonitoring(f.settings, f.run);
      const files = monitoringArtifacts(f.settings, discovery, fixtureHash, originalCaddy);
      const caddy = files.find((file) => file.path === f.settings.caddyfile)!.content;
      execFileSync(
        "podman",
        [
          "run",
          "--rm",
          "--interactive",
          "--network",
          "none",
          "--tmpfs",
          "/config:rw,mode=1777",
          "--tmpfs",
          "/data:rw,mode=1777",
          "--entrypoint",
          "/usr/bin/caddy",
          process.env.SLK_TEST_CADDY_IMAGE!,
          "validate",
          "--config",
          "-",
          "--adapter",
          "caddyfile",
        ],
        { input: caddy, stdio: ["pipe", "pipe", "pipe"] },
      );
      for (const file of files.filter((file) => file.path.startsWith(f.settings.quadlets + "/"))) {
        mkdirSync(resolve(file.path, ".."), { recursive: true });
        writeFileSync(file.path, file.content);
      }
      const output = execFileSync(
        "/usr/lib/systemd/system-generators/podman-system-generator",
        ["--user", "--dryrun"],
        {
          encoding: "utf8",
          env: { ...process.env, QUADLET_UNIT_DIRS: f.settings.quadlets },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      assert.match(output, /--network existing/);
      assert.match(output, /--network slk-logs/);
      assert.match(output, /GF_PLUGINS_PREINSTALL_SYNC=existing-plugin@1.0.0,victoriametrics-logs-datasource@0.33.1/);
    } finally {
      f.cleanup();
    }
  },
);

test(
  "real Caddy binary overlay preserves the base image runtime settings",
  { skip: !process.env.SLK_TEST_CADDY_IMAGE },
  () => {
    const directory = mkdtempSync(join(tmpdir(), "slk-caddy-overlay-"));
    const name = `localhost/slk-caddy-overlay-test:${randomUUID()}`;
    const podman = (...args: string[]) =>
      execFileSync("podman", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    let built = false;
    try {
      const original = JSON.parse(podman("image", "inspect", process.env.SLK_TEST_CADDY_IMAGE!))[0];
      writeFileSync(join(directory, "Containerfile"), caddyOverlayFile(original.Id, process.env.SLK_TEST_CADDY_IMAGE!));
      podman("build", "--tag", name, "--file", join(directory, "Containerfile"), directory);
      built = true;
      const derived = JSON.parse(podman("image", "inspect", name))[0];
      for (const key of ["User", "Entrypoint", "Cmd", "Env", "WorkingDir", "ExposedPorts", "Volumes"])
        assert.deepEqual(derived.Config[key], original.Config[key], key);
      assert.match(
        podman("run", "--rm", "--network", "none", "--entrypoint", "/usr/bin/caddy", name, "list-modules"),
        /http.handlers.rate_limit/,
      );
    } finally {
      if (built) podman("rmi", name);
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
