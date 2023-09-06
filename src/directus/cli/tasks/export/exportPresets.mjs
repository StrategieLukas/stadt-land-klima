import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readPresets } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportPresets(dest, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const presets = await client.request(readPresets({limit: 1000}));

    fse.mkdirSync(dest);

    presets.forEach((preset) => {
      const destPath = path.join(dest, slugify((preset.bookmark || preset.id).toString(), '_') + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      fse.writeFileSync(
        destPath,
        stringify(preset),
        { encoding: 'utf8' }
      );

      if (options.verbose) {
        console.info(`Exported preset ${destPath}`);
      }
    });

    if (options.verbose) {
      console.info('All presets exported.');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportPresets;
