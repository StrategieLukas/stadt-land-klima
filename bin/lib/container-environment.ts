import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export type EnvironmentContainer = {
  Config: { Env?: string[] };
  Mounts: Array<{ Source?: string; Destination: string }>;
};
/** Read the effective mounted values without placing them in engine argv or Config.Env. */
export function containerEnvironment(container: EnvironmentContainer): Record<string, string> {
  const inherited = Object.fromEntries(
    (container.Config.Env ?? []).map((entry) => {
      const at = entry.indexOf("=");
      return [entry.slice(0, at), entry.slice(at + 1)];
    }),
  );
  const values = { ...inherited };
  for (const path of (inherited.SLK_ENV_FILES ?? "").split(":").filter(Boolean)) {
    const mount = container.Mounts.find((item) => item.Destination === path);
    if (!mount?.Source) throw new Error("Missing runtime environment mount");
    Object.assign(values, dotenv.parse(readFileSync(mount.Source, "utf8")));
  }
  for (const key of (inherited.SLK_ENV_LOCKED_KEYS ?? "").split(","))
    if (inherited[key] !== undefined) values[key] = inherited[key];
  return values;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [container] = JSON.parse(readFileSync(0, "utf8")) as EnvironmentContainer[];
    if (!container || !["POSTGRES_", "MEILI_"].includes(process.argv[2] ?? ""))
      throw new Error("Invalid private environment request");
    for (const [key, value] of Object.entries(containerEnvironment(container)))
      if (key.startsWith(process.argv[2]!)) {
        if (/[\r\n\0]/.test(value)) throw new Error("Selected environment cannot use line transport");
        process.stdout.write(`${key}=${value}\n`);
      }
  } catch {
    process.stderr.write("Private runtime configuration could not be read.\n");
    process.exitCode = 1;
  }
}
