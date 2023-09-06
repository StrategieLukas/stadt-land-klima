import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readSettings } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportSettings(dest, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const settings = await client.request(readSettings());

    fse.mkdirSync(dest);

    const destPath = path.join(dest, 'settings.yaml');

    if (!options.overwrite && fse.existsSync(destPath)) {
      if (options.verbose) {
        console.info(`File ${destPath} already exists.`);
      }
      return;
    }

    fse.writeFileSync(
      destPath,
      stringify(settings),
      { encoding: 'utf8' }
    );

    if (options.verbose) {
      console.info(`Exported setting ${destPath}`);
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportSettings;
