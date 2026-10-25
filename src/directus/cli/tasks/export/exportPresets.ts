import { readPresets, readRoles } from "@directus/sdk";
import fse from "node:fs";
import path from "path";
import slugify from "slugify";
import { stringify } from "yaml";
import createDirectusClient from "../shared/createDirectusClient.ts";
import type { TaskOptions } from "../shared/models.ts";
import { relationId } from "../shared/models.ts";

async function exportPresets(dest: string, options: TaskOptions = {}) {
  const client = createDirectusClient();

  try {
    // Fetch all presets
    const presets = await client.request(readPresets({ limit: -1 }));

    // Fetch all roles to map role IDs to names
    const roles = await client.request(readRoles({ limit: -1 }));
    const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

    fse.mkdirSync(dest, { recursive: true });

    for (const preset of presets) {
      // Skip user-specific presets
      if (preset.user) continue;

      // Remove ID from export
      const { id, ...presetData } = preset;

      // Determine filename
      let filename = "";
      if (!preset.role) {
        // Global default
        filename =
          slugify(preset.collection ?? "global", {
            replacement: "_",
            lower: false,
          }) + ".yaml";
      } else {
        // Role-specific default
        const roleName = roleMap[relationId(preset.role) ?? ""] || relationId(preset.role);
        filename =
          slugify(`${preset.collection}-${roleName}`, {
            replacement: "_",
            lower: false,
          }) + ".yaml";
      }

      const destPath = path.join(dest, filename);

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) console.info(`File ${destPath} already exists. Skipping.`);
        continue;
      }

      fse.writeFileSync(destPath, stringify(presetData), { encoding: "utf8" });

      if (options.verbose) {
        console.info(`Exported preset to ${destPath}`);
      }
    }

    if (options.verbose) console.info("All eligible presets exported.");
  } catch (err) {
    console.error("Error exporting presets:", err);
    throw err;
  }
}

export default exportPresets;
