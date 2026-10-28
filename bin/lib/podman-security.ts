/** Fail-closed host/runtime checks. Never print inspect/config JSON: it contains secrets. */
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

class PodmanSecurityError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new PodmanSecurityError("Invalid Podman security metadata");
  return value as Record<string, unknown>;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string"))
    throw new PodmanSecurityError("Invalid Podman security list");
  return value;
}
export function assertPodmanHost(value: unknown): string {
  const info = record(value);
  const host = record(info.host);
  const security = record(host.security);
  const version = record(info.version).Version;
  const parsedVersion = typeof version === "string" ? /^(\d+)\.(\d+)\./.exec(version) : null;
  if (
    !parsedVersion ||
    Number(parsedVersion[1]) < 5 ||
    (Number(parsedVersion[1]) === 5 && Number(parsedVersion[2]) < 4)
  )
    throw new PodmanSecurityError("Podman 5.4 or newer is required; install a supported security-patched release");
  if (host.arch !== "amd64") throw new PodmanSecurityError("The existing Typst image build supports Linux x86_64 only");
  if (security.rootless !== true) throw new PodmanSecurityError("Rootless Podman is required; do not use sudo");
  if (security.seccompEnabled !== true) throw new PodmanSecurityError("Podman must have seccomp enabled");
  if (security.apparmorEnabled !== true && security.selinuxEnabled !== true)
    throw new PodmanSecurityError("Enable the host AppArmor or SELinux container confinement");
  if (host.cgroupVersion !== "v2" || !["memory", "pids"].every((key) => strings(host.cgroupControllers).includes(key)))
    throw new PodmanSecurityError("Rootless cgroup v2 memory and pids delegation is required");
  if (host.networkBackend !== "netavark")
    throw new PodmanSecurityError("The Netavark backend with container DNS is required");
  const profile = security.seccompProfilePath;
  if (typeof profile !== "string" || !isAbsolute(profile) || /[\r\n\0]/.test(profile))
    throw new PodmanSecurityError("Podman must report an absolute host seccomp profile path");
  return profile;
}
export function assertSeccompProfile(value: unknown): void {
  const profile = record(value);
  if (!["SCMP_ACT_ERRNO", "SCMP_ACT_KILL", "SCMP_ACT_KILL_PROCESS"].includes(String(profile.defaultAction)))
    throw new PodmanSecurityError("The host seccomp profile must deny syscalls by default");
  if (!Array.isArray(profile.syscalls) || profile.syscalls.length === 0)
    throw new PodmanSecurityError("The host seccomp profile needs an explicit syscall allowlist");
  if (!profile.syscalls.some((rule: unknown) => record(rule).action === "SCMP_ACT_ALLOW"))
    throw new PodmanSecurityError("The host seccomp profile has no syscall allowlist");
}

// Derive from the maintained distro allowlist. These services need threads/JIT,
// but never nested namespaces, kernel administration, tracing or io_uring.
export const blockedPodmanSyscalls = [
  "add_key",
  "request_key",
  "keyctl",
  "bpf",
  "perf_event_open",
  "userfaultfd",
  "ptrace",
  "process_vm_readv",
  "process_vm_writev",
  "process_madvise",
  "pidfd_getfd",
  "unshare",
  "setns",
  "mount",
  "mount_setattr",
  "umount",
  "umount2",
  "pivot_root",
  "fsopen",
  "fsconfig",
  "fsmount",
  "fspick",
  "open_tree",
  "move_mount",
  "reboot",
  "kexec_load",
  "kexec_file_load",
  "init_module",
  "finit_module",
  "delete_module",
  "swapon",
  "swapoff",
  "open_by_handle_at",
  "fanotify_init",
  "fanotify_mark",
];
const unavailableSyscalls = ["clone3", "io_uring_setup", "io_uring_enter", "io_uring_register"];
export function hardenedPodmanSeccomp(value: unknown): Record<string, unknown> {
  assertSeccompProfile(value);
  const profile = structuredClone(record(value));
  const replaced = new Set([...blockedPodmanSyscalls, ...unavailableSyscalls, "clone"]);
  const rules: Record<string, unknown>[] = [];
  for (const entry of profile.syscalls as unknown[]) {
    const rule = record(entry);
    const names = strings(rule.names).filter((name) => !replaced.has(name));
    if (names.length > 0) rules.push({ ...rule, names });
  }
  rules.push(
    { names: blockedPodmanSyscalls, action: "SCMP_ACT_ERRNO", errnoRet: 1 },
    // glibc/musl and libuv can fall back to clone/synchronous IO on ENOSYS.
    { names: unavailableSyscalls, action: "SCMP_ACT_ERRNO", errnoRet: 38 },
    {
      names: ["clone"],
      action: "SCMP_ACT_ALLOW",
      // x86_64 clone flags are argument 0. Reject all CLONE_NEW* namespace flags.
      args: [{ index: 0, value: 0x7e020080, valueTwo: 0, op: "SCMP_CMP_MASKED_EQ" }],
    },
  );
  profile.syscalls = rules;
  return profile;
}

export function assertPrivatePodmanFile(stat: { isFile: () => boolean; mode: number; uid: number }, uid: number): void {
  if (!stat.isFile() || stat.uid !== uid || ![0o600, 0o400].includes(stat.mode & 0o777))
    throw new PodmanSecurityError("Environment files must be regular, owned by the operator and mode 0600 or 0400");
}
export const podmanServices = ["db", "cache", "meilisearch", "directus", "frontend", "maintenance"] as const;
export type PodmanService = (typeof podmanServices)[number];
export function assertPodmanContainer(value: unknown, service: PodmanService, expectedSeccomp?: string): void {
  if (!Array.isArray(value) || value.length !== 1) throw new PodmanSecurityError("Expected one Podman container");
  const container = record(value[0]);
  const config = record(container.Config);
  const host = record(container.HostConfig);
  const expectedUser = service === "db" ? "999:999" : service === "cache" ? "999:1000" : "1000:1000";
  if (config.User !== expectedUser) throw new PodmanSecurityError("Unexpected runtime user");
  if (host.Privileged !== false || host.ReadonlyRootfs !== true)
    throw new PodmanSecurityError("Runtime must be unprivileged and read-only");
  if (host.NetworkMode === "host" || host.PidMode === "host" || host.IpcMode === "host")
    throw new PodmanSecurityError("Host namespaces are forbidden");
  if (typeof host.Memory !== "number" || host.Memory <= 0 || typeof host.PidsLimit !== "number" || host.PidsLimit <= 0)
    throw new PodmanSecurityError("Runtime resource limits are missing");
  if (host.CapAdd !== null && host.CapAdd !== undefined && strings(host.CapAdd).length > 0)
    throw new PodmanSecurityError("Runtime must not add capabilities");
  const options = strings(host.SecurityOpt);
  if (!options.some((item) => /^(?:no-new-privileges)(?:[=:]true)?$/.test(item)))
    throw new PodmanSecurityError("no-new-privileges is missing");
  if (!options.some((item) => item.startsWith("seccomp=") && item !== "seccomp=unconfined"))
    throw new PodmanSecurityError("Explicit seccomp confinement is missing");
  if (expectedSeccomp && !options.includes("seccomp=" + expectedSeccomp))
    throw new PodmanSecurityError("Runtime must use the selected hardened seccomp profile");
  if (options.some((item) => /(?:apparmor=unconfined|label=disable|unmask=ALL)/.test(item)))
    throw new PodmanSecurityError("Host confinement must not be disabled");
  if (!Array.isArray(container.Mounts)) throw new PodmanSecurityError("Runtime mounts are missing");
  for (const entry of container.Mounts) {
    const mount = record(entry);
    if (mount.Type === "bind" && mount.RW !== false)
      throw new PodmanSecurityError("Production host binds must be read-only");
    if (typeof mount.Destination !== "string" || /(?:docker|podman)\.sock$/.test(mount.Destination))
      throw new PodmanSecurityError("Invalid mount or container engine socket");
    if (mount.Type === "volume" && mount.RW === true) {
      const allowed = {
        db: "/var/lib/postgresql/data",
        cache: "/data",
        meilisearch: "/meili_data",
        directus: "/directus/uploads",
      };
      if (!(service in allowed) || mount.Destination !== allowed[service as keyof typeof allowed])
        throw new PodmanSecurityError("Unexpected writable runtime volume");
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === "host") {
      if (process.getuid?.() === 0) throw new PodmanSecurityError("Run Podman as the deployment user, without sudo");
      const info: unknown = JSON.parse(
        execFileSync("podman", ["--remote=false", "info", "--format", "json"], {
          encoding: "utf8",
          maxBuffer: 4 * 1024 * 1024,
        }),
      );
      const profile = assertPodmanHost(info);
      const stat = lstatSync(profile);
      if (!stat.isFile() || (stat.mode & 0o022) !== 0 || ![0, process.getuid?.()].includes(stat.uid))
        throw new PodmanSecurityError(
          "The seccomp profile must be a trusted regular file without group/world write access",
        );
      const hardened = hardenedPodmanSeccomp(JSON.parse(readFileSync(profile, "utf8")) as unknown);
      const runtime = process.env.XDG_RUNTIME_DIR;
      if (!runtime || !isAbsolute(runtime) || /[\x00-\x1f\x7f]/.test(runtime))
        throw new PodmanSecurityError("A private XDG_RUNTIME_DIR is required");
      const directory = resolve(runtime, "slk-podman");
      mkdirSync(directory, { mode: 0o700, recursive: true });
      const directoryStat = lstatSync(directory);
      if (
        !directoryStat.isDirectory() ||
        directoryStat.uid !== process.getuid?.() ||
        (directoryStat.mode & 0o077) !== 0
      )
        throw new PodmanSecurityError("Podman runtime profile directory must be private and owned by the operator");
      const output = resolve(directory, "seccomp.json");
      const temporary = output + "." + randomUUID();
      writeFileSync(temporary, JSON.stringify(hardened) + "\n", { mode: 0o600, flag: "wx" });
      renameSync(temporary, output);
      process.stdout.write(output + "\n");
    } else if (process.argv[2] === "environment") {
      const uid = process.getuid?.();
      if (uid === undefined) throw new PodmanSecurityError("Linux filesystem ownership is required");
      for (const path of [
        process.env.SLK_PODMAN_DB_ENV_FILE || "docker/db/.env",
        process.env.SLK_PODMAN_MEILI_ENV_FILE || "docker/meilisearch/.env",
        process.env.SLK_PODMAN_DIRECTUS_ENV_FILE || "src/directus/.env",
        process.env.SLK_PODMAN_FRONTEND_ENV_FILE || "src/frontend/.env",
      ])
        assertPrivatePodmanFile(lstatSync(path), uid);
    } else if (process.argv[2] === "container") {
      const service = podmanServices.find((item) => item === process.argv[3]);
      if (!service) throw new PodmanSecurityError("Unknown Podman service");
      assertPodmanContainer(JSON.parse(readFileSync(0, "utf8")) as unknown, service, process.env.SLK_PODMAN_SECCOMP);
    } else throw new PodmanSecurityError("Expected host, environment or container <service>");
  } catch (error) {
    // Only our fixed validation messages are safe to emit; parser/provider errors can contain raw data.
    const message = error instanceof PodmanSecurityError ? error.message : "Podman security check could not complete";
    process.stderr.write(message.replace(/[\r\n\x00-\x1f\x7f]/g, " ").slice(0, 240) + "\n");
    process.exitCode = 1;
  }
}
