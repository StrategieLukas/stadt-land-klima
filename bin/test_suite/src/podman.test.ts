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
  assertAppArmorLabel,
  assertInheritedAppArmor,
} from "../../lib/podman-security.js";
import {
  podmanEnvironmentPlan,
  managedPodmanEnvironment,
  managedPodmanProductionEnvironment,
} from "../../lib/podman-environment.js";
import { assertReleasePolicy } from "./lib/releasePolicy.js";

const require = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
const yaml = require("yaml") as { parse: (value: string, options: { merge: true }) => Record<string, any> };
const parse = (value: string) => yaml.parse(value, { merge: true });
const read = (file: string) => readFileSync(new URL("../../../" + file, import.meta.url), "utf8");
const base = parse(read("podman-compose.yaml"));
const production = parse(read("podman-compose.prod.yaml"));
const development = parse(read("podman-compose.dev.yaml"));

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
  assert.match(read("podman/database/Containerfile"), /postgis\/postgis:17-3\.6@sha256:/);
  assert.match(read("podman/meilisearch/Containerfile"), /meilisearch:v1\.56\.2/);
  assert.match(read("podman/directus/RuntimeContainerfile"), /directus\/directus:11\.17\.4/);
  for (const service of ["db", "cache", "meilisearch"]) assert.equal(base.services[service].ports, undefined);
  assert.equal(production.services.directus.environment.SLK_STARTUP_SECURITY_CHECKS, "true");
  assert.equal(production.services.frontend.environment.NODE_ENV, "production");
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
      assert.doesNotMatch(mount, /\.sock|podman\/data|core-storage/);
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
  assert.match(builder.command.join(" "), /npm ci --include=dev.*npm run build.*productionOutput.mts stamp/);
  assert.doesNotMatch(base.services.frontend.command.join(" "), /npm|build/);
  assert.match(base.services.frontend.command.join(" "), /productionOutput.mts verify/);
  assert.doesNotMatch(base.services.directus.command.join(" "), /npm ci/);
  assert.match(read("podman/directus/Containerfile"), /FROM localhost\/slk-podman-directus-runtime:local/);
  assert.match(read("podman/directus/Containerfile"), /npm --prefix "\$extension" run build/);
  assert.match(read("podman/directus/Containerfile"), /npm prune.*--omit=dev/);
  assert.match(read("podman/directus/RuntimeContainerfile"), /FROM docker\.io\/directus\/directus:11\.17\.4\n/);
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

test("inherited AppArmor rejects missing, spoofed, complain and untrusted policy evidence", () => {
  const valid = {
    label: "crun//&slk-rootless (mixed)",
    profiles: "other (complain)\nslk-rootless (enforce)\n",
    source: "maintained policy",
    expectedSource: "maintained policy",
    stat: { isFile: () => true, uid: 0, mode: 0o644 },
  };
  assert.doesNotThrow(() => assertInheritedAppArmor(valid));
  assert.doesNotThrow(() => assertAppArmorLabel("slk-rootless (enforce)"));
  for (const label of ["unconfined", "slk-rootless (complain)", "fake-slk-rootless (enforce)", "crun (enforce)"])
    assert.throws(() => assertInheritedAppArmor({ ...valid, label }));
  for (const profiles of ["", "slk-rootless (complain)", "fake-slk-rootless (enforce)"])
    assert.throws(() => assertInheritedAppArmor({ ...valid, profiles }));
  assert.throws(() => assertInheritedAppArmor({ ...valid, source: "changed policy" }));
  for (const stat of [
    { ...valid.stat, isFile: () => false },
    { ...valid.stat, uid: 1000 },
    { ...valid.stat, mode: 0o664 },
    { ...valid.stat, mode: 0o646 },
  ])
    assert.throws(() => assertInheritedAppArmor({ ...valid, stat }));
  const ubuntu = host();
  ubuntu.host.security.apparmorEnabled = false;
  assert.throws(() => assertPodmanHost(ubuntu));
  assert.doesNotThrow(() => assertPodmanHost(ubuntu, true));
  ubuntu.host.security.rootless = false;
  assert.throws(() => assertPodmanHost(ubuntu, true), /Rootless/);
});

test("production rejects missing effective LSM; a verified development AppArmor host still enforces seccomp and rootless mode", () => {
  const value = host();
  value.host.security.apparmorEnabled = false;
  assert.throws(() => assertPodmanHost(value), /AppArmor or SELinux/);
  assert.doesNotThrow(() => assertPodmanHost(value, true));
  value.host.security.seccompEnabled = false;
  assert.throws(() => assertPodmanHost(value, true), /seccomp/);
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
  const wrapper = read("bin/cli/stack.ts");
  assert.match(wrapper, /--in-pod=false/);
  assert.match(read("bin/cli/podman-local.mjs"), /--remote=false/);
  assert.doesNotMatch(wrapper, /\bpodman (?:build|ps|inspect|exec) /);
  assert.match(wrapper, /Stop frontend before preparing/);
  assert.match(wrapper, /\^Seccomp:/);
  assert.match(wrapper, /\^CapBnd:/);
  assert.doesNotMatch(wrapper, /logs --tail|down -v|chmod 777|prune -[af]/);
  assert.ok(wrapper.includes("await audit(rt)") && wrapper.includes('"stop", "maintenance"'));
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
    "bin/cli",
    "tools",
    "runtime",
    "podman/database",
    "podman/meilisearch",
    "podman/maintenance",
    "src/directus/cli",
    "src/frontend",
  ])
    mkdirSync(join(directory, folder), { recursive: true, mode: 0o700 });
  for (const file of [
    "bin/slk",
    "bin/package.json",
    "bin/cli/index.ts",
    "bin/cli/host-environment.ts",
    "bin/cli/stack.ts",
    "bin/cli/podman-local.mjs",
    "bin/cli/process.ts",
    "bin/cli/operations.ts",
    "bin/cli/core.ts",
    "bin/lib/podman-security.ts",
    "bin/lib/podman-environment.ts",
    "bin/lib/maintenance-meta.ts",
    "bin/lib/portable-backup.ts",
    "bin/lib/container-environment.ts",
    "bin/lib/cms-origin.ts",
    "src/directus/cli/package.json",
  ])
    copyFileSync(fileURLToPath(new URL("../../../" + file, import.meta.url)), join(directory, file));
  for (const file of ["podman/database/.env", "podman/meilisearch/.env", "src/directus/.env", "src/frontend/.env"])
    writeFileSync(join(directory, file), "PROBE=not-a-credential\n", { mode: 0o600 });
  symlinkSync(
    fileURLToPath(new URL("../../../src/directus/cli/node_modules", import.meta.url)),
    join(directory, "src/directus/cli/node_modules"),
    "dir",
  );
  symlinkSync(
    fileURLToPath(new URL("../../../bin/node_modules", import.meta.url)),
    join(directory, "bin/node_modules"),
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
case "$*" in *--version*) echo 'podman-compose version 1.6.0'; exit 0 ;; esac
for descriptor in /proc/self/fd/*; do
  target=$(readlink "$descriptor" || true)
  case "$target" in *.lock) echo 'lock descriptor inherited' >&2; exit 91 ;; esac
done
printf '%s\n' "$*" >> "$PROBE_ROOT/calls"
case "$*" in *bootstrapConfiguration.ts*) exit "\${PROBE_IMPORT_STATUS:-23}" ;; esac
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
  const invoke = (args: string[], running = "no", importFailure = true) =>
    spawnSync(
      process.execPath,
      ["bin/slk", "stack", args[0]!, "--env", "production", ...(args[0] === "compose" ? ["--"] : []), ...args.slice(1)],
      {
        cwd: directory,
        encoding: "utf8",
        timeout: 20_000,
        env: {
          ...process.env,
          PATH: join(directory, "tools") + ":" + process.env.PATH,
          PROBE_ROOT: directory,
          PROBE_RUNNING: running,
          PROBE_IMPORT_STATUS: importFailure ? "23" : "0",
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
      },
    );
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
  assert.doesNotMatch(fixture.engineCalls() + calls + result.stderr + result.stdout, /not-a-credential/);
  assert.doesNotMatch(fixture.engineCalls(), /secret create/);
  assert.match(calls, /--profile maintenance up -d --no-build maintenance/);
  assert.match(calls, /stop frontend/);
  assert.match(
    calls,
    /run --rm --no-deps --entrypoint \/usr\/local\/bin\/slk-env directus node \/directus\/cli\/bootstrapConfiguration.ts/,
  );
  assert.doesNotMatch(calls, /stop maintenance|frontend-build|--force-recreate frontend/);
});

test("Podman prepare refuses to mutate an active frontend release", (t) => {
  const fixture = wrapperFixture(t);
  const result = fixture.invoke(["prepare"], "yes");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /live artifacts must not be overwritten/);
  assert.equal(fixture.calls(), "");
});

test("runtime mounts contain paths only and the builder receives no private mounts", () => {
  const paths = {
    db: "/private/db.env",
    meilisearch: "/private/search.env",
    directus: "/private/cms.env",
    frontend: "/private/web.env",
  };
  const plan = podmanEnvironmentPlan(paths, true);
  assert.equal(plan.services["frontend-build"], undefined);
  assert.ok(plan.services.frontend!.volumes.includes("/private/web.env:/frontend/.env:ro,z"));
  assert.ok(plan.services.directus!.volumes.includes("/private/cms.env:/directus/.env:ro,z"));
  assert.equal(
    plan.services.frontend!.environment.SLK_ENV_FILES,
    "/run/slk-env/frontend.env:/run/slk-env/meilisearch.env",
  );
  assert.ok(plan.services.directus!.environment.SLK_ENV_LOCKED_KEYS?.includes("CACHE_ENABLED"));
  assert.ok(plan.services.directus!.environment.SLK_ENV_LOCKED_KEYS?.includes("SLK_STARTUP_SECURITY_CHECKS"));
  for (const service of Object.values(plan.services)) {
    assert.ok(service.volumes.every((mount) => mount.endsWith(":ro,z")));
    assert.deepEqual(Object.keys(service.environment).sort(), ["SLK_ENV_FILES", "SLK_ENV_LOCKED_KEYS"]);
  }
});

test("managed runtime controls are declared in their Compose environments", () => {
  for (const service of Object.keys(managedPodmanEnvironment) as (keyof typeof managedPodmanEnvironment)[]) {
    assert.equal(base.services[service].env_file, undefined);
    for (const key of managedPodmanEnvironment[service])
      assert.ok(key in (base.services[service].environment ?? {}), key);
    for (const key of managedPodmanProductionEnvironment[service])
      assert.ok(key in (production.services[service]?.environment ?? {}), key);
  }
});

test("prepare-only retains maintenance and never touches the frontend artifact", (t) => {
  const fixture = wrapperFixture(t);
  const result = fixture.invoke(["start", "--prepare-only"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fixture.calls(), /stop frontend/);
  assert.match(fixture.calls(), /--force-recreate directus/);
  assert.doesNotMatch(fixture.calls(), /frontend-build|--force-recreate frontend|stop maintenance/);
});

test("compose exec reloads mounts and preserves explicit per-command environment overrides", (t) => {
  const fixture = wrapperFixture(t);
  const result = fixture.invoke([
    "compose",
    "exec",
    "-T",
    "-e",
    "DIRECTUS_URL=http://127.0.0.1:8055",
    "directus",
    "node",
    "cli/task.ts",
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fixture.calls(), /directus \/usr\/local\/bin\/slk-env --keep=DIRECTUS_URL node cli\/task.ts/);
  assert.doesNotMatch(fixture.calls(), /not-a-credential/);
});

test("restart rereads mounted files without building or replacing output", (t) => {
  const fixture = wrapperFixture(t);
  const result = fixture.invoke(["restart", "frontend"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fixture.calls(), /restart frontend/);
  assert.doesNotMatch(fixture.calls(), /frontend-build|build |productionOutput|--force-recreate/);
});

test("private YAML setup precedes the checked full CMS and never publishes helper ports", (t) => {
  const fixture = wrapperFixture(t);
  const result = fixture.invoke(["start", "--import", "--prepare-only"], "no", false);
  assert.equal(result.status, 0, result.stderr);
  const calls = fixture.calls();
  assert.ok(calls.indexOf("bootstrapConfiguration.ts") < calls.indexOf("--force-recreate directus"));
  assert.doesNotMatch(calls, /--service-ports|SLK_STARTUP_SECURITY_CHECKS=false|stop maintenance/);
});

test("release staging failure leaves the live application untouched and activation requires a verified backup", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "slk-release-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const tools = join(directory, "tools");
  const repo = join(directory, "repo");
  mkdirSync(tools);
  mkdirSync(join(repo, "bin"), { recursive: true });
  mkdirSync(join(repo, "podman/release"), { recursive: true });
  const script = join(repo, "podman/release/run.sh");
  copyFileSync(new URL("../../../podman/release/run.sh", import.meta.url), script);
  chmodSync(script, 0o700);
  const calls = join(directory, "calls");
  mkdirSync(join(repo, "bin/lib"), { recursive: true });
  mkdirSync(join(repo, "bin/cli"), { recursive: true });
  copyFileSync(new URL("../../cli/host-environment.ts", import.meta.url), join(repo, "bin/cli/host-environment.ts"));
  copyFileSync(new URL("../../lib/podman-security.ts", import.meta.url), join(repo, "bin/lib/podman-security.ts"));
  copyFileSync(new URL("../../package.json", import.meta.url), join(repo, "bin/package.json"));
  symlinkSync(fileURLToPath(new URL("../../node_modules", import.meta.url)), join(repo, "bin/node_modules"), "dir");
  writeFileSync(
    join(repo, "bin/lib/maintenance-meta.ts"),
    'import {writeFileSync} from "node:fs";writeFileSync(process.argv[2]!,"// fixture metadata\\n");',
  );
  writeFileSync(
    join(repo, "bin/slk"),
    `#!/bin/sh
command=$2; shift 2
if [ "$1" = --env ]; then shift 2; fi
if [ "$1" = -- ]; then shift; fi
set -- production "$command" "$@"
for descriptor in /proc/self/fd/*; do
  target=$(readlink "$descriptor" || true)
  case "$target" in *.lock) echo 'lock descriptor inherited' >&2; exit 91 ;; esac
done
printf '%s:%s\n' "$SLK_PODMAN_TAG" "$*" >> "$RELEASE_PROBE_CALLS"
case "$*" in
  *'--profile maintenance build '*) exit 33 ;;
  *'up -d --no-build --no-deps directus'*) if [ \"$RELEASE_PROBE_ALLOW_START\" != 1 ]; then exit 34; fi ;;
  *'production audit'*) if [ "$RELEASE_PROBE_FAIL_AUDIT" = 1 ]; then exit 36; fi ;;
esac
`,
    { mode: 0o700 },
  );
  writeFileSync(
    join(tools, "git"),
    `#!/bin/sh
case "$*" in 'rev-parse HEAD') echo deadbeef00000000000000000000000000000000 ;; esac
`,
    { mode: 0o700 },
  );
  writeFileSync(
    join(tools, "id"),
    `#!/bin/sh
echo 1000
`,
    { mode: 0o700 },
  );
  writeFileSync(
    join(tools, "stat"),
    `#!/bin/sh
case "$*" in *host.env*) echo 600:1000 ;; *) echo 700:1000 ;; esac
`,
    { mode: 0o700 },
  );
  const config = join(directory, "host.env");
  writeFileSync(config, "SLK_PODMAN_PROJECT=slk-test\nSLK_PODMAN_TAG=release-b477ac14\n", { mode: 0o600 });
  const runtime = join(directory, "runtime");
  mkdirSync(join(runtime, "slk-podman"), { recursive: true });
  const env = {
    ...process.env,
    HOME: directory,
    PATH: tools + ":" + process.env.PATH,
    XDG_RUNTIME_DIR: runtime,
    SLK_PODMAN_PROJECT: "slk-test",
    RELEASE_PROBE_CALLS: calls,
  };
  const run = (action: string, allowStart = false, failAudit = false) =>
    spawnSync("bash", [script, config, action, "release-deadbeef", "release-b477ac14"], {
      env: {
        ...env,
        RELEASE_PROBE_ALLOW_START: allowStart ? "1" : "0",
        RELEASE_PROBE_FAIL_AUDIT: failAudit ? "1" : "0",
      },
      encoding: "utf8",
    });
  assert.equal(run("stage").status, 33);
  assert.doesNotMatch(readFileSync(calls, "utf8"), /stop|up -d|import-all/);
  const state = join(directory, ".local/state/slk-releases/release-deadbeef");
  const staged = parse(readFileSync(join(state, "stage.yaml"), "utf8"));
  assert.deepEqual(staged.services.frontend.volumes, ["staged-output:/frontend/.output:ro,U"]);
  assert.deepEqual(staged.services["frontend-build"].volumes, ["staged-output:/release:U"]);
  writeFileSync(join(state, "stage.ok"), "");
  assert.equal(run("activate").status, 1);
  assert.doesNotMatch(readFileSync(calls, "utf8"), /stop|up -d|import-all/);
  writeFileSync(join(state, "backup.verified"), "fixture backup");
  writeFileSync(
    join(tools, "podman"),
    `#!/bin/sh
case "$*" in
  *'volume create'*) echo 'volume already exists' >&2; exit 125 ;;
  *'ps -aq'*) echo probe-container ;;
esac
`,
    { mode: 0o700 },
  );
  writeFileSync(
    join(tools, "curl"),
    `#!/bin/sh
case "$*" in
  *'/api/public/pages/index'*) echo '{"page":{"id":"homepage"}}' ;;
  *'/api/public/blocks'*) echo '{"blocks":[]}' ;;
esac
`,
    { mode: 0o700 },
  );
  assert.equal(run("stage-prebuilt").status, 1, "Unlabelled images must never become staged releases");
  assert.throws(
    () => readFileSync(join(state, "stage.ok")),
    "Failed re-staging must invalidate the old approval marker",
  );
  writeFileSync(join(state, "stage.ok"), "");
  const failed = run("activate");
  assert.equal(failed.status, 34, failed.stderr);
  const recorded = readFileSync(calls, "utf8");
  assert.match(recorded, /release-b477ac14:production compose up -d --no-build --no-deps directus/);
  assert.doesNotMatch(recorded, /stop maintenance/);
  assert.match(failed.stderr, /maintenance retained/);
  writeFileSync(join(state, "import.started"), "");
  const restored = run("rollback", true);
  assert.equal(restored.status, 0, restored.stderr);
  assert.equal(readFileSync(join(state, "rollback.ok"), "utf8"), "");
  assert.throws(() => readFileSync(join(state, "import.started")));
  const rollbackCalls = readFileSync(calls, "utf8");
  assert.match(rollbackCalls, /production compose run .*rollbackHomepage.ts/);
  assert.match(rollbackCalls, /release-b477ac14:production compose up -d --no-build --no-deps frontend/);
  assert.match(rollbackCalls, /production compose --profile maintenance stop maintenance/);
  const auditFailure = run("activate", true, true);
  assert.equal(auditFailure.status, 36, auditFailure.stderr);
  assert.equal(
    (auditFailure.stdout.match(/Restoring previous application images/g) ?? []).length,
    1,
    "Only the coordinating shell may start rollback",
  );
  const activated = run("activate", true);
  assert.equal(activated.status, 0, activated.stderr);
  assert.equal(readFileSync(join(state, "activate.ok"), "utf8"), "");
});
