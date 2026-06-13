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

      await client.request(createTranslations(translationsToCreate));
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
