import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
try {
  const require = createRequire(new URL("../../src/directus/cli/package.json", import.meta.url));
  const dotenv = require("dotenv") as { parse: (value: string) => Record<string, string> };
  const key = process.argv[2];
  if (!key || !["DB_DATABASE", "DB_USER", "DB_PORT"].includes(key)) throw new Error("Unsupported environment selector");
  const path = process.env.SLK_PODMAN_DIRECTUS_ENV_FILE || "src/directus/.env";
  process.stdout.write(
    dotenv.parse(readFileSync(path, "utf8"))[key] ?? process.env[key] ?? (key === "DB_PORT" ? "5432" : ""),
  );
} catch {
  process.stderr.write("Private runtime configuration could not be read.\n");
  process.exitCode = 1;
}
