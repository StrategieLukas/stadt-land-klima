import fse from "fse";
import path from "path";
import { stringify } from "yaml";
import { readTranslations } from "@directus/sdk";
import slugify from "slugify";
import createDirectusClient from "../shared/createDirectusClient.mjs";

function getTranslationPath(dest, translation) {
  const filename = `${slugify(translation.key, { replacement: "_", lower: false })}.${translation.language}.yaml`;
  return path.join(dest, translation.language, filename);
}

async function exportTranslations(
  dest,
  options = { verbose: false, overwrite: false },
) {
  const client = createDirectusClient();

  try {
    const translations = await client.request(readTranslations({ limit: -1 }));

    fse.mkdirSync(dest, { recursive: true });

    translations
      .sort(
        (a, b) =>
          a.language.localeCompare(b.language) || a.key.localeCompare(b.key),
      )
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
    return process.exit(1);
  }
}

export default exportTranslations;
