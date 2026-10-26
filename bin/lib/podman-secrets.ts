/** Native environment secrets keep dotenv values out of provider argv and failure logs. */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPrivatePodmanFile } from "./podman-security.ts";

export const managedPodmanEnvironment = {
  db: [],
  meilisearch: ["MEILI_NO_ANALYTICS"],
  directus: [
    "DB_OPTIONS",
    "CACHE_AUTO_PURGE",
    "LOGGER_HTTP_AUTO_LOGGING",
    "LOG_STYLE",
    "LOG_LEVEL",
    "CACHE_ENABLED",
    "TUS_ENABLED",
    "ASSETS_TRANSFORM_MAX_CONCURRENT",
    "NPM_CONFIG_CACHE",
    "TEMP_PATH",
    "XDG_CACHE_HOME",
  ],
  frontend: ["NPM_CONFIG_CACHE"],
};
export const managedPodmanProductionEnvironment = {
  db: [],
  meilisearch: ["MEILI_ENV"],
  directus: [
    "SLK_ENV",
    "SLK_STARTUP_SECURITY_CHECKS",
    "WEBSOCKETS_ENABLED",
    "MCP_ENABLED",
    "AI_ENABLED",
    "IMPORT_IP_DENY_LIST",
    "CORS_ORIGIN",
  ],
  frontend: ["SLK_ENV", "TRUST_PROXY"],
};
type Service = keyof typeof managedPodmanEnvironment;
type SecretVersion = { digest: string; name: string };
export type SecretManifest = Record<string, SecretVersion>;
type SecretReference = { source: string; type: "env"; target: string };
export function podmanSecretPlan(
  inputs: Record<Service, Record<string, string>>,
  production: boolean,
  project: string,
  previous: SecretManifest = {},
) {
  const manifest: SecretManifest = {};
  const services: Record<string, { secrets: SecretReference[]; environment: Record<string, string> }> = {};
  const secrets: Record<string, { external: true }> = {};
  const values = new Map<string, string>();
  for (const service of Object.keys(inputs) as Service[]) {
    const managed = new Set<string>([
      ...managedPodmanEnvironment[service],
      ...(production
        ? managedPodmanProductionEnvironment[service]
        : service === "directus" || service === "frontend"
          ? ["SLK_ENV"]
          : []),
    ]);
    const refs: SecretReference[] = [];
    const empty: Record<string, string> = {};
    for (const [key, value] of Object.entries(inputs[service]).sort(([a], [b]) => a.localeCompare(b))) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || value.includes("\0") || Buffer.byteLength(value) > 512000)
        throw new Error("Invalid Podman environment secret");
      if (managed.has(key)) continue;
      if (value === "") {
        empty[key] = "";
        continue;
      }
      const id = service + ":" + key;
      const digest = createHash("sha256").update(value).digest("hex");
      const old = previous[id];
      const name =
        old?.digest === digest && /^slk_[a-z0-9_-]+_[a-f0-9]{32}$/.test(old.name)
          ? old.name
          : "slk_" + project.slice(0, 32) + "_" + randomUUID().replaceAll("-", "");
      manifest[id] = { digest, name };
      secrets[name] = { external: true };
      values.set(name, value);
      refs.push({ source: name, type: "env", target: key });
    }
    services[service] = { secrets: refs, environment: empty };
  }
  // Builder and server must receive byte-identical environment values.
  services["frontend-build"] = services.frontend!;
  return { manifest, overlay: { services, secrets }, values };
}
function privateDirectory(path: string): void {
  if (!isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path)) throw new Error("Invalid private Podman directory");
  mkdirSync(path, { mode: 0o700, recursive: true });
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0)
    throw new Error("Private Podman state directory required");
}
function writePrivate(path: string, value: unknown): void {
  const temporary = path + "." + randomUUID();
  writeFileSync(temporary, JSON.stringify(value) + "\n", { mode: 0o600, flag: "wx" });
  renameSync(temporary, path);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [environment, project, synchronize] = process.argv.slice(2);
    if (
      !["production", "development"].includes(environment || "") ||
      !project ||
      !/^[a-z0-9][a-z0-9_-]+$/.test(project)
    )
      throw new Error("Invalid Podman secret context");
    const require = createRequire(new URL("../../src/directus/cli/package.json", import.meta.url));
    const dotenv = require("dotenv") as { parse: (value: string) => Record<string, string> };
    const load = (path: string) => {
      assertPrivatePodmanFile(lstatSync(path), process.getuid!());
      return dotenv.parse(readFileSync(path, "utf8"));
    };
    const meili = load(process.env.SLK_PODMAN_MEILI_ENV_FILE || "docker/meilisearch/.env");
    const inputs = {
      db: load(process.env.SLK_PODMAN_DB_ENV_FILE || "docker/db/.env"),
      meilisearch: meili,
      directus: { ...load(process.env.SLK_PODMAN_DIRECTUS_ENV_FILE || "src/directus/.env"), ...meili },
      frontend: { ...load(process.env.SLK_PODMAN_FRONTEND_ENV_FILE || "src/frontend/.env"), ...meili },
    };
    const stateRoot = process.env.XDG_STATE_HOME || resolve(homedir(), ".local/state");
    const runtime = process.env.XDG_RUNTIME_DIR;
    if (!isAbsolute(stateRoot) || !runtime || !isAbsolute(runtime))
      throw new Error("Private state/runtime paths required");
    const directory = resolve(stateRoot, "slk-podman", project);
    privateDirectory(directory);
    const manifestPath = resolve(directory, "secrets.json");
    let previous: SecretManifest = {};
    if (lstatSync(manifestPath, { throwIfNoEntry: false })) {
      assertPrivatePodmanFile(lstatSync(manifestPath), process.getuid!());
      const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid secret manifest");
      for (const [key, item] of Object.entries(parsed)) {
        if (
          !item ||
          typeof item !== "object" ||
          !("name" in item) ||
          typeof item.name !== "string" ||
          !("digest" in item) ||
          typeof item.digest !== "string"
        )
          throw new Error("Invalid secret version");
        previous[key] = { name: item.name, digest: item.digest };
      }
    }
    const plan = podmanSecretPlan(inputs, environment === "production", project, previous);
    if (synchronize === "sync") {
      for (const [name, value] of plan.values) {
        const exists = spawnSync("podman", ["--remote=false", "secret", "inspect", name], { stdio: "ignore" });
        if (exists.status !== 0)
          execFileSync("podman", ["--remote=false", "secret", "create", name, "-"], {
            input: value,
            stdio: ["pipe", "ignore", "pipe"],
          });
      }
    }
    writePrivate(manifestPath, plan.manifest);
    const runtimeDirectory = resolve(runtime, "slk-podman");
    privateDirectory(runtimeDirectory);
    const output = resolve(runtimeDirectory, project + ".secrets.compose.json");
    writePrivate(output, plan.overlay);
    process.stdout.write(output + "\n");
  } catch {
    // Do not serialize parse/provider exceptions or their command arguments/stdin.
    process.stderr.write(
      "Podman secret provisioning failed; check private env files, CLI dotenv dependencies and local secret storage.\n",
    );
    process.exitCode = 1;
  }
}
