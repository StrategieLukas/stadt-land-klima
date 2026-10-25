import { readTranslations } from "@directus/sdk";
import fse from "node:fs";
import path from "path";
import slugify from "slugify";
import { stringify } from "yaml";
import createDirectusClient from "../shared/createDirectusClient.ts";
import type { TaskOptions, Translation } from "../shared/models.ts";
import { TranslationSchema } from "../shared/models.ts";

function getTranslationPath(dest: string, translation: Translation) {
  if (!translation.language) throw new Error("Translation language is missing");
  const filename = `${slugify(translation.key, { replacement: "_", lower: false })}.${translation.language}.yaml`;
  return path.join(dest, translation.language, filename);
}

async function exportTranslations(dest: string, options: TaskOptions = {}) {
  const client = createDirectusClient();

  try {
    const translations = TranslationSchema.array().parse(await client.request(readTranslations({ limit: -1 })));

    fse.mkdirSync(dest, { recursive: true });

    translations
      .sort((a, b) => a.language.localeCompare(b.language) || a.key.localeCompare(b.key))
      .forEach((translation) => {
        const destPath = getTranslationPath(dest, translation);
        fse.mkdirSync(path.dirname(destPath), { recursive: true });

        if (!options.overwrite && fse.existsSync(destPath)) {
          if (options.verbose) {
            console.info(`File ${destPath} already exists.`);
          }
          return;
        }

        delete translation.id;

        fse.writeFileSync(destPath, stringify(translation), {
          encoding: "utf8",
        });

        if (options.verbose) {
          console.info(`Exported translation ${destPath}`);
        }
      });

    if (options.verbose) {
      console.info("All translations exported.");
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default exportTranslations;
