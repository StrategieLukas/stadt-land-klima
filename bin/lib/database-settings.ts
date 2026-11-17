import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/** The CMS selects the application database; POSTGRES_DB only initializes a datastore. */
export function databaseSettings() {
  const env = dotenv.parse(
    readFileSync(
      process.env.SLK_PODMAN_DIRECTUS_ENV_FILE || fileURLToPath(new URL("../../src/directus/.env", import.meta.url)),
    ),
  );
  const database = env.DB_DATABASE ?? process.env.DB_DATABASE;
  if (
    !database ||
    Buffer.byteLength(database) > 63 ||
    /[\0\r\n=]/.test(database) ||
    database.startsWith("-") ||
    database.includes("://")
  )
    throw new Error(
      "A database name (DB_DATABASE), rather than a connection string, is required in the private Directus environment.",
    );
  return {
    database,
    port: env.DB_PORT ?? process.env.DB_PORT ?? "5432",
    user: env.DB_USER ?? process.env.DB_USER ?? "",
  };
}
