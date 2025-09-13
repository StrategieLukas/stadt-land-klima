import path from 'path';
import { readPresets, createPresets, deletePresets } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importDefaultPresets(src, options = { verbose: false }) {
  const client = createDirectusClient();

  try {
    if (options.verbose) console.info('Reading presets from YAML files...');
    let presets = readYamlFiles(path.join(src));

    if (options.verbose) console.info('Fetching existing presets...');
    const existingPresets = await client.request(readPresets({ limit: -1 }));

    // Filter presets that can be safely replaced (user=null)
    const presetsToDelete = existingPresets.filter(p => !p.user);

    if (presetsToDelete.length) {
      if (options.verbose) console.info(`Deleting ${presetsToDelete.length} old default presets...`);
      await client.request(deletePresets(presetsToDelete.map(p => p.id)));
    }

    if (options.verbose) console.info(`Creating ${presets.length} new default presets...`);
    await client.request(createPresets(presets));

    if (options.verbose) console.info('Default and role-specific presets imported successfully.');
  } catch (err) {
    console.error('Error importing presets:', err);
    process.exit(1);
  }
}

export default importDefaultPresets;
