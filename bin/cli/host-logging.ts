/** Optional host journal shipping; credentials are loaded by systemd, never embedded. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isIP } from "node:net";
import { hostPath } from "./host-configuration.ts";
import type { HostArtifact } from "./host-maintenance.ts";

export const HOST_VECTOR_VERSION = "0.62.0";
export const HOST_VECTOR_SHA256 = "af2fe313d74e539914d1497898c1a4e338c3adcaa24605b7eee4116e983c3899";
export const HOST_LOGGING_PATHS = [
  "/etc/slk/vector/vector.yaml",
  "/etc/slk/vector/normalize.vrl",
  "/etc/systemd/system/slk-vector.service",
  "/etc/systemd/journald.conf.d/60-slk-logging.conf",
] as const;
export const RETIRED_LOGGING_PATHS = ["/etc/slk/alloy/config.alloy", "/etc/systemd/system/slk-alloy.service"];

export function assertVectorBuild(version: string): void {
  if (!new RegExp(`^vector ${HOST_VECTOR_VERSION.replaceAll(".", "\\.")}(?:\\s|$)`).test(version))
    throw new Error(`Install the reviewed Vector ${HOST_VECTOR_VERSION} binary before host maintenance`);
}

export function loggingSettings(fields: Record<string, string | undefined>) {
  const endpoint = fields.SLK_LOG_ENDPOINT ?? "";
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("An absolute HTTPS VictoriaLogs ingestion endpoint is required");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/insert/jsonline" ||
    (!/^[a-zA-Z0-9.-]+$/.test(url.hostname) && !isIP(url.hostname.replace(/^\[|\]$/g, ""))) ||
    url.href !== endpoint
  )
    throw new Error(
      "Use a canonical HTTPS VictoriaLogs ingestion URL without credentials, queries, fragments or templates",
    );
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
  vectorGid: number,
): HostArtifact[] {
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(project) || !Number.isInteger(vectorGid) || vectorGid <= 0)
    throw new Error("An explicit Podman project and unprivileged Vector group are required");
  const replacements: Record<string, string> = {
    __SLK_PROJECT__: project,
    __SLK_LOG_HOST__: settings.host,
    __SLK_LOG_ENVIRONMENT__: settings.environment,
    __SLK_LOG_ENDPOINT__: settings.endpoint,
    __SLK_LOG_USERNAME__: settings.username,
  };
  const render = (path: string) => {
    let value = readFileSync(join(root, path), "utf8");
    for (const [key, replacement] of Object.entries(replacements)) value = value.replaceAll(key, replacement);
    return value;
  };
  const artifact = (path: string, text: string, mode = 0o644, gid = 0): HostArtifact => ({
    path,
    bytes: Buffer.from(text),
    mode,
    uid: 0,
    gid,
  });
  return [
    artifact(HOST_LOGGING_PATHS[0], render("podman/logging/vector.yaml"), 0o640, vectorGid),
    artifact(HOST_LOGGING_PATHS[1], render("podman/logging/normalize.vrl"), 0o640, vectorGid),
    artifact(
      HOST_LOGGING_PATHS[2],
      readFileSync(join(root, "podman/logging/slk-vector.service"), "utf8").replaceAll(
        "__SLK_LOG_PASSWORD_FILE__",
        settings.passwordFile,
      ),
    ),
    artifact(HOST_LOGGING_PATHS[3], readFileSync(join(root, "podman/logging/journald.conf"), "utf8")),
  ];
}
