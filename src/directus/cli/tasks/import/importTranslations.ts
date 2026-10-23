import {
  createTranslations,
  deleteTranslations,
  readTranslations,
  updateTranslation,
  updateTranslationsBatch,
} from '@directus/sdk';
import find from 'lodash/find.js';
import fse from 'node:fs';
import path from 'path';
import createDirectusClient from '../shared/createDirectusClient.ts';
import type { CliClient, TaskOptions, Translation } from '../shared/models.ts';
import {
  TranslationSchema,
  errorMessages,
  requiredId,
} from '../shared/models.ts';
import readYamlFile from '../shared/readYamlFile.ts';

const translationBatchSize = 100;
const languageCodePattern = /^[a-z]{2}-[A-Z]{2}$/;

function getLanguageFromFilename(filename: string) {
  return filename.match(/\.([a-z]{2}-[A-Z]{2})\.yaml$/)?.[1] || null;
}

function readTranslationFiles(dir: string) {
  const translations: Translation[] = [];

  if (!fse.existsSync(dir) || !fse.statSync(dir).isDirectory()) {
    throw new Error(`Translation source directory does not exist: ${dir}`);
  }

  function collect(currentDir: string) {
    fse
      .readdirSync(currentDir)
      .sort((a, b) => a.localeCompare(b))
      .forEach((filename) => {
        const fullPath = path.join(currentDir, filename);

        if (fse.statSync(fullPath).isDirectory()) {
          collect(fullPath);
          return;
        }

        if (path.extname(filename).toLowerCase() !== '.yaml') {
          return;
        }

        const translation = readYamlFile(fullPath, TranslationSchema);
        const folderLanguage = path.basename(path.dirname(fullPath));
        const filenameLanguage = getLanguageFromFilename(filename);
        const expectedLanguage = languageCodePattern.test(folderLanguage)
          ? folderLanguage
          : filenameLanguage;

        if (
          expectedLanguage &&
          translation.language &&
          translation.language !== expectedLanguage
        ) {
          throw new Error(
            `Translation language mismatch in ${fullPath}: expected ${expectedLanguage}, got ${translation.language}`,
          );
        }

        if (!translation.language && expectedLanguage) {
          translation.language = expectedLanguage;
        }

        if (!translation.language)
          throw new Error(`Missing translation language in ${fullPath}`);
        translations.push(translation);
      });
  }

  collect(dir);

  return translations.sort(
    (a, b) =>
      a.language.localeCompare(b.language) || a.key.localeCompare(b.key),
  );
}

function getTranslationKey(translation: Translation) {
  return `${translation.language}\0${translation.key}`;
}

function assertUniqueTranslations(translations: Translation[]) {
  const translationsByKey = new Map<string, Translation[]>();

  for (const translation of translations) {
    const key = getTranslationKey(translation);
    const existing = translationsByKey.get(key) || [];
    existing.push(translation);
    translationsByKey.set(key, existing);
  }

  const duplicates = Array.from(translationsByKey.entries()).filter(
    ([, entries]) => entries.length > 1,
  );

  if (duplicates.length > 0) {
    const details = duplicates
      .map(([key]) => {
        const [language, translationKey] = key.split('\0');
        return `${language}:${translationKey}`;
      })
      .join(', ');

    throw new Error(
      `Duplicate translation keys found in YAML files: ${details}`,
    );
  }
}

function isDuplicateTranslationError(err: unknown) {
  const messages = errorMessages(err);

  return messages.includes('Duplicate key and language combination');
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  return chunks;
}

async function findTranslationByKeyAndLanguage(
  client: CliClient,
  translation: Translation,
) {
  const matches = await client.request(
    readTranslations({
      limit: 1,
      filter: {
        key: {
          _eq: translation.key,
        },
        language: {
          _eq: translation.language,
        },
      },
    }),
  );

  return matches[0] || null;
}

async function updateExistingTranslation(
  client: CliClient,
  translation: Translation,
  options: TaskOptions,
) {
  const existingTranslation = await findTranslationByKeyAndLanguage(
    client,
    translation,
  );

  if (!existingTranslation) {
    return false;
  }

  if (options.overwrite) {
    await client.request(
      updateTranslation(existingTranslation.id, { value: translation.value }),
    );
  }

  return true;
}

async function createTranslationWithFallback(
  client: CliClient,
  translation: Translation,
  options: TaskOptions,
) {
  try {
    await client.request(createTranslations([translation]));
    return;
  } catch (err) {
    if (!isDuplicateTranslationError(err)) {
      throw err;
    }
  }

  const wasHandled = await updateExistingTranslation(
    client,
    translation,
    options,
  );

  if (!wasHandled) {
    await client.request(createTranslations([translation]));
  }
}

async function createTranslationsWithFallback(
  client: CliClient,
  translations: Translation[],
  options: TaskOptions,
) {
  for (const translationChunk of chunkArray(
    translations,
    translationBatchSize,
  )) {
    try {
      await client.request(createTranslations(translationChunk));
      continue;
    } catch (err) {
      if (!isDuplicateTranslationError(err)) {
        throw err;
      }

      if (options.verbose) {
        console.warn(
          'Directus reported a duplicate translation during bulk create; retrying translations individually.',
        );
      }
    }

    for (const translation of translationChunk) {
      await createTranslationWithFallback(client, translation, options);
    }
  }
}

async function updateTranslationsInBatches(
  client: CliClient,
  translations: Translation[],
  options: TaskOptions,
) {
  const translationChunks = chunkArray(translations, translationBatchSize);

  for (const [index, translationChunk] of translationChunks.entries()) {
    if (options.verbose && translationChunks.length > 1) {
      console.info(
        `Updating translation batch ${index + 1}/${translationChunks.length}`,
      );
    }

    await client.request(
      updateTranslationsBatch(
        translationChunk.map((translation) => ({
          id: requiredId(translation.id),
          value: translation.value,
        })),
      ),
    );
  }
}

async function importTranslations(src: string, options: TaskOptions = {}) {
  const client = createDirectusClient();

  try {
    const existingTranslations = await client.request(
      readTranslations({ limit: -1 }),
    );
    const translations = readTranslationFiles(path.join(src));
    assertUniqueTranslations(translations);

    const translationsToCreate: Translation[] = [];
    const translationsToUpdate: Translation[] = [];

    translations.forEach((translation) => {
      const existingTranslation = find(existingTranslations, {
        key: translation.key,
        language: translation.language,
      });

      if (existingTranslation) {
        translation.id = existingTranslation.id;
        if (translation.value !== existingTranslation.value) {
          translationsToUpdate.push(translation);
        }
      } else {
        translationsToCreate.push(translation);
      }
    });

    if (translationsToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${translationsToCreate.length} translations`);
      }

      await createTranslationsWithFallback(
        client,
        translationsToCreate,
        options,
      );
    }

    if (options.overwrite && translationsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${translationsToUpdate.length} translations`);
      }

      await updateTranslationsInBatches(client, translationsToUpdate, options);
    }

    // Remove
    if (options.remove) {
      const translationsToDelete = existingTranslations.filter(
        (translation) => {
          return !find(translations, {
            key: translation.key,
            language: translation.language,
          });
        },
      );

      if (translationsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${translationsToDelete.length} translations`);
        }

        const translationsToDeleteIds = translationsToDelete
          .map((item) => item.id)
          .filter((id) => id && id !== '');
        if (translationsToDeleteIds.length) {
          await client.request(deleteTranslations(translationsToDeleteIds));
        }
      }
    }

    if (options.verbose) {
      console.info('Translations imported');
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default importTranslations;
