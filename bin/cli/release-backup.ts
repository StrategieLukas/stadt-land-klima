import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CommandError, run } from "./process.ts";
import { databaseSettings } from "../lib/database-settings.ts";
import { writeFileSync, existsSync } from "node:fs";
import { root } from "./process.ts";
import { checkedDataCounts } from "./release-checkpoint.ts";

export const applicationCountsSql = `SELECT json_build_object(
 'municipalities',(SELECT count(*) FROM municipalities),
 'elections',(SELECT count(*) FROM elections),
 'content_translation_memory',(SELECT count(*) FROM content_translation_memory));`;

export function releaseSqlCommand(database: string, sql: string) {
  const query = 'exec psql -X -q -At -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:?}" -d "$1" -c "$2"';
  return [
    "sh",
    "-ec",
    `if command -v slk-env >/dev/null 2>&1; then exec slk-env sh -ec '${query}' slk-query "$@"; fi; ${query}`,
    "slk-query",
    database,
    sql,
  ];
}

const dump = 'exec pg_dump -U "${POSTGRES_USER:?POSTGRES_USER is required}" -d "$1" -Fc';
// Existing native-secret containers already receive POSTGRES_* in their process
// environment. New containers must load their private mounts before the dump.
// A present but failing loader must never fall back to stale inherited settings.
export const releaseDatabaseDumpCommand = [
  "sh",
  "-ec",
  `if command -v slk-env >/dev/null 2>&1; then exec slk-env sh -ec '${dump}' slk-release-backup "$1"; fi; ${dump}`,
  "slk-release-backup",
];

export async function releaseDatabaseDump(container: string, metadata?: string): Promise<void> {
  if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error("Expected one running release database container ID");
  // Stream the binary archive directly to the coordinator's private output file.
  // Neither credentials nor the dump pass through argv, JSON or an in-memory log.
  const { database } = databaseSettings();
  const counts = async () =>
    checkedDataCounts(
      JSON.parse(
        await run(
          "podman",
          ["--remote=false", "exec", container, ...releaseSqlCommand(database, applicationCountsSql)],
          { capture: true },
        ),
      ),
    );
  const before = metadata ? await counts() : undefined;
  await run("podman", ["--remote=false", "exec", container, ...releaseDatabaseDumpCommand, database], { output: 1 });
  if (metadata) {
    const after = await counts();
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw new Error("Application row counts changed during the backup; retry before deploying");
    writeFileSync(metadata, JSON.stringify(before) + "\n", { mode: 0o600 });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === "private-env" && process.argv.length === 3) {
      for (const path of new Set([
        process.env.SLK_PODMAN_DIRECTUS_ENV_FILE || resolve(root, "src/directus/.env"),
        process.env.SLK_PODMAN_FRONTEND_ENV_FILE || resolve(root, "src/frontend/.env"),
        process.env.SLK_PODMAN_MEILI_ENV_FILE || resolve(root, "podman/meilisearch/.env"),
        process.env.SLK_PODMAN_DB_ENV_FILE || resolve(root, "podman/database/.env"),
        resolve(root, "podman/core-storage/production.compose.json"),
      ]))
        if (existsSync(path)) process.stdout.write(path + "\0");
    } else {
      if (process.argv.length !== 3 && !(process.argv.length === 5 && process.argv[3] === "--metadata"))
        throw new Error("Expected a release database container ID and optional --metadata path");
      await releaseDatabaseDump(process.argv[2]!, process.argv[4]);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Release database backup failed");
    process.exitCode = error instanceof CommandError ? error.code : 1;
  }
}
