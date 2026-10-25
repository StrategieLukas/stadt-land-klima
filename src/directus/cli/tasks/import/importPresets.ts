import { createPresets, deletePresets, readPresets } from "@directus/sdk";
import path from "path";
import createDirectusClient from "../shared/createDirectusClient.ts";
import type { TaskOptions } from "../shared/models.ts";
import { PresetSchema } from "../shared/models.ts";
import readYamlFiles from "../shared/readYamlFiles.ts";

async function importDefaultPresets(src: string, options: TaskOptions = {}) {
  const client = createDirectusClient();

  try {
    if (options.verbose) console.info("Reading presets from YAML files...");
    let presets = readYamlFiles(path.join(src), PresetSchema);

    if (options.verbose) console.info("Fetching existing presets...");
    const existingPresets = await client.request(readPresets({ limit: -1 }));

    // Filter presets that can be safely replaced (user=null)
    const presetsToDelete = existingPresets.filter((p) => !p.user);

    if (presetsToDelete.length) {
      if (options.verbose) console.info(`Deleting ${presetsToDelete.length} old default presets...`);
      const presetsToDeleteIds = presetsToDelete.map((p) => p.id).filter((id) => id !== null && id !== undefined);
      if (presetsToDeleteIds.length) {
        await client.request(deletePresets(presetsToDeleteIds));
      }
    }

    if (options.verbose) console.info(`Creating ${presets.length} new default presets...`);
    await client.request(createPresets(presets));

    if (options.verbose) console.info("Default and role-specific presets imported successfully.");
  } catch (err) {
    console.error("Error importing presets:", err);
    throw err;
  }
}

export default importDefaultPresets;
