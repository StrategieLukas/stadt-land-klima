import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
try {
  const require = createRequire(new URL("../../src/directus/cli/package.json", import.meta.url));
  const yaml = require("yaml") as {
    parse: (input: string) => {
      services: Record<string, { volumes?: Array<string | { type: string; source: string; target: string }> }>;
      volumes?: Record<string, { name?: string }>;
    };
  };
  const [service, target, project] = process.argv.slice(2);
  if (!service || !target || !project) throw new Error("Missing mount selector");
  const config = yaml.parse(readFileSync(0, "utf8"));
  for (const value of config.services[service]?.volumes ?? []) {
    const mount =
      typeof value === "string"
        ? {
            source: value.split(":")[0]!,
            target: value.split(":")[1]!,
            type: value.startsWith("/") || value.startsWith(".") ? "bind" : "volume",
          }
        : value;
    if (mount.target !== target) continue;
    process.stdout.write(
      mount.type === "bind"
        ? `bind|${resolve(mount.source)}|`
        : `volume||${config.volumes?.[mount.source]?.name ?? `${project}_${mount.source}`}`,
    );
    process.exit(0);
  }
  throw new Error("Missing configured service storage");
} catch {
  process.stderr.write("Private runtime configuration could not be read.\n");
  process.exitCode = 1;
}
