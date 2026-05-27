import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readItems } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.js';

interface ExportCollectionItemsOptions {
  verbose?: boolean;
  overwrite?: boolean;
}

async function exportCollectionItems(collection: string, dest: string, options: ExportCollectionItemsOptions = { verbose: false, overwrite: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    const items = await client.request(readItems(collection, { limit: -1 }));

    fse.mkdirSync(dest);

    const destPath = path.join(dest, slugify(collection, { replacement: '_', lower: false }) + '.yaml');

    if (!options.overwrite && fse.existsSync(destPath)) {
      if (options.verbose) {
        console.info(`File ${destPath} already exists.`);
      }
      return;
    }

    fse.writeFileSync(
      destPath,
      stringify(items),
      { encoding: 'utf8' }
    );

    if (options.verbose) {
      console.info(`Exported ${collection} items to ${destPath}`);
    }
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

export default exportCollectionItems;
