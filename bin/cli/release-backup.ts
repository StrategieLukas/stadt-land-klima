import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CommandError, run } from "./process.ts";

const dump =
  'exec pg_dump -U "${POSTGRES_USER:?POSTGRES_USER is required}" -d "${POSTGRES_DB:?POSTGRES_DB is required}" -Fc';
// Existing native-secret containers already receive POSTGRES_* in their process
// environment. New containers must load their private mounts before the dump.
// A present but failing loader must never fall back to stale inherited settings.
export const releaseDatabaseDumpCommand = [
  "sh",
  "-ec",
  `if command -v slk-env >/dev/null 2>&1; then exec slk-env sh -ec '${dump}'; fi; ${dump}`,
];

export async function releaseDatabaseDump(container: string): Promise<void> {
  if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error("Expected one running release database container ID");
  // Stream the binary archive directly to the coordinator's private output file.
  // Neither credentials nor the dump pass through argv, JSON or an in-memory log.
  await run("podman", ["--remote=false", "exec", container, ...releaseDatabaseDumpCommand], { output: 1 });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error("Expected a release database container ID");
    await releaseDatabaseDump(process.argv[2]!);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Release database backup failed");
    process.exitCode = error instanceof CommandError ? error.code : 1;
  }
}
