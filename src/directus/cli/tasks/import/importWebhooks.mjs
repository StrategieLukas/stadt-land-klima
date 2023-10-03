import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readWebhooks, createWebhooks, updateWebhook, deleteWebhooks,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importWebhooks(src, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const existingWebhooks = await client.request(readWebhooks({limit: -1}));
    const webhooks = readYamlFiles(path.join(src));
    const webhooksToCreate = [];
    const webhooksToUpdate = [];

    webhooks.forEach((webhook) => {
      const existingWebhook = find(existingWebhooks, ['id', webhook.id]);

      if (existingWebhook) {
        webhooksToUpdate.push(webhook);
      } else {
        webhooksToCreate.push(webhook);
      }
    });

    if (webhooksToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${webhooksToCreate.length} webhooks`);
      }

      await client.request(createWebhooks(webhooksToCreate));
    }

    if (options.overwrite && webhooksToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${webhooksToUpdate.length} webhooks`);
      }

      webhooksToUpdate.forEach(async (webhook) => {
        try {
          await client.request(updateWebhook(webhook.id, webhook));
        } catch (err) {
          console.error(err);
        }
      });
    }

    // Remove
    if (options.remove) {
      const webhooksToDelete = existingWebhooks.filter((webhook) => {
        return !find(webhooks, ['id', webhook.id]);
      });

      if (webhooksToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${webhooksToDelete.length} webhooks`);
        }

        await client.request(deleteWebhooks(webhooksToDelete.map(property('id'))));
      }
    }

    if (options.verbose) {
      console.info('Webhooks imported');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importWebhooks;
