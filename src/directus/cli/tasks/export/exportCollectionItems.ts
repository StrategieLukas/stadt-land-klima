import { readItems } from "@directus/sdk";
import fse from "node:fs";
import path from "path";
import slugify from "slugify";
import { stringify } from "yaml";
import createDirectusClient from "../shared/createDirectusClient.ts";
import type { Item, TaskOptions } from "../shared/models.ts";

async function exportCollectionItems(collection: string, dest: string, options: TaskOptions = {}) {
  const client = createDirectusClient<Record<string, Item[]>>();

  try {
    const items = await client.request(readItems(collection, { limit: -1 }));

    fse.mkdirSync(dest, { recursive: true });

    const destPath = path.join(dest, slugify(collection, { replacement: "_", lower: false }) + ".yaml");

    if (!options.overwrite && fse.existsSync(destPath)) {
      if (options.verbose) {
        console.info(`File ${destPath} already exists.`);
      }
      return;
    }

    fse.writeFileSync(destPath, stringify(items), { encoding: "utf8" });

    if (options.verbose) {
      console.info(`Exported ${collection} items to ${destPath}`);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default exportCollectionItems;
