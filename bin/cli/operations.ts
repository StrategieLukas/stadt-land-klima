import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { dirname, basename, join, isAbsolute } from "node:path";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import dotenv from "dotenv";
import { run, node, root, type Environment } from "./process.ts";
import { runtime, maintenance, performStack, type Runtime, type StackOptions } from "./stack.ts";

function databaseSettings() {
  const env = dotenv.parse(readFileSync(process.env.SLK_PODMAN_DIRECTUS_ENV_FILE || join(root, "src/directus/.env")));
  const database = env.DB_DATABASE ?? process.env.DB_DATABASE;
  if (!database) throw new Error("DB_DATABASE is required in the private Directus environment.");
  return {
    database,
    port: env.DB_PORT ?? process.env.DB_PORT ?? "5432",
    user: env.DB_USER ?? process.env.DB_USER ?? "",
  };
}
export async function databaseTransfer(
  rt: Runtime,
  action: "export" | "import" | "sql",
  args: string[],
  output?: number,
) {
  const { database, port, user } = databaseSettings();
  const command = action === "export" ? "pg_dump --clean" : action === "import" ? "psql -v ON_ERROR_STOP=1" : "psql";
  const role = action === "sql" ? user : '"$POSTGRES_USER"';
  if (action === "sql" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(user))
    throw new Error("Unsupported application role identifier");
  return rt.compose(
    [
      "exec",
      "-T",
      "db",
      "sh",
      "-ec",
      `port=$1; database=$2; shift 2; exec ${command} -p "$port" -U ${role} -d "$database" "$@"`,
      "sh",
      port,
      database,
      ...args,
    ],
    output === undefined ? {} : { output },
  );
}
export async function sanitize(rt: Runtime) {
  const { database, port, user } = databaseSettings();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(user)) throw new Error("Unsupported application role identifier");
  const operator = await rt.compose(["exec", "-T", "db", "sh", "-ec", 'printf "%s" "$POSTGRES_USER"'], {
    capture: true,
  });
  const temporary = `slk_sanitized_export_${process.pid}`;
  const directory = mkdtempSync(join(tmpdir(), "slk-sanitized-"));
  const execute = (sql: string) =>
    rt.compose(
      ["exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-q", "-U", operator, "-d", "postgres", "-c", sql],
      { quiet: true },
    );
  try {
    console.error(`Creating temporary sanitized database ${temporary}...`);
    await execute(`CREATE DATABASE "${temporary}" OWNER "${user}";`);
    const dump = join(directory, "source.sql");
    let fd = openSync(dump, "w", 0o600);
    try {
      await rt.compose(
        ["exec", "-T", "db", "pg_dump", "--no-owner", "--no-privileges", "-p", port, "-U", operator, "-d", database],
        { output: fd },
      );
    } finally {
      closeSync(fd);
    }
    fd = openSync(dump, "r");
    try {
      await rt.compose(["exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-q", "-U", operator, "-d", temporary], {
        input: fd,
        quiet: true,
      });
    } finally {
      closeSync(fd);
    }
    await rt.compose(["exec", "-T", "db", "psql", "-v", "ON_ERROR_STOP=1", "-q", "-U", operator, "-d", temporary], {
      input: readFileSync(join(root, "bin/db_exports/strip_personal_data.sql"), "utf8"),
      quiet: true,
    });
    await rt.compose([
      "exec",
      "-T",
      "db",
      "pg_dump",
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "-p",
      port,
      "-U",
      operator,
      "-d",
      temporary,
    ]);
  } finally {
    await execute(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${temporary}' AND pid <> pg_backend_pid();`,
    ).catch(() => {});
    await execute(`DROP DATABASE IF EXISTS "${temporary}";`).catch(() => {});
    rmSync(directory, { recursive: true, force: true });
  }
}
export async function migrate(rt: Runtime) {
  const services = await rt.raw(["ps", "--status", "running", "--services"], { capture: true });
  if (!["directus", "db"].every((service) => services.split("\n").includes(service)))
    throw new Error("Start the existing Directus/database deployment before migrating.");
  const directory = join(root, "../backups");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const backup = join(directory, `pre-directus-migrations-${Date.now()}.sql`),
    partial = backup + ".partial";
  const fd = openSync(partial, "wx", 0o600);
  try {
    await databaseTransfer(rt, "export", [], fd);
  } finally {
    closeSync(fd);
  }
  const { renameSync } = await import("node:fs");
  renameSync(partial, backup);
  console.log(`Database backup saved: ${backup}`);
  await rt.compose(["exec", "-T", "directus", "/directus/cli/import-all.sh"]);
  await rt.compose([
    "exec",
    "-T",
    "-w",
    "/directus",
    "directus",
    "node",
    "/directus/cli.js",
    "database",
    "migrate:latest",
  ]);
}
export async function databaseRole(rt: Runtime, args: string[]) {
  const [action, plan, role] = args;
  if (
    !plan ||
    !isAbsolute(plan) ||
    plan.includes(":") ||
    !((action === "plan" && role && args.length === 3) || (action === "apply" && args.length === 2))
  )
    throw new Error(
      "Use database role -- plan /absolute/private/plan.json new_role, or -- apply /absolute/private/plan.json",
    );
  accessSync(dirname(plan), constants.R_OK | constants.W_OK);
  if (action === "apply") {
    const services = await rt.raw(["ps", "--status", "running", "--services"], { capture: true });
    if (services.split("\n").some((service) => ["directus", "frontend"].includes(service)))
      throw new Error("Stop Directus and frontend before apply. Keep the database running.");
  }
  await rt.raw([
    "run",
    "--rm",
    "--no-deps",
    "--entrypoint",
    "/usr/local/bin/slk-env",
    "--user",
    "1000:1000",
    "-v",
    `${dirname(plan)}:/security-plan`,
    "directus",
    "node",
    "/directus/cli/tasks/hardenDatabaseRole.ts",
    action,
    `/security-plan/${basename(plan)}`,
    ...(role ? [role] : []),
  ]);
}
export async function extensions(build: boolean) {
  const { readdirSync } = await import("node:fs");
  for (const name of readdirSync(join(root, "src/directus/extensions")).sort()) {
    const directory = join(root, "src/directus/extensions", name);
    if (existsSync(join(directory, "package.json")))
      await run("npm", ["--prefix", directory, "run", build ? "build" : "typecheck"]);
  }
}
export async function tests(target: string, args: string[]) {
  const directory = join(root, "bin/test_suite");
  if (!existsSync(join(directory, "node_modules"))) await run("npm", ["ci"], { cwd: directory });
  if (["dev", "full", "staging"].includes(target)) {
    const require = createRequire(join(directory, "package.json"));
    const { chromium } = require("playwright") as { chromium: { executablePath: () => string } };
    if (!existsSync(chromium.executablePath()))
      await run("npm", ["exec", "--", "playwright", "install", "chromium"], { cwd: directory });

    await run("npm", ["run", "test:unit"], { cwd: directory });
    const staging = target === "staging";
    return run(
      "npm",
      [
        "exec",
        "--",
        "tsx",
        "src/run.ts",
        process.env.SLK_TEST_BACKEND_URL ||
          (staging ? "https://staging.stadt-land-klima.de/backend" : "http://localhost:8081"),
        process.env.SLK_TEST_FRONTEND_URL ||
          (staging ? "https://staging.stadt-land-klima.de" : "http://localhost:8080"),
        process.env.SLK_PODMAN_DIRECTUS_ENV_FILE || join(root, "src/directus/.env"),
        ...(target === "dev" ? [] : ["--full"]),
        ...args,
      ],
      { cwd: directory },
    );
  }
  const commands: Record<string, string> = {
    unit: "test:unit",
    podman: "test:podman",
    caddy: "test:security:caddy",
    dependencies: "audit:dependencies",
    images: "audit:directus-image:reviewed",
    logical: "test:core:logical",
    runtime: "test:runtime-environment",
  };
  const command = commands[target];
  if (!command) throw new Error("Unknown test target");
  return run("npm", ["run", command, ...(args.length ? ["--", ...args] : [])], { cwd: directory });
}
export async function update(
  environment: Environment,
  options: StackOptions & { noRestart?: boolean; noBackup?: boolean },
) {
  if (environment === "production" && !options.noBackup) {
    const rt = await runtime(environment),
      directory = join(root, "../backups");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, `backupOnUpdate-${Date.now()}.sql`),
      fd = openSync(path, "wx", 0o600);
    try {
      await databaseTransfer(rt, "export", [], fd);
    } finally {
      closeSync(fd);
    }
    console.log(`Backup saved: ${path}`);
  }
  await run("git", ["pull"]);
  await run("git", ["submodule", "init"]);
  await run("git", ["submodule", "sync", "--recursive"]);
  await run("git", ["submodule", "update", "--recursive"]);
  if (options.noRestart) return;
  if (environment === "production") await maintenance(await runtime(environment));
  await performStack(environment, "build", [], options);
  await performStack(environment, "start", [], { import: environment === "production" });
}
