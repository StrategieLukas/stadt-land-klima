import path from 'path';
import {
  updateSettings,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFile from '../shared/readYamlFile.mjs';

async function importSettings(src, options = {verbose: false}) {
  const client = createDirectusClient();

  try {
    const settings = readYamlFile(path.join(src, 'settings.yaml'));

    await client.request(updateSettings(settings));

    if (options.verbose) {
      console.info('Settings imported');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importSettings;
