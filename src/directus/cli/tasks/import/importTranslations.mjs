import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readTranslations, createTranslations, updateTranslation, deleteTranslations,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importTranslations(src, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const existingTranslations = await client.request(readTranslations({limit: -1}));
    const translations = readYamlFiles(path.join(src));
    const translationsToCreate = [];
    const translationsToUpdate = [];

    translations.forEach((translation) => {
      const existingTranslation = find(existingTranslations, {key: translation.key, language: translation.language});

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
          await client.request(updateTranslation(translation.id, {value: translation.value}));
        } catch (err) {
          console.error(err, translation);
        }
      });
    }

    // Remove
    if (options.remove) {
      const translationsToDelete = existingTranslations.filter((translation) => {
        return !find(translations, {key: translation.key, language: translation.language});
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
