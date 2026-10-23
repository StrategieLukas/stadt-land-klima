/** Generate portable Compose storage/rollback overlays; run in the migration helper. */
import { writeFileSync } from "node:fs";
const [
  environment,
  dbVolume,
  meiliVolume,
  dbType,
  dbSource,
  dbOldVolume,
  meiliType,
  meiliSource,
  meiliOldVolume,
  dbImage,
  meiliImage,
] = process.argv.slice(2);
if (![environment, dbVolume, meiliVolume, dbType, dbSource, meiliType, meiliSource, dbImage, meiliImage].every(Boolean))
  throw Error("Missing overlay argument");
const volumeName = (value: string | undefined): string => {
  if (!value || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(value)) throw Error("Invalid volume name");
  return value;
};
const volumes: Record<string, { external: true; name: string }> = {};
function sourceMount(
  type: string | undefined,
  source: string | undefined,
  volume: string | undefined,
  target: string,
  name: string,
) {
  if (type === "volume") {
    volumes[name] = { external: true, name: volumeName(volume) };
    return { type, source: name, target };
  }
  if (type !== "bind" || !source?.startsWith("/") || /[\r\n]/.test(source)) throw Error("Unsupported source mount");
  return { type, source, target };
}
const rollback = {
  services: {
    db: {
      image: dbImage,
      volumes: [sourceMount(dbType, dbSource, dbOldVolume, "/var/lib/postgresql/data", "slk_previous_db")],
    },
    meilisearch: {
      image: meiliImage,
      volumes: [sourceMount(meiliType, meiliSource, meiliOldVolume, "/meili_data", "slk_previous_meili")],
    },
  },
  volumes,
};
const target = {
  services: {
    db: { volumes: [{ type: "volume", source: "slk_migrated_db", target: "/var/lib/postgresql/data" }] },
    meilisearch: { volumes: [{ type: "volume", source: "slk_migrated_meili", target: "/meili_data" }] },
  },
  volumes: {
    slk_migrated_db: { external: true, name: volumeName(dbVolume) },
    slk_migrated_meili: { external: true, name: volumeName(meiliVolume) },
  },
};
for (const [file, value] of Object.entries({ "target.compose.json": target, "rollback.compose.json": rollback }))
  writeFileSync("/backup/" + file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" });
writeFileSync("/backup/target.volumes", dbVolume + " " + meiliVolume + "\n", { mode: 0o600, flag: "wx" });
