import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readTranslations } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.js';

interface Translation {
  id?: string;
  key: string;
  language: string;
  value: string;
  [key: string]: any;
}

interface ExportTranslationsOptions {
  verbose?: boolean;
  overwrite?: boolean;
}

async function exportTranslations(dest: string, options: ExportTranslationsOptions = { verbose: false, overwrite: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    const translations: Translation[] = await client.request(readTranslations({ limit: -1 }));

    fse.mkdirSync(dest);

    translations.forEach((translation) => {
      const destPath = path.join(dest, slugify(translation.key, { replacement: '_', lower: false }) + '.' + translation.language + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      delete translation.id;

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
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

export default exportTranslations;
