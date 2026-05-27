import fse from 'fse';
import path from 'path';
import stringifyHocon from '../shared/stringifyHocon.mjs';
import { readItems } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportCollectionItems(collection, dest, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const items = await client.request(readItems(collection, {limit: -1}));

    fse.mkdirSync(dest);

    const destPath = path.join(dest, slugify(collection, { replacement: '_', lower: false }) + '.hocon');

    if (!options.overwrite && fse.existsSync(destPath)) {
      if (options.verbose) {
        console.info(`File ${destPath} already exists.`);
      }
      return;
    }

    fse.writeFileSync(
      destPath,
      stringifyHocon(items),
      { encoding: 'utf8' }
    );

    if (options.verbose) {
      console.info(`Exported ${collection} items to ${destPath}`);
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportCollectionItems;
