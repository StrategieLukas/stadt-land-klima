import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readPresets, createPresets, updatePreset, deletePresets,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importRoles(src, options = {verbose: false}) {
  const client = createDirectusClient();

  const existingPresets = await client.request(readPresets({limit: 10000}));

  try {
    const presets = readYamlFiles(path.join(src));
    const presetsToCreate = [];
    const presetsToUpdate = [];

    presets.forEach((preset) => {
      const existingPreset = find(existingPresets, ['id', preset.id]);

      if (existingPreset) {
        presetsToUpdate.push(preset);
      } else {
        presetsToCreate.push(preset);
      }
    });

    if (presetsToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${presetsToCreate.length} presets`);
      }

      await client.request(createPresets(presetsToCreate));
    }

    if (presetsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${presetsToUpdate.length} presets`);
      }

      presetsToUpdate.forEach(async (preset) => {
        await client.request(updatePreset(preset.id, preset));
      });
    }

    // Remove
    if (options.remove) {
      const presetsToDelete = existingPresets.filter((preset) => {
        return !find(presets, ['id', preset.id]);
      });

      if (presetsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${presetsToDelete.length} presets`);
        }

        await client.request(deletePresets(presetsToDelete.map(property('id'))));
      }
    }

    if (options.verbose) {
      console.info('Presets imported');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importRoles;
