import dotenv from "dotenv";
/** Only these public analytics settings enter the static maintenance script. */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
try {
  const environment = dotenv.parse(
    readFileSync(process.env.SLK_PODMAN_FRONTEND_ENV_FILE || "src/frontend/.env", "utf8"),
  );
  const values = {
    __MAINTENANCE_STARTED_AT: new Date().toISOString(),
    __PLAUSIBLE_ANALYTICS_URL:
      environment.NUXT_PUBLIC_PLAUSIBLE_ANALYTICS_URL ?? environment.PLAUSIBLE_ANALYTICS_URL ?? "",
    __PLAUSIBLE_ANALYTICS_DOMAIN:
      environment.NUXT_PUBLIC_PLAUSIBLE_ANALYTICS_DOMAIN ?? environment.PLAUSIBLE_ANALYTICS_DOMAIN ?? "",
    __PLAUSIBLE_UTM_CAMPAIGN: environment.PLAUSIBLE_UTM_CAMPAIGN || "maintenance_mode",
  };
  const target = process.argv[2];
  if (!target) throw new Error("A private runtime metadata path is required");
  const temporary = target + "." + randomUUID();
  writeFileSync(
    temporary,
    Object.entries(values)
      .map(([key, value]) => `window.${key} = ${JSON.stringify(value)};`)
      .join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
  renameSync(temporary, target);
} catch {
  process.stderr.write("Maintenance metadata could not be generated; inspect private configuration.\n");
  process.exitCode = 1;
}
