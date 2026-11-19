/** Real fresh/partial bootstrap regression. All data lives in disposable tmpfs containers. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const name = "slk-bootstrap-test-" + randomUUID();
const database = name + "-db";
const cms = name + "-cms";
const image = process.env.SLK_BOOTSTRAP_TEST_IMAGE || "localhost/slk-podman-directus:local";
const token = randomBytes(32).toString("hex");
function invokePodman(args: string[], timeout = args[0] === "run" ? 300_000 : 30_000): string {
  const result = spawnSync("podman", ["--remote=false", ...args], {
    encoding: "utf8",
    timeout,
    killSignal: "SIGKILL",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `Disposable bootstrap Podman ${args[0]} failed (${result.error?.message || result.status}): ${result.stderr.slice(-4000).replaceAll(token, "<fixture-secret>")}`,
    );
  return result.stdout.trim();
}
const podman = (...args: string[]) => invokePodman(args);
const sql = (query: string) =>
  podman("exec", database, "psql", "-XAt", "-U", "bootstrap_test", "-d", "bootstrap_test", "-c", query);
async function waitFor(check: () => boolean) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      if (check()) return;
    } catch {
      /* wait for disposable service */
    }
    await pause(500);
  }
  throw new Error("Disposable bootstrap service did not become ready");
}
let networkCreated = false;
let regressionFailed = false;
try {
  console.info("Creating disposable bootstrap network and database");
  podman("network", "create", "--internal", name);
  networkCreated = true;
  podman(
    "run",
    "--detach",
    "--rm",
    "--name",
    database,
    "--network",
    name,
    "--network-alias",
    "db",
    "--userns=keep-id:uid=999,gid=999",
    "--user",
    "999:999",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--tmpfs",
    "/var/lib/postgresql/data:rw,U,mode=700,size=512m",
    "--tmpfs",
    "/var/run/postgresql:rw,U,mode=700,size=16m",
    "--env",
    "POSTGRES_USER=bootstrap_test",
    "--env",
    "POSTGRES_DB=bootstrap_test",
    "--env",
    `POSTGRES_PASSWORD=${token}`,
    "localhost/slk-podman-database:local",
  );
  await waitFor(() => sql("SELECT 1") === "1");
  console.info("Disposable database is ready");
  const mounts = [
    "src/directus/cli/bootstrapConfiguration.ts:/directus/cli/bootstrapConfiguration.ts",
    "src/directus/cli/bootstrapState.ts:/directus/cli/bootstrapState.ts",
    "src/directus/cli/logEmail.ts:/directus/cli/logEmail.ts",
    "src/directus/cli/tasks/import/importFolders.ts:/directus/cli/tasks/import/importFolders.ts",
    "src/directus/cli/tasks/import/index.ts:/directus/cli/tasks/import/index.ts",
    "src/directus/contents:/directus/contents",
    ...["dashboards", "roles", "policies", "presets", "webhooks", "templates", "translations", "flows", "settings"].map(
      (directory) => `src/directus/${directory}:/directus/${directory}`,
    ),
    "src/directus/schema:/directus/schema",
    "src/directus/migrations:/directus/migrations",
  ].flatMap((mount) => ["--volume", join(root, mount) + ":ro,z"]);
  const environment = {
    DB_CLIENT: "pg",
    DB_HOST: "db",
    DB_PORT: "5432",
    DB_USER: "bootstrap_test",
    DB_PASSWORD: token,
    DB_DATABASE: "bootstrap_test",
    SECRET: token + token,
    ADMIN_EMAIL: "bootstrap@example.com",
    ADMIN_PASSWORD: token,
    CLI_DIRECTUS_STATIC_TOKEN: token,
    FRONTEND_DIRECTUS_URL: "http://127.0.0.1:8055",
    DIRECTUS_URL: "http://127.0.0.1:8055",
    CONFIG_PATH: "/directus/.tmp/core/empty.env",
    MIGRATIONS_PATH: "/directus/.tmp/core",
    EXTENSIONS_PATH: "/directus/.tmp/core",
    HOST: "127.0.0.1",
    PORT: "8055",
    CACHE_ENABLED: "false",
    TELEMETRY: "false",
    SLK_ENV: "development",
    EMAIL_TRANSPORT: "sendmail",
    EMAIL_SENDMAIL_PATH: "/directus/cli/logEmail.ts",
  };
  podman(
    "run",
    "--detach",
    "--rm",
    "--name",
    cms,
    "--network",
    name,
    "--userns=keep-id:uid=1000,gid=1000",
    "--user",
    "1000:1000",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--tmpfs",
    "/directus/.tmp:rw,U,mode=700,size=128m",
    ...mounts,
    ...Object.entries(environment).flatMap(([key, value]) => ["--env", `${key}=${value}`]),
    "--entrypoint",
    "sh",
    image,
    "-ec",
    "mkdir /directus/.tmp/core; touch /directus/.tmp/core/empty.env; node /directus/cli.js bootstrap --skipAdminInit; touch /directus/.tmp/ready; exec sleep 3600",
  );
  await waitFor(() => podman("exec", cms, "test", "-f", "/directus/.tmp/ready") === "");
  console.info("Disposable interrupted core bootstrap is ready");
  assert.equal(sql("SELECT COUNT(*) FROM directus_users"), "0");
  const missing = spawnSync("podman", ["--remote=false", "exec", cms, "node", "/directus/cli/bootstrapState.ts"], {
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /stack start --import/);
  assert.equal(sql("SELECT COUNT(*) FROM directus_users"), "0", "schema check must not create an administrator");
  podman("exec", cms, "node", "/directus/cli/bootstrapConfiguration.ts", "--recover-admin");
  assert.equal(sql("SELECT COUNT(*) FROM directus_users"), "1");
  assert.equal(sql("SELECT token FROM directus_users"), token, "the configured initial CLI token must authenticate");
  const password = sql("SELECT password FROM directus_users");
  podman("exec", cms, "node", "/directus/cli/bootstrapConfiguration.ts", "--recover-admin");
  assert.equal(sql("SELECT COUNT(*) FROM directus_users"), "1");
  assert.equal(sql("SELECT password FROM directus_users"), password, "existing credentials must not be reset");
  console.info("PASS interrupted core bootstrap recovers exactly one administrator without resetting credentials");
  console.info("Checking the complete private YAML import helper");
  invokePodman(
    [
      "exec",
      "--env",
      "EMAIL_TRANSPORT=smtp",
      "--env",
      "EMAIL_SMTP_HOST=127.0.0.1",
      "--env",
      "EMAIL_SMTP_PORT=1",
      "--env",
      "EMAIL_SMTP_SECURE=false",
      "--env",
      "EMAIL_VERIFY_SETUP=false",
      cms,
      "node",
      "/directus/cli/bootstrapConfiguration.ts",
    ],
    300_000,
  );
  console.info(
    "PASS complete private configuration import finishes before application migrations without requiring SMTP",
  );
  podman("exec", "--detach", cms, "node", "/directus/cli.js", "start");
  await waitFor(
    () =>
      podman(
        "exec",
        cms,
        "node",
        "--input-type=module",
        "-e",
        "const r=await fetch('http://127.0.0.1:8055/server/health');if(!r.ok)process.exit(1)",
      ) === "",
  );
  const mailProbe = `
    import {createRequire} from 'node:module'; import {dirname,join} from 'node:path'; import {pathToFileURL} from 'node:url';
    const root=dirname(createRequire('/directus/package.json').resolve('@directus/api/package.json'));
    const {default:getMailer}=await import(pathToFileURL(join(root,'dist/mailer.js')).href);
    await getMailer().sendMail({from:'no-reply@example.com',to:'capture@example.com',subject:'SLK development email fixture',text:'Captured locally'});
  `;
  podman("exec", cms, "node", "--input-type=module", "-e", mailProbe);
  const mailLog = podman("logs", cms);
  assert.match(mailLog, /development\.email/);
  assert.match(mailLog, /SLK development email fixture/);
  console.info("PASS native Directus sendmail transport captures development email in container logs");
  invokePodman(["exec", cms, "node", "/directus/cli/index.mjs", "import:schema", "/directus/schema"], 300_000);
  podman("exec", cms, "node", "/directus/cli/index.mjs", "import:folders", "/directus/contents/directus_folders.yaml");
  assert.equal(sql("SELECT COUNT(*) FROM directus_folders WHERE name='public'"), "1");
  podman("exec", cms, "node", "/directus/cli/index.mjs", "import:folders", "/directus/contents/directus_folders.yaml");
  assert.equal(sql("SELECT COUNT(*) FROM directus_folders WHERE name='public'"), "1");
  podman("exec", cms, "node", "/directus/cli/bootstrapState.ts");
  console.info("PASS canonical YAML schema import passes the startup preflight");
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const teams = ids.map(() => randomUUID());
  sql(
    `INSERT INTO localteams(id,name) VALUES ${teams.map((id, index) => `('${id}','Bootstrap fixture ${index}')`).join(",")}`,
  );
  sql(
    `INSERT INTO municipalities(id,name,localteam_id,creator_verified,preview_token) VALUES ('${ids[0]}','Unverified fixture','${teams[0]}',false,NULL),('${ids[1]}','Verified fixture','${teams[1]}',true,NULL),('${ids[2]}','Existing token fixture','${teams[2]}',false,'existing-preview')`,
  );
  const migration = `
    import {createRequire} from 'node:module'; import {dirname,join} from 'node:path'; import {pathToFileURL} from 'node:url';
    const root=dirname(createRequire('/directus/package.json').resolve('@directus/api/package.json'));
    const {default:getDatabase}=await import(pathToFileURL(join(root,'dist/database/index.js')).href);
    const {up}=await import('/directus/migrations/20260623A-backfill_municipality_preview_tokens.js');
    const {up:moveImages}=await import('/directus/migrations/20260723A-move_unfiled_images_to_public_folder.js');
    const db=getDatabase(); try {await up(db);await moveImages(db)} finally {await db.destroy()}
  `;
  podman("exec", cms, "node", "--input-type=module", "-e", migration);
  assert.equal(sql(`SELECT preview_token ~ '^[a-f0-9]{64}$' FROM municipalities WHERE id='${ids[0]}'`), "t");
  assert.equal(sql(`SELECT preview_token IS NULL FROM municipalities WHERE id='${ids[1]}'`), "t");
  assert.equal(sql(`SELECT preview_token FROM municipalities WHERE id='${ids[2]}'`), "existing-preview");
  const minted = sql(`SELECT preview_token FROM municipalities WHERE id='${ids[0]}'`);
  podman("exec", cms, "node", "--input-type=module", "-e", migration);
  assert.equal(sql(`SELECT preview_token FROM municipalities WHERE id='${ids[0]}'`), minted);
  console.info("PASS preview migration runs after import, preserves existing tokens and skips verified municipalities");
} catch (error) {
  regressionFailed = true;
  throw error;
} finally {
  let cleanupFailed = false;
  for (const container of [cms, database]) {
    try {
      podman("rm", "--force", "--volumes", container);
    } catch {
      cleanupFailed = true;
      console.error(`Could not remove disposable bootstrap container ${container}; check the Podman runtime`);
    }
  }
  if (networkCreated) {
    try {
      podman("network", "rm", name);
    } catch {
      cleanupFailed = true;
      console.error(`Could not remove disposable bootstrap network ${name}; check the Podman runtime`);
    }
  }
  if (cleanupFailed && !regressionFailed) throw new Error("Disposable bootstrap cleanup failed");
}
