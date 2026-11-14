/** Import code-first configuration through an unpublished, core-only CMS server. */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as pause } from "node:timers/promises";

const directory = "/directus/.tmp/setup-extensions";
mkdirSync(directory, { recursive: true, mode: 0o700 });
const environment: NodeJS.ProcessEnv = {
  ...process.env,
  EXTENSIONS_PATH: directory,
  MIGRATIONS_PATH: directory,
  FRONTEND_DIRECTUS_URL: "http://127.0.0.1:8055",
  DIRECTUS_URL: "http://127.0.0.1:8055",
};
function execute(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env: environment, stdio: "inherit" });
    child.once("error", () => reject(new Error("CMS configuration command could not start")));
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error("CMS configuration command failed"))));
  });
}
await execute(process.execPath, ["/directus/cli.js", "bootstrap"]);
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
      if ((await fetch("http://127.0.0.1:8055/server/health", { signal: AbortSignal.timeout(1000) })).ok) {
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
}
