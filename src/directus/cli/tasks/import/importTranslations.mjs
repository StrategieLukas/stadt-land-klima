import path from "path";
import fse from "fse";
import find from "lodash/find.js";
import property from "lodash/property.js";
import {
  readTranslations,
  createTranslations,
  updateTranslation,
  deleteTranslations,
} from "@directus/sdk";
import createDirectusClient from "../shared/createDirectusClient.mjs";
import readYamlFile from "../shared/readYamlFile.mjs";

const languageCodePattern = /^[a-z]{2}-[A-Z]{2}$/;

function getLanguageFromFilename(filename) {
  return filename.match(/\.([a-z]{2}-[A-Z]{2})\.yaml$/)?.[1] || null;
}

function readTranslationFiles(dir) {
  const translations = [];

  if (!fse.existsSync(dir) || !fse.statSync(dir).isDirectory()) {
    return translations;
  }

  function collect(currentDir) {
    fse
      .readdirSync(currentDir)
      .sort((a, b) => a.localeCompare(b))
      .forEach((filename) => {
        const fullPath = path.join(currentDir, filename);

        if (fse.statSync(fullPath).isDirectory()) {
          collect(fullPath);
          return;
        }

        if (path.extname(filename).toLowerCase() !== ".yaml") {
          return;
        }

        const translation = readYamlFile(fullPath);
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

        translations.push(translation);
      });
  }

  collect(dir);

  return translations.sort(
    (a, b) =>
      a.language.localeCompare(b.language) || a.key.localeCompare(b.key),
  );
}

function getTranslationKey(translation) {
  return `${translation.language}\0${translation.key}`;
}

function assertUniqueTranslations(translations) {
  const translationsByKey = new Map();

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
        const [language, translationKey] = key.split("\0");
        return `${language}:${translationKey}`;
      })
      .join(", ");

    throw new Error(`Duplicate translation keys found in YAML files: ${details}`);
  }
}

function isDuplicateTranslationError(err) {
  const messages = [
    err?.message,
    ...(Array.isArray(err?.errors) ? err.errors.map((error) => error?.message) : []),
  ]
    .filter(Boolean)
    .join("\n");

  return messages.includes("Duplicate key and language combination");
}

async function findTranslationByKeyAndLanguage(client, translation) {
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

async function updateExistingTranslation(client, translation, options) {
  const existingTranslation = await findTranslationByKeyAndLanguage(client, translation);

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

async function createTranslationWithFallback(client, translation, options) {
  try {
    await client.request(createTranslations([translation]));
    return;
  } catch (err) {
    if (!isDuplicateTranslationError(err)) {
      throw err;
    }
  }

  const wasHandled = await updateExistingTranslation(client, translation, options);

  if (!wasHandled) {
    await client.request(createTranslations([translation]));
  }
}

async function createTranslationsWithFallback(client, translations, options) {
  try {
    await client.request(createTranslations(translations));
    return;
  } catch (err) {
    if (!isDuplicateTranslationError(err)) {
      throw err;
    }

    if (options.verbose) {
      console.warn("Directus reported a duplicate translation during bulk create; retrying translations individually.");
    }
  }

  for (const translation of translations) {
    await createTranslationWithFallback(client, translation, options);
  }
}

async function importTranslations(
  src,
  options = { verbose: false, overwrite: false },
) {
  const client = createDirectusClient();

  try {
    const existingTranslations = await client.request(
      readTranslations({ limit: -1 }),
    );
    const translations = readTranslationFiles(path.join(src));
    assertUniqueTranslations(translations);

    const translationsToCreate = [];
    const translationsToUpdate = [];

    translations.forEach((translation) => {
      const existingTranslation = find(existingTranslations, {
        key: translation.key,
        language: translation.language,
      });

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

      await createTranslationsWithFallback(client, translationsToCreate, options);
    }

    if (options.overwrite && translationsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${translationsToUpdate.length} translations`);
      }

      await Promise.all(
        translationsToUpdate.map(async (translation) => {
          try {
            await client.request(
              updateTranslation(translation.id, { value: translation.value }),
            );
          } catch (err) {
            console.error(err, translation);
          }
        }),
      );
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
          .map(property("id"))
          .filter((id) => id && id !== "");
        if (translationsToDeleteIds.length) {
          await client.request(deleteTranslations(translationsToDeleteIds));
        }
      }
    }

    if (options.verbose) {
      console.info("Translations imported");
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importTranslations;
