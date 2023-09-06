import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readTranslations, createTranslations, updateTranslation, deleteTranslations,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importTranslations(src, options = {verbose: false}) {
  const client = createDirectusClient();

  try {
    const existingTranslations = await client.request(readTranslations({limit: 9000}));
    const translations = readYamlFiles(path.join(src));
    const translationsToCreate = [];
    const translationsToUpdate = [];

    translations.forEach((translation) => {
      const existingTranslation = find(existingTranslations, ['id', translation.id]);

      if (existingTranslation) {
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

    if (translationsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${translationsToUpdate.length} translations`);
      }

      translationsToUpdate.forEach(async (translation) => {
        try {
          await client.request(updateTranslation(translation.id, translation));
        } catch (err) {
          console.error(err);
        }
      });
    }

    // Remove
    if (options.remove) {
      const translationsToDelete = existingTranslations.filter((translation) => {
        return !find(translations, ['id', translation.id]);
      });

      if (translationsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${translationsToDelete.length} translations`);
        }

        await client.request(deleteTranslations(translationsToDelete.map(property('id'))));
      }
    }

    if (options.verbose) {
      console.info('Translations imported');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importTranslations;
