import pg from "pg";

export const CONCEALED_TOKEN = "**********";
export type StoredTokenReader = (identity: {
  id: string;
  role: string;
  email: string | null;
  status: string;
}) => Promise<string | null>;

/** Private operator CLI access, never an HTTP endpoint or a configuration writer. */
export function createStoredTokenReader() {
  const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10_000,
  });
  const read: StoredTokenReader = async ({ id, role, email, status }) => {
    const result = await pool.query<{ token: string | null }>(
      "SELECT token FROM directus_users WHERE id=$1 AND role=$2 AND email IS NOT DISTINCT FROM $3 AND status=$4",
      [id, role, email, status],
    );
    if (result.rowCount !== 1) throw new Error("Stored credential identity changed; review it explicitly");
    return result.rows[0]!.token;
  };
  return { read, close: () => pool.end() };
}
