/** Read-only runtime mounts: provider arguments contain paths, never dotenv values. */
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import dotenv from "dotenv";
import { translationDeploymentTarget } from "../../src/frontend/shared/runtimeEnvironment.mts";
import { randomUUID } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPrivatePodmanFile } from "./podman-security.ts";

export const managedPodmanEnvironment = {
  db: [],
  meilisearch: ["MEILI_NO_ANALYTICS"],
  directus: [
    "SLK_DEPLOYMENT_TARGET",
    "DB_OPTIONS",
    "CACHE_AUTO_PURGE",
    "LOGGER_HTTP_AUTO_LOGGING",
    "LOG_STYLE",
    "LOG_LEVEL",
    "CACHE_ENABLED",
    "TUS_ENABLED",
    "NPM_CONFIG_CACHE",
    "TEMP_PATH",
    "PM2_HOME",
    "XDG_CACHE_HOME",
  ],
  frontend: ["NPM_CONFIG_CACHE", "SLK_DEPLOYMENT_TARGET"],
};
export const managedPodmanProductionEnvironment = {
  db: [],
  meilisearch: ["MEILI_ENV"],
  directus: ["SLK_ENV", "SLK_STARTUP_SECURITY_CHECKS", "WEBSOCKETS_ENABLED", "MCP_ENABLED", "IMPORT_IP_DENY_LIST"],
  frontend: ["SLK_ENV", "NODE_ENV", "TRUST_PROXY"],
};
export const managedPodmanDevelopmentEnvironment = {
  db: [],
  meilisearch: [],
  directus: ["SLK_ENV", "CONFIG_PATH", "EMAIL_TRANSPORT", "EMAIL_SENDMAIL_PATH"],
  frontend: ["SLK_ENV"],
};

export function podmanEnvironmentPlan(
  paths: Record<"db" | "meilisearch" | "directus" | "frontend", string>,
  production: boolean,
  target?: string,
) {
  const services: Record<string, { volumes: string[]; environment: Record<string, string> }> = {};
  for (const service of Object.keys(paths) as (keyof typeof paths)[]) {
    const inputs = service === "directus" || service === "frontend" ? ([service, "meilisearch"] as const) : [service];
    const files = inputs.map((input) => `/run/slk-env/${input}.env`);
    const locked = [
      ...managedPodmanEnvironment[service],
      ...(production ? managedPodmanProductionEnvironment[service] : managedPodmanDevelopmentEnvironment[service]),
    ];
    services[service] = {
      volumes: [
        ...inputs.map((input, index) => `${paths[input as keyof typeof paths]}:${files[index]}:ro,z`),
        ...(service === "frontend" ? [`${paths.frontend}:/frontend/.env:ro,z`] : []),
      ],
      environment: {
        SLK_ENV_FILES: files.join(":"),
        SLK_ENV_LOCKED_KEYS: locked.join(","),
        ...(service === "frontend" || service === "directus"
          ? { SLK_DEPLOYMENT_TARGET: translationDeploymentTarget(production ? "production" : "development", target) }
          : {}),
      },
    };
  }
  // Build artifacts contain defaults only. No runtime env files or credentials enter builds.
  return { services };
}

/** Inspect the library's effective configuration, not just the inherited process environment. */
export function directusRuntimeConfigProbe(root = "/directus") {
  return `
    const {createRequire}=await import('node:module');
    const {existsSync}=await import('node:fs');
    const {join}=await import('node:path');
    const root=${JSON.stringify(root)};
    if(existsSync(join(root,'.env'))) throw Error('Directus must not autoload a second .env file');
    const require=createRequire(join(root,'package.json'));
    const api=createRequire(require.resolve('@directus/api/package.json'));
    const env=api('@directus/env').useEnv();
    const flags=['CACHE_ENABLED','TUS_ENABLED','WEBSOCKETS_ENABLED','MCP_ENABLED'];
    const unsafe=flags.filter(key=>env[key]!==false);
    if(unsafe.length) throw Error('Effective Directus protections are not disabled: '+unsafe.join(','));
    console.log('Effective Directus cache, TUS, WebSocket and MCP protections verified.');
  `;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [environment, project] = process.argv.slice(2);
    if (
      !["production", "development"].includes(environment || "") ||
      !project ||
      !/^[a-z0-9][a-z0-9_-]+$/.test(project)
    )
      throw new Error("Invalid runtime context");
    const paths = {
      db: resolve(process.env.SLK_PODMAN_DB_ENV_FILE || "podman/database/.env"),
      meilisearch: resolve(process.env.SLK_PODMAN_MEILI_ENV_FILE || "podman/meilisearch/.env"),
      directus: resolve(process.env.SLK_PODMAN_DIRECTUS_ENV_FILE || "src/directus/.env"),
      frontend: resolve(process.env.SLK_PODMAN_FRONTEND_ENV_FILE || "src/frontend/.env"),
    };
    for (const path of Object.values(paths)) {
      if (/[\x00-\x1f\x7f:]/.test(path)) throw new Error("Invalid environment path");
      assertPrivatePodmanFile(lstatSync(path), process.getuid!());
    }
    const runtime = process.env.XDG_RUNTIME_DIR;
    if (!runtime || !isAbsolute(runtime)) throw new Error("Private runtime directory required");
    const directory = resolve(runtime, "slk-podman");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.uid !== process.getuid?.() || stat.mode & 0o077)
      throw new Error("Private runtime directory required");
    const output = resolve(directory, project + ".environment.compose.json");
    const temporary = output + "." + randomUUID();
    const metadata = resolve(directory, project + ".maintenance-meta.js");
    if (!existsSync(metadata))
      writeFileSync(metadata, "// Public runtime metadata is generated at service start.\n", {
        mode: 0o600,
        flag: "wx",
      });
    const target =
      process.env.SLK_DEPLOYMENT_TARGET ?? dotenv.parse(readFileSync(paths.frontend)).SLK_DEPLOYMENT_TARGET;
    const plan = podmanEnvironmentPlan(paths, environment === "production", target);
    plan.services.maintenance = { volumes: [`${metadata}:/srv/maintenance-meta.js:ro,z`], environment: {} };
    writeFileSync(temporary, JSON.stringify(plan) + "\n", { mode: 0o600, flag: "wx" });
    renameSync(temporary, output);
    process.stdout.write(output + "\n");
  } catch {
    process.stderr.write(
      "Podman runtime mounts could not be prepared; check private environment files and runtime directory.\n",
    );
    process.exitCode = 1;
  }
}
