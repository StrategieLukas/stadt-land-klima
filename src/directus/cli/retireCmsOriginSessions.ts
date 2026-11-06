import pg from "pg";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type SessionQuery = (
  sql: string,
  parameters: string[],
) => Promise<{ rowCount: number | null; rows: { count: string }[] }>;

/** Retire only interactive user sessions created by the old browser origin. */
export async function retireCmsOriginSessions(
  query: SessionQuery,
  oldOrigin: string,
  newOrigin: string,
  apply = false,
) {
  const from = new URL(oldOrigin);
  const to = new URL(newOrigin);
  if (
    from.origin !== oldOrigin ||
    to.origin !== newOrigin ||
    from.protocol !== "https:" ||
    to.protocol !== "https:" ||
    from.origin === to.origin
  )
    throw Error("Two distinct HTTPS origins are required");
  const predicate = '"user" IS NOT NULL AND "share" IS NULL AND origin = $1';
  const before = await query(`SELECT count(*)::text AS count FROM directus_sessions WHERE ${predicate}`, [oldOrigin]);
  const count = Number(before.rows[0]?.count);
  if (!Number.isSafeInteger(count) || count < 0) throw Error("Invalid session inventory");
  if (!apply) return { apply: false, sessions: count, retired: 0 };
  const removed = await query(`DELETE FROM directus_sessions WHERE ${predicate}`, [oldOrigin]);
  return { apply: true, sessions: count, retired: removed.rowCount ?? 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const [oldOrigin, newOrigin, action] = process.argv.slice(2);
    if (!oldOrigin || !newOrigin || ![undefined, "--apply"].includes(action))
      throw Error("Invalid session retirement arguments");
    if (action === "--apply" && process.env.PUBLIC_URL !== newOrigin)
      throw Error("CMS must already use the new origin");
    const result = await retireCmsOriginSessions(
      (sql, parameters) => pool.query<{ count: string }>(sql, parameters),
      oldOrigin,
      newOrigin,
      action === "--apply",
    );
    console.log(JSON.stringify(result));
  } catch {
    console.error("CMS session retirement failed; credentials and database details are withheld");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
