import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readTranslations } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportTranslations(dest, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const translations = await client.request(readTranslations({limit: 9000}));

    fse.mkdirSync(dest);

    translations.forEach((translation) => {
      const destPath = path.join(dest, slugify(translation.key, '_') + '.' + translation.language + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      fse.writeFileSync(
        destPath,
        stringify(translation),
        { encoding: 'utf8' }
      );

      if (options.verbose) {
        console.info(`Exported translation ${destPath}`);
      }
    });

    if (options.verbose) {
      console.info('All translations exported.');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportTranslations;
