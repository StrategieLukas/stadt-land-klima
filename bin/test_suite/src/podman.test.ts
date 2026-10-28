import assert from "node:assert/strict";
import {
  symlinkSync,
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { test } from "node:test";
import {
  assertPodmanContainer,
  assertPodmanHost,
  assertSeccompProfile,
  assertPrivatePodmanFile,
  hardenedPodmanSeccomp,
  blockedPodmanSyscalls,
  podmanServices,
} from "../../lib/podman-security.js";
import {
  podmanSecretPlan,
  managedPodmanEnvironment,
  managedPodmanProductionEnvironment,
} from "../../lib/podman-secrets.js";
import { assertReleasePolicy } from "./lib/releasePolicy.js";

const require = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
const yaml = require("yaml") as { parse: (value: string, options: { merge: true }) => Record<string, any> };
const parse = (value: string) => yaml.parse(value, { merge: true });
const read = (file: string) => readFileSync(new URL("../../../" + file, import.meta.url), "utf8");
const base = parse(read("podman-compose.yaml"));
const production = parse(read("podman-compose.prod.yaml"));
const development = parse(read("podman-compose.dev.yaml"));
const docker = parse(read("docker-compose.yaml"));
const dockerProduction = parse(read("docker-compose.prod.yaml"));

function host() {
  return {
    version: { Version: "5.4.2" },
    host: {
      arch: "amd64",
      networkBackend: "netavark",
      cgroupVersion: "v2",
      cgroupControllers: ["memory", "pids"],
      security: {
        rootless: true,
        seccompEnabled: true,
        apparmorEnabled: true,
        seccompProfilePath: "/usr/share/containers/seccomp.json",
      },
    },
  };
}
function container() {
  return [
    {
      Config: { User: "1000:1000" },
      HostConfig: {
        Privileged: false,
        ReadonlyRootfs: true,
        Memory: 1024,
        PidsLimit: 64,
        CapAdd: [],
        SecurityOpt: ["no-new-privileges", "seccomp=/usr/share/containers/seccomp.json"],
      },
      Mounts: [{ Type: "volume", Destination: "/frontend/.output", RW: false }],
    },
  ];
}

test("Podman production retains all pinned Directus, logging and private listener controls", () => {
  assertReleasePolicy(base, production);
  for (const service of ["db", "cache", "meilisearch"]) {
    assert.equal(
      base.services[service].image.replace(/^docker.io\/(?:library\/)?/, ""),
      docker.services[service].image,
    );
    assert.equal(base.services[service].ports, undefined);
  }
  for (const [key, value] of Object.entries(docker.services.directus.environment))
    assert.equal(base.services.directus.environment[key], value, key);
  for (const [key, value] of Object.entries(dockerProduction.services.directus.environment))
    assert.equal(production.services.directus.environment[key], value, key);
  assert.equal(production.services.directus.environment.SLK_STARTUP_SECURITY_CHECKS, "true");
  assert.deepEqual(production.services.frontend.environment, dockerProduction.services.frontend.environment);
  assert.equal(production.services.meilisearch.environment.MEILI_ENV, "production");
});

test("all Podman runtimes are non-root, capless, read-only, seccomp confined and bounded", () => {
  assert.deepEqual(
    Object.keys(base.services)
      .filter((name) => name !== "frontend-build")
      .sort(),
    [...podmanServices].sort(),
  );
  for (const [name, service] of Object.entries(base.services) as [string, Record<string, any>][]) {
    assert.match(service.user, /^[1-9]\d*:[1-9]\d*$/);
    assert.match(service.userns_mode, /^keep-id:uid=\d+,gid=\d+$/);
    assert.deepEqual(service.cap_drop, ["ALL"]);
    assert.equal(service.cap_add, undefined);
    assert.equal(service.read_only, name !== "frontend-build");
    assert.equal(service.privileged, undefined);
    assert.ok(service.security_opt.includes("no-new-privileges"));
    assert.ok(service.security_opt.some((value: string) => value.startsWith("seccomp=${SLK_PODMAN_SECCOMP:?")));
    assert.ok(!/unconfined|label=disable/.test(service.security_opt.join(" ")));
    assert.ok(service.mem_limit, name);
    assert.ok(service.pids_limit > 0, name);
    assert.equal(service.logging.driver, "journald");
    for (const mount of service.volumes ?? []) {
      assert.doesNotMatch(mount, /\.sock|docker\/data|core-storage/);
      if (mount.startsWith("./")) {
        assert.match(mount, /:ro,z$/);
        assert.doesNotMatch(mount, /:.*(?:\bU\b|\bZ\b)/);
      }
    }
    for (const mount of service.tmpfs) assert.match(mount, /nosuid,nodev,noexec,size=/);
  }
  assert.equal(base.networks.database.internal, true);
  assert.equal(base.networks.services.internal, true);
  assert.deepEqual(base.services.db.networks, ["database"]);
  assert.deepEqual(base.services.cache.networks, ["services"]);
  assert.deepEqual(base.services.meilisearch.networks, ["services"]);
  assert.ok(!base.services.frontend.networks.includes("database"));
  assert.deepEqual(base.services.maintenance.profiles, ["maintenance"]);
  assert.deepEqual(base.volumes.database, {});
  assert.deepEqual(base.volumes.search, {});
});

test("only the disposable frontend builder relaxes rootfs writes; runtime code never installs packages", () => {
  const builder = base.services["frontend-build"];
  assert.deepEqual(builder.profiles, ["build"]);
  assert.equal(builder.read_only, false);
  assert.equal(builder.ports, undefined);
  assert.deepEqual(builder.depends_on, {});
  assert.deepEqual(production.services["frontend-build"].environment, production.services.frontend.environment);
  assert.match(builder.command.join(" "), /npm ci.*npm run build.*productionOutput.mts stamp/);
  assert.doesNotMatch(base.services.frontend.command.join(" "), /npm|build/);
  assert.match(base.services.frontend.command.join(" "), /productionOutput.mts verify/);
  assert.doesNotMatch(base.services.directus.command.join(" "), /npm ci/);
  assert.match(read("podman/directus/Containerfile"), /FROM localhost\/slk-podman-directus-runtime:local/);
  assert.match(read("podman/directus/Containerfile"), /npm --prefix "\$extension" run build/);
  assert.match(read("podman/directus/Containerfile"), /npm prune.*--omit=dev/);
  assert.match(read("docker/directus/Dockerfile"), /FROM directus\/directus:11\.17\.4\n/);
  assert.match(read(".containerignore"), /\*\*\/\.env\n/);
  assert.match(read(".containerignore"), /src\/directus\/uploads/);
  for (const service of Object.values(development.services) as Record<string, any>[])
    for (const port of service.ports ?? []) assert.match(port, /^127\.0\.0\.1:/);
});

test("host preflight fails closed for rootful, unconfined, legacy or undelegated Podman", () => {
  assert.equal(assertPodmanHost(host()), "/usr/share/containers/seccomp.json");
  for (const drift of [
    { security: { rootless: false } },
    { security: { seccompEnabled: false } },
    { security: { apparmorEnabled: false } },
    { security: { seccompProfilePath: "unconfined" } },
    { security: { seccompProfilePath: "/tmp/profile\r\n.json" } },
    { cgroupVersion: "v1" },
    { cgroupControllers: ["memory"] },
    { networkBackend: "cni" },
  ]) {
    const value = host();
    const { security, ...rest } = drift;
    Object.assign(value.host, rest);
    Object.assign(value.host.security, security);
    assert.throws(() => assertPodmanHost(value));
  }
  const future = host();
  future.version.Version = "10.0.0";
  assert.doesNotThrow(() => assertPodmanHost(future));
  const old = host();
  old.version.Version = "4.9.3";
  assert.throws(() => assertPodmanHost(old), /5.4/);
  assert.throws(() => assertPodmanHost(null));
});

test("seccomp selection rejects allow-default, disabled and empty profiles", () => {
  const profile = {
    defaultAction: "SCMP_ACT_ERRNO",
    syscalls: [{ action: "SCMP_ACT_ALLOW", names: ["read", "write", "clone"] }],
  };
  assert.doesNotThrow(() => assertSeccompProfile(profile));
  for (const value of [null, {}, { ...profile, defaultAction: "SCMP_ACT_ALLOW" }, { ...profile, syscalls: [] }])
    assert.throws(() => assertSeccompProfile(value));
});

test("production audit rejects permission drift and unexpected writable mounts without logging inspect secrets", () => {
  assert.doesNotThrow(() => assertPodmanContainer(container(), "frontend"));
  for (const drift of [
    { Privileged: true },
    { ReadonlyRootfs: false },
    { Memory: 0 },
    { PidsLimit: -1 },
    { NetworkMode: "host" },
    { PidMode: "host" },
    { IpcMode: "host" },
    { CapAdd: ["SYS_ADMIN"] },
    { SecurityOpt: ["seccomp=unconfined"] },
    { SecurityOpt: ["no-new-privileges", "seccomp=/safe", "label=disable"] },
  ]) {
    const value = container();
    Object.assign(value[0]!.HostConfig, drift);
    assert.throws(() => assertPodmanContainer(value, "frontend"));
  }
  const root = container();
  root[0]!.Config.User = "0:0";
  assert.throws(() => assertPodmanContainer(root, "frontend"), /user/);
  for (const mount of [
    { Type: "bind", Destination: "/source", RW: true },
    { Type: "bind", Destination: "/run/podman/podman.sock", RW: false },
    { Type: "volume", Destination: "/frontend/.output", RW: true },
  ]) {
    const value = container();
    value[0]!.Mounts = [mount];
    assert.throws(() => assertPodmanContainer(value, "frontend"));
  }
  const wrapper = read("bin/podman.sh");
  assert.match(wrapper, /--in-pod=false/);
  assert.match(wrapper, /--podman-args=--remote=false/);
  assert.doesNotMatch(wrapper, /\bpodman (?:build|ps|inspect|exec) /);
  assert.match(wrapper, /frontend_stopped\n/);
  assert.match(wrapper, /\^Seccomp:/);
  assert.match(wrapper, /\^CapBnd:/);
  assert.doesNotMatch(wrapper, /logs --tail|down -v|chmod 777|prune -[af]/);
  assert.ok(wrapper.indexOf("production audit") < wrapper.lastIndexOf("stop maintenance"));
});

test("derived seccomp blocks namespace creation and kernel attack surfaces while preserving threads and libc fallback", () => {
  const upstream = {
    defaultAction: "SCMP_ACT_ERRNO",
    syscalls: [
      { names: ["read", "write", "clone", "clone3", "unshare", "io_uring_setup"], action: "SCMP_ACT_ALLOW" },
      { names: ["bpf"], action: "SCMP_ACT_ALLOW", includes: { caps: ["CAP_SYS_ADMIN"] } },
    ],
  };
  const profile = hardenedPodmanSeccomp(upstream);
  assert.equal(upstream.syscalls[0]!.names.includes("unshare"), true);
  const rules = profile.syscalls as {
    names: string[];
    action: string;
    errnoRet?: number;
    args?: { index: number; value: number; valueTwo: number; op: string }[];
  }[];
  const syscall = (name: string) => rules.filter((rule) => rule.names.includes(name));
  for (const name of blockedPodmanSyscalls) {
    assert.equal(syscall(name).length, 1);
    assert.equal(syscall(name)[0]!.action, "SCMP_ACT_ERRNO");
    assert.equal(syscall(name)[0]!.errnoRet, 1);
  }
  for (const name of ["clone3", "io_uring_setup", "io_uring_enter", "io_uring_register"])
    assert.equal(syscall(name)[0]!.errnoRet, 38);
  assert.equal(syscall("read")[0]!.action, "SCMP_ACT_ALLOW");
  assert.equal(syscall("clone").length, 1);
  const flags = syscall("clone")[0]!.args![0]!;
  assert.equal(flags.op, "SCMP_CMP_MASKED_EQ");
  assert.equal(flags.index, 0);
  assert.equal(0x3d0f00 & flags.value, 0, "pthread flags must work");
  for (const namespace of [0x80, 0x20000, 0x2000000, 0x4000000, 0x8000000, 0x10000000, 0x20000000, 0x40000000])
    assert.notEqual(namespace & flags.value, 0, "nested namespace must be blocked");
});

test("private environment files cannot expose credentials through shared modes or symlinks", () => {
  const stat = { isFile: () => true, mode: 0o100600, uid: 1000 };
  assert.doesNotThrow(() => assertPrivatePodmanFile(stat, 1000));
  for (const drift of [{ mode: 0o100644 }, { mode: 0o100700 }, { mode: 0o100660 }, { uid: 0 }, { isFile: () => false }])
    assert.throws(() => assertPrivatePodmanFile({ ...stat, ...drift }, 1000));
});

function wrapperFixture(t: { after: (callback: () => void) => void }) {
  const directory = mkdtempSync(join(tmpdir(), "slk-podman-wrapper-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const folder of [
    "bin/lib",
    "tools",
    "runtime",
    "docker/db",
    "docker/meilisearch",
    "src/directus/cli",
    "src/frontend",
  ])
    mkdirSync(join(directory, folder), { recursive: true, mode: 0o700 });
  for (const file of [
    "bin/podman.sh",
    "bin/lib/podman-security.ts",
    "bin/lib/podman-secrets.ts",
    "bin/lib/package.json",
    "src/directus/cli/package.json",
  ])
    copyFileSync(fileURLToPath(new URL("../../../" + file, import.meta.url)), join(directory, file));
  for (const file of ["docker/db/.env", "docker/meilisearch/.env", "src/directus/.env", "src/frontend/.env"])
    writeFileSync(join(directory, file), "PROBE=not-a-credential\n", { mode: 0o600 });
  symlinkSync(
    fileURLToPath(new URL("../../../src/directus/cli/node_modules", import.meta.url)),
    join(directory, "src/directus/cli/node_modules"),
    "dir",
  );
  const profile = join(directory, "seccomp.json");
  writeFileSync(
    profile,
    JSON.stringify({
      defaultAction: "SCMP_ACT_ERRNO",
      syscalls: [{ names: ["read", "write"], action: "SCMP_ACT_ALLOW" }],
    }),
    { mode: 0o600 },
  );
  const info = host();
  info.host.security.seccompProfilePath = profile;
  writeFileSync(join(directory, "host.json"), JSON.stringify(info));
  const tools: Record<string, string> = {
    podman: `#!/bin/sh
printf '%s\n' "$*" >> "$PROBE_ROOT/engine-calls"
case "$*" in
 *secret*inspect*) exit 1 ;;
 *secret*create*) cat >> "$PROBE_ROOT/secret-input"; exit 0 ;;
 *info*) cat "$PROBE_ROOT/host.json" ;;
 *" ps "*) if [ "$PROBE_RUNNING" = yes ]; then echo active-frontend; fi ;;
esac
`,
    "podman-compose": `#!/bin/sh
case "$*" in *--version*) echo 'podman-compose version 1.5.0'; exit 0 ;; esac
printf '%s\n' "$*" >> "$PROBE_ROOT/calls"
case "$*" in *import-all.sh*) exit 23 ;; esac
`,
    curl: "#!/bin/sh\nexit 0\n",
  };
  for (const [name, code] of Object.entries(tools)) {
    writeFileSync(join(directory, "tools", name), code);
    chmodSync(join(directory, "tools", name), 0o700);
  }
  writeFileSync(join(directory, "calls"), "");
  writeFileSync(join(directory, "engine-calls"), "");
  writeFileSync(join(directory, "secret-input"), "");
  const invoke = (args: string[], running = "no") =>
    spawnSync("bash", ["bin/podman.sh", "production", ...args], {
      cwd: directory,
      encoding: "utf8",
      timeout: 20_000,
      env: {
        ...process.env,
        PATH: join(directory, "tools") + ":" + process.env.PATH,
        PROBE_ROOT: directory,
        PROBE_RUNNING: running,
        XDG_RUNTIME_DIR: join(directory, "runtime"),
        XDG_STATE_HOME: join(directory, "state"),
        SLK_PODMAN_PROJECT: "slk-test",
        SLK_PODMAN_TAG: "local",
        SLK_PODMAN_WEB_PORT: "9000",
        SLK_PODMAN_CMS_PORT: "9001",
        SLK_PODMAN_MAINTENANCE_PORT: "9090",
        CONTAINER_HOST: "",
        CONTAINER_CONNECTION: "",
        SLK_PODMAN_DB_ENV_FILE: "",
        SLK_PODMAN_MEILI_ENV_FILE: "",
        SLK_PODMAN_DIRECTUS_ENV_FILE: "",
        SLK_PODMAN_FRONTEND_ENV_FILE: "",
      },
    });
  return {
    invoke,
    calls: () => readFileSync(join(directory, "calls"), "utf8"),
    engineCalls: () => readFileSync(join(directory, "engine-calls"), "utf8"),
    secretInput: () => readFileSync(join(directory, "secret-input"), "utf8"),
  };
}

test("failed Podman imports leave maintenance active and never prepare or restart the frontend", (t) => {
  const fixture = wrapperFixture(t);
  const result = fixture.invoke(["start", "--import"]);
  assert.equal(result.status, 23, result.stderr);
  const calls = fixture.calls();
  assert.match(fixture.secretInput(), /not-a-credential/);
  assert.doesNotMatch(fixture.engineCalls() + calls + result.stderr + result.stdout, /not-a-credential/);
  assert.match(fixture.engineCalls(), /secret create slk_.* -/);
  assert.match(calls, /--profile maintenance up -d --no-build maintenance/);
  assert.match(calls, /stop frontend/);
  assert.match(calls, /exec -T directus \/directus\/cli\/import-all.sh/);
  assert.doesNotMatch(calls, /stop maintenance|frontend-build|--force-recreate frontend/);
});

test("Podman prepare refuses to mutate an active frontend release", (t) => {
  const fixture = wrapperFixture(t);
  const result = fixture.invoke(["prepare"], "yes");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /live artifact must not be overwritten/);
  assert.equal(fixture.calls(), "");
});

test("native Podman secrets omit dotenv values and credential hashes from provider configuration", () => {
  const credential = "private-canary-\r\n-do-not-print";
  const inputs = {
    db: { POSTGRES_PASSWORD: credential },
    meilisearch: { MEILI_MASTER_KEY: credential },
    directus: { SECRET: credential, SLK_STARTUP_SECURITY_CHECKS: "false", CACHE_ENABLED: "true" },
    frontend: { PRIVATE_TOKEN: credential, EMPTY_OPTION: "" },
  };
  const plan = podmanSecretPlan(inputs, true, "slk-test");
  const serialized = JSON.stringify(plan.overlay);
  assert.ok(!serialized.includes(credential));
  for (const value of Object.values(plan.manifest)) assert.ok(!serialized.includes(value.digest));
  assert.deepEqual(plan.overlay.services["frontend-build"], plan.overlay.services.frontend);
  assert.equal(plan.overlay.services.frontend!.environment.EMPTY_OPTION, "");
  assert.equal(
    plan.overlay.services.directus!.secrets.some((secret) => secret.target === "CACHE_ENABLED"),
    false,
  );
  assert.equal(
    plan.overlay.services.directus!.secrets.some((secret) => secret.target === "SLK_STARTUP_SECURITY_CHECKS"),
    false,
  );
  for (const [name, value] of plan.values) {
    assert.equal(value, credential);
    assert.match(name, /^slk_slk-test_[a-f0-9]{32}$/);
  }
  const unchanged = podmanSecretPlan(inputs, true, "slk-test", plan.manifest);
  assert.deepEqual(unchanged.manifest, plan.manifest);
  const changed = podmanSecretPlan(
    { ...inputs, db: { POSTGRES_PASSWORD: "rotated-private-value" } },
    true,
    "slk-test",
    plan.manifest,
  );
  assert.notEqual(changed.manifest["db:POSTGRES_PASSWORD"]!.name, plan.manifest["db:POSTGRES_PASSWORD"]!.name);
  assert.equal(changed.manifest["frontend:PRIVATE_TOKEN"]!.name, plan.manifest["frontend:PRIVATE_TOKEN"]!.name);
});

test("native secret exclusions exactly track maintained Compose controls and dotenv never enters provider env_file", () => {
  for (const service of Object.keys(managedPodmanEnvironment) as (keyof typeof managedPodmanEnvironment)[]) {
    assert.equal(base.services[service].env_file, undefined);
    assert.deepEqual(
      [...managedPodmanEnvironment[service]].sort(),
      Object.keys(base.services[service].environment || {}).sort(),
    );
    assert.deepEqual(
      [...managedPodmanProductionEnvironment[service]].sort(),
      Object.keys(production.services[service]?.environment || {}).sort(),
    );
  }
});
