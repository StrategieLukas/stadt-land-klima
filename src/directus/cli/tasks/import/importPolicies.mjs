import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readPolicies, createPolicies, updatePolicies, deletePolicies,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importPolicies(src, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const existingPolicies = await client.request(readPolicies({limit: -1}));
    const policies = readYamlFiles(path.join(src));
    const policiesToCreate = [];
    const policiesToUpdate = [];

    policies.forEach((policy) => {
      const existingPolicy = find(existingPolicies, ['id', policy.id]);

      if (existingPolicy) {
        policiesToUpdate.push(policy);
      } else {
        policiesToCreate.push(policy);
      }
    });

    if (policiesToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${policiesToCreate.length} policies`);
      }

      await client.request(createPolicies(policiesToCreate));
    }

    if (options.overwrite && policiesToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${policiesToUpdate.length} policies`);
      }

      policiesToUpdate.forEach(async (policy) => {
        try {
          await client.request(updatePolicies(policy.id, {value: policy.value}));
        } catch (err) {
          console.error(err, policy);
        }
      });
    }

    // Remove
    if (options.remove) {
      const policiesToDelete = existingPolicies.filter((policy) => {
        return !find(policies, {key: policy.key, language: policy.language});
      });

      if (policiesToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${policiesToDelete.length} policies`);
        }

        await client.request(deletePolicies(policiesToDelete.map(property('id'))));
      }
    }

    if (options.verbose) {
      console.info('Policies imported');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importPolicies;
