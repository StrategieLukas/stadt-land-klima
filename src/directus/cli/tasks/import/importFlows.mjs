import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readFlows, createFlows, updateFlow, deleteFlows,
  readOperations, createOperations, updateOperation, deleteOperations,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importFlows(src, options = {verbose: false}) {
  const client = createDirectusClient();

  const existingFlows = await client.request(readFlows({limit: 1000}));
  const existingOperations = await client.request(readOperations({limit: 10000}));

  try {
    const flows = readYamlFiles(path.join(src));
    let operations = [];

    const flowsToCreate = [];
    const flowsToUpdate = [];
    const operationsToCreate = [];
    const operationsToUpdate = [];

    flows.forEach((flow) => {
      const existingFlow = find(existingFlows, ['id', flow.id]);
      const flowOperations = flow.operations;
      operations = operations.concat(flowOperations);
      delete flow.operations;

      if (existingFlow) {
        flowsToUpdate.push(flow);
      } else {
        flowsToCreate.push(flow);
      }

      flowOperations.forEach((operation) => {
        const existingOperation = find(existingOperations, ['id', operation.id]);

        if (existingOperation) {
          operationsToUpdate.push(operation);
        } else {
          operationsToCreate.push(operation);
        }
      });
    });

    // Flows

    if (flowsToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${flowsToCreate.length} flows`);
      }

      await client.request(createFlows(flowsToCreate));
    }

    if (flowsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${flowsToUpdate.length} flows`);
      }

      flowsToUpdate.forEach(async (flow) => {
        await client.request(updateFlow(flow.id, flow));
      });
    }

    // Operations

    if (operationsToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${operationsToCreate.length} operations`);
      }

      await client.request(createOperations(operationsToCreate));
    }

    if (operationsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${operationsToUpdate.length} operations`);
      }

      operationsToUpdate.forEach(async (operation) => {
        await client.request(updateOperation(operation.id, operation));
      });
    }

    // Remove
    if (options.remove) {
      const flowsToDelete = existingFlows.filter((flow) => {
        return !find(flows, ['id', flow.id]);
      });


      const operationsToDelete = existingOperations.filter((operation) => {
        return !find(operations, ['id', operation.id]);
      });

      if (operationsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${operationsToDelete.length} operations`);
        }

        await client.request(deleteOperations(operationsToDelete.map(property('id'))));
      }

      if (flowsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${flowsToDelete.length} flows`);
        }

        await client.request(deleteFlows(flowsToDelete.map(property('id'))));
      }
    }

    if (options.verbose) {
      console.info('Flows imported');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importFlows;
