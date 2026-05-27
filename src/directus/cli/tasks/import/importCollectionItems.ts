import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import { readItems, createItems, updateItem, deleteItems } from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.js';
import readYamlFile from '../shared/readYamlFile.js';

interface ImportCollectionItemsOptions {
  verbose?: boolean;
  remove?: boolean;
  overwrite?: boolean;
}

async function importCollectionItems(collection: string, src: string, options: ImportCollectionItemsOptions = { verbose: false, remove: false, overwrite: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    const existingItems: any[] = await client.request(readItems(collection, { limit: -1 }));
    const items: any[] = readYamlFile(src);

    const itemsToCreate: any[] = [];
    const itemsToUpdate: any[] = [];

    items.forEach((item) => {
      const existingItem = find(existingItems, ['id', item.id]);

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

      itemsToUpdate.forEach(async (item) => {
        try {
          await client.request(updateItem(collection, item.id, item));
        } catch (err: any) {
          console.error(err, item);
        }
      });
    }

    // Remove
    if (options.remove) {
      const itemsToDelete = existingItems.filter((item) => {
        return !find(items, ['id', item.id]);
      });

      if (itemsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${itemsToDelete.length} items`);
        }

        const itemsToDeleteIds = itemsToDelete
          .map(property('id'))
          .filter((id: any) => id && id !== '') as (string | number)[];
        if (itemsToDeleteIds.length) {
          await client.request(deleteItems(collection, itemsToDeleteIds));
        }
      }
    }

    if (options.verbose) {
      console.info(`${collection} items imported`);
    }
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

export default importCollectionItems;
