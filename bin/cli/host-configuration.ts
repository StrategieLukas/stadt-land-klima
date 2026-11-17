/** Standalone host helpers intentionally use only Node's standard library. */
import { lstatSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { parseEnv } from "node:util";

export function hostPath(value: string): string {
  if (!isAbsolute(value) || !/^\/[a-zA-Z0-9/_.-]+$/.test(value) || resolve(value) !== value)
    throw new Error("Host paths must be absolute, normalized paths without shell/systemd substitutions");
  return value;
}

export function privateHostEnvironment(path: string, owner: number): Record<string, string | undefined> {
  hostPath(path);
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== owner || (stat.mode & 0o077) !== 0)
    throw new Error("Host configuration must be an owner-only regular file belonging to its expected user");
  return parseEnv(readFileSync(path, "utf8"));
}

export function hostSettings(
  fields: Record<string, string | undefined>,
  account: { user: string; uid: number; gid: number; home: string },
  app: Record<string, string | undefined>,
) {
  const project = app.SLK_PODMAN_PROJECT ?? "";
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(project) || app.SLK_DEPLOYMENT_TARGET !== "production")
    throw new Error("An explicit production deployment target and existing Podman project are required");
  if (!/^[a-z_][a-z0-9_-]*$/.test(account.user) || account.uid <= 0 || account.gid <= 0)
    throw new Error("An unprivileged deployment account is required");
  const home = hostPath(account.home);
  const port = (value: string | undefined, fallback: number) => {
    if (value !== undefined && !/^\d{4,5}$/.test(value)) throw new Error("Invalid application port");
    const number = Number(value ?? fallback);
    if (number < 1024 || number > 65535) throw new Error("Invalid application port");
    return number;
  };
  const scope = (value: string | undefined) => {
    if (!value || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value))
      throw new Error("Explicit safe backup host and tag are required");
    return value;
  };
  return {
    ...account,
    home,
    repository: `${home}/stadt-land-klima`,
    appConfig: hostPath(fields.SLK_HOST_APP_CONFIG ?? ""),
    backupConfig: hostPath(fields.SLK_HOST_BACKUP_CONFIG ?? ""),
    backupHost: scope(fields.SLK_HOST_BACKUP_HOST),
    backupTag: scope(fields.SLK_HOST_BACKUP_TAG),
    project,
    cmsPort: port(app.SLK_PODMAN_CMS_PORT, 9001),
    webPort: port(app.SLK_PODMAN_WEB_PORT, 9000),
  };
}

export type HostSettings = ReturnType<typeof hostSettings>;

export function loadHostSettings(path: string): HostSettings {
  if (process.platform !== "linux" || process.getuid?.() !== 0)
    throw new Error("Host maintenance requires root on Linux");
  const fields = privateHostEnvironment(path, 0);
  const user = fields.SLK_HOST_APP_USER ?? "deploy";
  if (!/^[a-z_][a-z0-9_-]*$/.test(user)) throw new Error("Invalid deployment account");
  const result = spawnSync("getent", ["passwd", user], { encoding: "utf8" });
  const parts = result.stdout?.trim().split(":");
  if (result.status !== 0 || parts?.length !== 7) throw new Error("Deployment account not found");
  const account = { user, uid: Number(parts[2]), gid: Number(parts[3]), home: parts[5]! };
  return hostSettings(fields, account, privateHostEnvironment(fields.SLK_HOST_APP_CONFIG ?? "", account.uid));
}
