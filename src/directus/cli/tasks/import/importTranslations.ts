import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import { readTranslations, createTranslations, updateTranslation, deleteTranslations } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.js';
import readYamlFiles from '../shared/readYamlFiles.js';

interface Translation {
  id?: string;
  key: string;
  language: string;
  value: string;
  [key: string]: any;
}

interface ImportTranslationsOptions {
  verbose?: boolean;
  overwrite?: boolean;
  remove?: boolean;
}

async function importTranslations(src: string, options: ImportTranslationsOptions = { verbose: false, overwrite: false, remove: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    const existingTranslations: Translation[] = await client.request(readTranslations({ limit: -1 }));
    const translations: Translation[] = readYamlFiles(path.join(src));
    const translationsToCreate: Translation[] = [];
    const translationsToUpdate: Translation[] = [];

    translations.forEach((translation) => {
      const existingTranslation = find(existingTranslations, { key: translation.key, language: translation.language });

      if (existingTranslation) {
        translation.id = existingTranslation.id;
        translationsToUpdate.push(translation);
      } else {
        translationsToCreate.push(translation);
      }
    });

    if (translationsToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${translationsToCreate.length} translations`);
      }

      await client.request(createTranslations(translationsToCreate));
    }

    if (options.overwrite && translationsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${translationsToUpdate.length} translations`);
      }

      translationsToUpdate.forEach(async (translation) => {
        try {
          await client.request(updateTranslation(translation.id!, { value: translation.value }));
        } catch (err: any) {
          console.error(err, translation);
        }
      });
    }

    // Remove
    if (options.remove) {
      const translationsToDelete = existingTranslations.filter((translation) => {
        return !find(translations, { key: translation.key, language: translation.language });
      });

      if (translationsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${translationsToDelete.length} translations`);
        }

        const translationsToDeleteIds = translationsToDelete
          .map(property('id'))
          .filter((id: any) => id && id !== '');
        if (translationsToDeleteIds.length) {
          await client.request(deleteTranslations(translationsToDeleteIds));
        }
      }
    }

    if (options.verbose) {
      console.info('Translations imported');
    }
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

export default importTranslations;
