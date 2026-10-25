import { createItems, deleteItems, readItems, updateItem } from "@directus/sdk";
import find from "lodash/find.js";
import createDirectusClient from "../shared/createDirectusClient.ts";
import type { Item, TaskOptions } from "../shared/models.ts";
import { ItemSchema } from "../shared/models.ts";
import readYamlFile from "../shared/readYamlFile.ts";

async function importCollectionItems(collection: string, src: string, options: TaskOptions = {}) {
  const client = createDirectusClient<Record<string, Item[]>>();

  try {
    const existingItems = await client.request(readItems(collection, { limit: -1 }));
    const items = readYamlFile(src, ItemSchema.array());

    const itemsToCreate: Item[] = [];
    const itemsToUpdate: Item[] = [];

    items.forEach((item) => {
      const existingItem = item.id === undefined ? undefined : find(existingItems, ["id", item.id]);

      if (existingItem) {
        itemsToUpdate.push(item);
      } else {
        itemsToCreate.push(item);
      }
    });

    if (itemsToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${itemsToCreate.length} items`);
      }

      await client.request(createItems(collection, itemsToCreate));
    }

    if (options.overwrite && itemsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${itemsToUpdate.length} items`);
      }

      for (const item of itemsToUpdate) {
        try {
          if (item.id === undefined) throw new Error("Cannot update an item without an ID");
          await client.request(updateItem(collection, item.id, item));
        } catch (err) {
          throw err;
        }
      }
    }

    // Remove
    if (options.remove) {
      const itemsToDelete = existingItems.filter((item) => {
        return !find(items, ["id", item.id]);
      });

      if (itemsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${itemsToDelete.length} items`);
        }

        const itemsToDeleteIds = itemsToDelete
          .map((item) => item.id)
          .filter((id): id is string | number => (typeof id === "string" && id !== "") || typeof id === "number");
        if (itemsToDeleteIds.length) {
          await client.request(
            deleteItems(collection, {
              filter: { id: { _in: itemsToDeleteIds } },
            }),
          );
        }
      }
    }

    if (options.verbose) {
      console.info(`${collection} items imported`);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default importCollectionItems;
