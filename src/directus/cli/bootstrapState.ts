import pg from "pg";
import { setTimeout as pause } from "node:timers/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type BootstrapState = { tables: string[]; userCount: number };
const requiredTables = ["municipalities", "ratings_measures", "pages", "news_items", "blocks", "edit_states"];

export async function readBootstrapState(): Promise<BootstrapState> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const db = new pg.Client({
      host: process.env.DB_HOST || "db",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      connectionTimeoutMillis: 3000,
    });
    try {
      await db.connect();
      const tables = (
        await db.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = current_schema()")
      ).rows.map((row) => row.tablename);
      const userCount = tables.includes("directus_users")
        ? (await db.query<{ count: number }>("SELECT COUNT(*)::integer AS count FROM directus_users")).rows[0]!.count
        : 0;
      return { tables, userCount };
    } catch {
      if (attempt === 9)
        throw new Error("Cannot inspect the application schema; check database configuration and health");
      await pause(1000);
    } finally {
      await db.end().catch(() => {});
    }
  }
  throw new Error("Cannot inspect the application schema");
}

export function assertApplicationSchema(state: BootstrapState): void {
  if (!requiredTables.every((table) => state.tables.includes(table)))
    throw new Error(
      "Application schema is missing or incomplete. Run slk stack start --import with the same --env and options before starting Directus.",
    );
}

/** Repair only an interrupted, empty core bootstrap; never reset an existing account. */
export function needsBootstrapAdministrator(state: BootstrapState, hasCredentials: boolean): boolean {
  if (!Number.isSafeInteger(state.userCount) || state.userCount < 0) throw new Error("Invalid bootstrap user count");
  if (state.userCount > 0) return false;
  if (state.tables.some((table) => !table.startsWith("directus_") && table !== "spatial_ref_sys"))
    throw new Error(
      "Administrator recovery requires an empty core-only database; existing application data needs manual recovery",
    );
  if (!hasCredentials)
    throw new Error("Bootstrap administrator credentials are required to initialize this empty database");
  return true;
}

/** Initial credentials only: callers must first establish the empty-core guard. */
export function bootstrapAdministratorToken(environment: NodeJS.ProcessEnv): string | undefined {
  const token = environment.ADMIN_TOKEN || environment.CLI_DIRECTUS_STATIC_TOKEN;
  if (
    token &&
    (!/^[A-Za-z0-9_-]{32,255}$/.test(token) ||
      /^(?:replace-with-|change-me|some-random-|access_token_of_admin_user)/i.test(token))
  )
    throw new Error("Initial administrator token must be a strong non-placeholder token of 32 to 255 characters");
  return token;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assertApplicationSchema(await readBootstrapState());
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Application schema preflight failed");
    process.exitCode = 1;
  }
}
