import dotenv from "dotenv";
/** Private migration transport: emit selected keys only into the caller's backup. */
import { readFileSync } from "node:fs";
try {
  const [container] = JSON.parse(readFileSync(0, "utf8")) as Array<{
    Config: { Env: string[] };
    Mounts: Array<{ Source: string; Destination: string }>;
  }>;
  if (!container || !["POSTGRES_", "MEILI_"].includes(process.argv[2] ?? ""))
    throw new Error("Invalid private environment request");
  const inherited = Object.fromEntries(
    container.Config.Env.map((entry) => {
      const at = entry.indexOf("=");
      return [entry.slice(0, at), entry.slice(at + 1)];
    }),
  );
  const values = { ...inherited };
  for (const path of (inherited.SLK_ENV_FILES ?? "").split(":").filter(Boolean)) {
    const mount = container.Mounts.find((item) => item.Destination === path);
    if (!mount) throw new Error("Missing runtime environment mount");
    Object.assign(values, dotenv.parse(readFileSync(mount.Source, "utf8")));
  }
  for (const key of (inherited.SLK_ENV_LOCKED_KEYS ?? "").split(","))
    if (inherited[key] !== undefined) values[key] = inherited[key];
  for (const [key, value] of Object.entries(values))
    if (key.startsWith(process.argv[2]!)) {
      if (/[\r\n\0]/.test(value)) throw new Error("Selected environment cannot use line transport");
      process.stdout.write(`${key}=${value}\n`);
    }
} catch {
  process.stderr.write("Private runtime configuration could not be read.\n");
  process.exitCode = 1;
}
