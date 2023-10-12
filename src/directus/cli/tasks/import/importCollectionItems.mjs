import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readItems,
  createItems,
  updateItem,
  deleteItems,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFile from '../shared/readYamlFile.mjs';

async function importCollectionItems(collection, src, options = {verbose: false, remove: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const existingItems = await client.request(readItems(collection, {limite: -1}));
    const items = readYamlFile(src);

    const itemsToCreate = [];
    const itemsToUpdate = [];

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
        } catch (err) {
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

        await client.request(deleteItems(collection, itemsToDelete.map(property('id'))));
      }
    }

    if (options.verbose) {
      console.info(`${collection} items imported`);
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importCollectionItems;
