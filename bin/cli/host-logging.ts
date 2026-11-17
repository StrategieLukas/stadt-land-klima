/** Optional host journal shipping; credentials are loaded by systemd, never embedded. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hostPath } from "./host-configuration.ts";
import type { HostArtifact } from "./host-maintenance.ts";

export const HOST_ALLOY_VERSION = "1.22.0";
export const HOST_LOGGING_PATHS = [
  "/etc/slk/alloy/config.alloy",
  "/etc/systemd/system/slk-alloy.service",
  "/etc/systemd/journald.conf.d/60-slk-logging.conf",
] as const;

/** Version pins alone are insufficient when vendor binaries use an affected Go runtime. */
export function assertAlloyBuild(version: string): void {
  if (!new RegExp(`version v?${HOST_ALLOY_VERSION.replaceAll(".", "\\.")}(?:\\s|,|$)`).test(version))
    throw new Error(`Install the reviewed Alloy ${HOST_ALLOY_VERSION} package before host maintenance`);
  const go = /go version:\s+go1\.(\d+)\.(\d+)(?:\s|$)/.exec(version);
  const minor = Number(go?.[1]);
  const patch = Number(go?.[2]);
  if (!go || !(minor > 27 || (minor === 27 && patch >= 4) || (minor === 26 && patch >= 11)))
    throw new Error("Alloy uses an unverified/affected Go build (GO-2026-6859); see docs/LOGGING_SECURITY_REVIEW.md");
}

export function loggingSettings(fields: Record<string, string | undefined>) {
  const endpoint = fields.SLK_LOG_ENDPOINT ?? "";
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("An absolute HTTPS Loki ingestion endpoint is required");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["/loki/api/v1/push", "/insert/loki/api/v1/push"].includes(url.pathname) ||
    url.href !== endpoint
  )
    throw new Error("Use a canonical HTTPS Loki ingestion URL without credentials, queries or fragments");
  const label = (key: string) => {
    const value = fields[key] ?? "";
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value)) throw new Error(`Invalid logging setting: ${key}`);
    return value;
  };
  const environment = label("SLK_LOG_ENVIRONMENT");
  if (!["production", "staging", "future", "development"].includes(environment))
    throw new Error("Select an explicit deployment environment for logging");
  return {
    endpoint,
    host: label("SLK_LOG_HOST"),
    environment,
    username: label("SLK_LOG_USERNAME"),
    passwordFile: hostPath(fields.SLK_LOG_PASSWORD_FILE ?? ""),
  };
}

export type LoggingSettings = ReturnType<typeof loggingSettings>;

export function hostLoggingArtifacts(
  root: string,
  project: string,
  settings: LoggingSettings,
  alloyGid: number,
): HostArtifact[] {
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(project) || !Number.isInteger(alloyGid) || alloyGid <= 0)
    throw new Error("An explicit Podman project and unprivileged Alloy group are required");
  const replacements: Record<string, string> = {
    __SLK_PROJECT__: project,
    __SLK_LOG_HOST__: settings.host,
    __SLK_LOG_ENVIRONMENT__: settings.environment,
    __SLK_LOG_ENDPOINT__: settings.endpoint,
    __SLK_LOG_USERNAME__: settings.username,
  };
  let configuration = readFileSync(join(root, "podman/logging/config.alloy"), "utf8");
  for (const [key, value] of Object.entries(replacements)) configuration = configuration.replaceAll(key, value);
  const artifact = (path: string, text: string, mode = 0o644, gid = 0): HostArtifact => ({
    path,
    bytes: Buffer.from(text),
    mode,
    uid: 0,
    gid,
  });
  return [
    artifact(HOST_LOGGING_PATHS[0], configuration, 0o640, alloyGid),
    artifact(
      HOST_LOGGING_PATHS[1],
      readFileSync(join(root, "podman/logging/slk-alloy.service"), "utf8").replaceAll(
        "__SLK_LOG_PASSWORD_FILE__",
        settings.passwordFile,
      ),
    ),
    artifact(HOST_LOGGING_PATHS[2], readFileSync(join(root, "podman/logging/journald.conf"), "utf8")),
  ];
}
