import yaml from "yaml";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
try {
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
