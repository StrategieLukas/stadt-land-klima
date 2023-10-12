import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import assign from 'lodash/assign.js';
import {
  readFlows, createFlows, updateFlow, deleteFlows,
  readOperations, createOperations, updateOperation, deleteOperations, updateFlows,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importFlows(src, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const existingFlows = await client.request(readFlows({limit: -1}));
    const existingOperations = await client.request(readOperations({limit: -1}));
    const flows = readYamlFiles(path.join(src));
    let operations = [];

    const flowsToCreate = [];
    const flowsToUpdate = [];
    const operationsToCreate = [];
    const operationsToUpdate = [];

    // create lookup tables for existing operations
    const existingOperationsByKey = {};
    const existingOperationsById = {};
    existingOperations.forEach((operation) => {
      existingOperationsByKey[operation.key] = operation;
      existingOperationsById[operation.id] = operation;
    });

    flows.forEach((flow) => {
      const existingFlow = find(existingFlows, ['name', flow.name]);
      const flowOperations = flow.operations;
      operations = operations.concat(flowOperations);
      delete flow.operations;

      if (existingFlow) {
        flow.id = existingFlow.id;
        flowsToUpdate.push(flow);
      } else {
        flowsToCreate.push(flow);
      }

      flowOperations.forEach((operation) => {
        const existingOperation = find(existingOperations, ['key', operation.key]);
        operation.flow_name = flow.name;

        if (existingOperation) {
          operation.id = existingOperation.id;
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

      const createdFlows = await client.request(createFlows(flowsToCreate));

      createdFlows.forEach((createdFlow) => {
        const flow = find(flowsToCreate, ['name', createdFlow.name]);
        assign(flow, createdFlow);
      });
    }

    if (options.overwrite && flowsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${flowsToUpdate.length} flows`);
      }

      flowsToUpdate.forEach(async (flow) => {
        try {
          const updatedFlow = await client.request(updateFlow(flow.id, flow));
          assign(flow, updatedFlow);
        } catch (err) {
          console.error(err, flow);
        }

        // delete non existing operations in this flow
        const existingFlowOperations = existingOperations
        .filter((operation) => {
          return operation.flow === flow.id;
        });
        const flowOperationsToDelete = existingFlowOperations.filter((operation) => {
          return !find(operations, {flow_name: flow.name, key: operation.key});
        });

        if (options.verbose && flowOperationsToDelete.length) {
          console.info(`Removing ${flowOperationsToDelete.length} operations from flow ${flow.name}`);
        }

        try {
          await client.request(deleteOperations(flowOperationsToDelete.map(property('id'))));
        } catch (err) {
          console.error(err, flow);
        }
      });
    }

    // set flow ids to operations before creating or updating them
    operations.forEach((operation) => {
      const flow = find(flows, ['name', operation.flow_name]);
      operation.flow = flow.id;
    });

    // Operations

    if (operationsToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${operationsToCreate.length} operations`);
      }

      const createdOperations = await client.request(createOperations(operationsToCreate));

      createdOperations.forEach((createdOperation) => {
        const operation = find(operationsToCreate, ['key', createdOperation.key]);
        assign(operation, createdOperation);
      });
    }

    if (operationsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${operationsToUpdate.length} operations`);
      }

      operationsToUpdate.forEach(async (operation) => {
        const updatedOperation = await client.request(updateOperation(operation.id, operation));
        assign(operation, updatedOperation);
      });
    }

    // set flow operation ids and then update the flow
    flows.forEach(async (flow) => {
      if (flow.operation_key) {
        const operation = find(operations, ['key', flow.operation_key]);
        if (!operation) {
          return;
        }

        flow.operation = operation.id;

        try {
          const updatedFlow = await client.request(updateFlow(flow.id, {
            operation: flow.operation,
          }));
          assign(flow, updatedFlow);
        } catch (err) {
          console.error(err, flow);
          console.debug(operation.id, flow.operation);
        }
      }
    });

    // set resolve and reject ids to operations and then update those
    operations.forEach(async (operation) => {
      if (operation.resolve_key) {
        const resolveOperation = find(operations, ['key', operation.resolve_key]);
        operation.resolve = resolveOperation ? resolveOperation.id : null;
      }

      if (operation.reject_key) {
        const rejectOperation = find(operations, ['key', operation.reject_key]);
        operation.reject = rejectOperation ? rejectOperation.id : null;
      }

      if (operation.resolve || operation.reject) {
        try {
          // TODO: for some reason
          const updatedOperation = await client.request(updateOperation(operation.id, {
            resolve: operation.resolve,
            reject: operation.reject,
          }));

          assign(operation, updatedOperation);
        } catch (err) {
          console.error(err, operation);
        }
      }
    });

    // Remove
    if (options.remove) {
      const flowsToDelete = existingFlows.filter((flow) => {
        return !find(flows, ['name', flow.name]);
      });

      const operationsToDelete = existingOperations.filter((operation) => {
        return !find(operations, ['key', operation.key]);
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
