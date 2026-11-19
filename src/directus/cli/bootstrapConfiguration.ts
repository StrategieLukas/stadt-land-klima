/** Import code-first configuration through an unpublished, core-only CMS server. */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as pause } from "node:timers/promises";
import { bootstrapAdministratorToken, needsBootstrapAdministrator, readBootstrapState } from "./bootstrapState.ts";

if (process.argv.includes("--recover-admin")) {
  let stage = "database inspection";
  try {
    if (
      needsBootstrapAdministrator(
        await readBootstrapState(),
        Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD),
      )
    ) {
      const token = bootstrapAdministratorToken(process.env);
      if (token) process.env.ADMIN_TOKEN = token;
      else delete process.env.ADMIN_TOKEN;
      stage = "loading pinned bootstrap services";
      const require = createRequire("/directus/package.json");
      const root = dirname(require.resolve("@directus/api/package.json"));
      const admin: unknown = await import(pathToFileURL(join(root, "dist/utils/create-admin.js")).href);
      const schema: unknown = await import(pathToFileURL(join(root, "dist/utils/get-schema.js")).href);
      if (
        !admin ||
        typeof admin !== "object" ||
        !("createAdmin" in admin) ||
        typeof admin.createAdmin !== "function" ||
        !schema ||
        typeof schema !== "object" ||
        !("getSchema" in schema) ||
        typeof schema.getSchema !== "function"
      )
        throw new Error("Pinned Directus bootstrap services are unavailable");
      stage = "reading the core schema";
      const coreSchema: unknown = await schema.getSchema();
      stage = "creating the first administrator";
      await admin.createAdmin(coreSchema);
      console.info("Recovered the first administrator in an empty, interrupted core bootstrap.");
    }
    process.exit(0);
  } catch {
    console.error(`Bootstrap administrator recovery failed during ${stage}; existing credentials were not reset.`);
    process.exit(1);
  }
}

const directory = mkdtempSync("/directus/.tmp/setup-");
const configPath = join(directory, "empty.env");
writeFileSync(configPath, "", { mode: 0o600 });
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  // Directus file configuration overrides process variables. Keep this private
  // phase independent of canonical dotenv path/extension/migration overrides.
  CONFIG_PATH: configPath,
  EXTENSIONS_PATH: directory,
  MIGRATIONS_PATH: directory,
  HOST: "127.0.0.1",
  PORT: "8055",
  FRONTEND_DIRECTUS_URL: "http://127.0.0.1:8055",
  DIRECTUS_URL: "http://127.0.0.1:8055",
};
if (
  needsBootstrapAdministrator(
    await readBootstrapState(),
    Boolean(environment.ADMIN_EMAIL && environment.ADMIN_PASSWORD),
  )
) {
  environment.ADMIN_TOKEN = bootstrapAdministratorToken(environment);
}
function execute(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env: environment, stdio: "inherit" });
    child.once("error", () => reject(new Error("CMS configuration command could not start")));
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error("CMS configuration command failed"))));
  });
}
await execute(process.execPath, ["/directus/cli.js", "bootstrap"]);
await execute(process.execPath, ["/directus/cli/bootstrapConfiguration.ts", "--recover-admin"]);
const server = spawn(process.execPath, ["/directus/cli.js", "start"], { env: environment, stdio: "inherit" });
let serverFailed = false;
server.once("error", () => {
  serverFailed = true;
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 180; attempt++) {
    if (serverFailed || server.exitCode !== null)
      throw new Error("Private configuration server stopped before readiness");
    try {
      // Import needs the database-backed API, independently of external SMTP.
      // The normal service still requires its complete /server/health check.
      if ((await fetch("http://127.0.0.1:8055/server/info", { signal: AbortSignal.timeout(1000) })).ok) {
        ready = true;
        break;
      }
    } catch {
      /* wait for this private server */
    }
    await pause(1000);
  }
  if (!ready) throw new Error("Private configuration server did not become ready");
  const operator = await fetch("http://127.0.0.1:8055/users/me", {
    headers: { Authorization: `Bearer ${environment.CLI_DIRECTUS_STATIC_TOKEN || ""}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!operator.ok) {
    if (!environment.ADMIN_EMAIL || !environment.ADMIN_PASSWORD)
      throw new Error("A valid CLI token or bootstrap administrator credentials are required");
    const login = await fetch("http://127.0.0.1:8055/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: environment.ADMIN_EMAIL, password: environment.ADMIN_PASSWORD }),
      signal: AbortSignal.timeout(5000),
    });
    if (!login.ok) throw new Error("Bootstrap administrator authentication failed");
    const result: unknown = await login.json();
    if (
      !result ||
      typeof result !== "object" ||
      !("data" in result) ||
      !result.data ||
      typeof result.data !== "object" ||
      !("access_token" in result.data) ||
      typeof result.data.access_token !== "string"
    )
      throw new Error("Bootstrap authentication returned an invalid response");
    // A short-lived access token exists only in this helper's child environment.
    // Existing static credentials are never rotated or written back to a mount.
    environment.CLI_DIRECTUS_STATIC_TOKEN = result.data.access_token;
  }
  await execute("/directus/cli/import-all.sh", []);
} finally {
  server.kill("SIGTERM");
  const deadline = Date.now() + 10000;
  while (server.exitCode === null && !serverFailed && Date.now() < deadline) await pause(100);
  if (server.exitCode === null) server.kill("SIGKILL");
  rmSync(directory, { recursive: true, force: true });
}
