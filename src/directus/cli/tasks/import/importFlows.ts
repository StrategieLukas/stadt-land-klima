import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import assign from 'lodash/assign.js';
import {
  readFlows, createFlows, updateFlow, deleteFlows,
  readOperations, createOperations, updateOperation, deleteOperations, updateFlows,
} from '@directus/sdk';
import createDirectusClient, { directusUrl } from '../shared/createDirectusClient.js';
import readYamlFiles from '../shared/readYamlFiles.js';

interface Flow {
  id?: string;
  name?: string;
  [key: string]: any;
}

interface Operation {
  id?: string;
  key?: string;
  flow?: string;
  flow_name?: string;
  resolve?: string;
  reject?: string;
  resolve_key?: string;
  reject_key?: string;
  type?: string;
  options?: any;
  [key: string]: any;
}

interface ImportFlowsOptions {
  verbose?: boolean;
  overwrite?: boolean;
  remove?: boolean;
}

async function importFlows(src: string, options: ImportFlowsOptions = { verbose: false, overwrite: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    const existingFlows: Flow[] = await client.request(readFlows({ limit: -1 }));
    const existingOperations: Operation[] = await client.request(readOperations({ limit: -1 }));
    const flows: Flow[] = readYamlFiles(path.join(src));
    let operations: Operation[] = [];

    const flowsToCreate: Flow[] = [];
    const flowsToUpdate: Flow[] = [];
    const operationsToCreate: Operation[] = [];
    const operationsToUpdate: Operation[] = [];

    // create lookup tables for existing operations and flows
    const existingFlowsByName: Record<string, Flow> = {};
    const existingOperationsByKey: Record<string, Operation> = {};
    const existingOperationsById: Record<string, Operation> = {};
    existingFlows.forEach((flow) => {
      existingFlowsByName[flow.name!] = flow;
    });
    existingOperations.forEach((operation) => {
      existingOperationsByKey[operation.key!] = operation;
      existingOperationsById[operation.id!] = operation;
    });

    flows.forEach((flow) => {
      const existingFlow = find(existingFlows, ['name', flow.name]);
      const flowOperations: Operation[] = flow.operations || [];
      operations = operations.concat(flowOperations);
      delete flow.operations;

      if (existingFlow) {
        (flow as any).id = existingFlow.id;
        flowsToUpdate.push(flow);
      } else {
        flowsToCreate.push(flow);
      }

      flowOperations.forEach((operation: Operation) => {
        operation.flow_name = flow.name;

        if (existingOperationsByKey[operation.key!]) {
          operation.id = existingOperationsByKey[operation.key!].id;
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

      const createdFlows: Flow[] = await client.request(createFlows(flowsToCreate));

      createdFlows.forEach((createdFlow) => {
        const flow = find(flowsToCreate, ['name', createdFlow.name]);
        if (flow) {
          assign(flow, createdFlow);

          // add to lookup for later reference
          existingFlowsByName[flow.name!] = flow;
        }
      });
    }

    if (options.overwrite && flowsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${flowsToUpdate.length} flows`);
      }

      flowsToUpdate.forEach(async (flow) => {
        try {
          const updatedFlow = await client.request(updateFlow(flow.id!, flow));
          assign(flow, updatedFlow);
        } catch (err: any) {
          console.error(err, flow);
        }

        // delete non existing operations in this flow
        const existingFlowOperations = existingOperations
        .filter((operation) => {
          return operation.flow === flow.id;
        });
        const flowOperationsToDelete = existingFlowOperations.filter((operation) => {
          return !find(operations, { flow_name: flow.name, key: operation.key });
        });

        if (options.verbose && flowOperationsToDelete.length) {
          console.info(`Removing ${flowOperationsToDelete.length} operations from flow ${flow.name}`);
        }

        try {
          const operationsToDeleteIds = flowOperationsToDelete
            .map(property('id'))
            .filter((id: any) => id && id !== '') as (string | number)[];
          if (operationsToDeleteIds.length) {
            await client.request(deleteOperations(operationsToDeleteIds));
          }
        } catch (err: any) {
          console.error(err, flow);
        }
      });
    }

    // set flow ids to operations before creating or updating them
    operations.forEach((operation) => {
      const flow = find(flows, ['name', operation.flow_name]);
      if (flow && flow.id) {
        (operation as any).flow = flow.id;
      }

      if (operation.type === 'trigger' && operation.options && (operation as any).options.flow_name) {
        const triggerFlow = existingFlowsByName[(operation as any).options.flow_name];

        if (triggerFlow) {
          (operation.options as any).flow = triggerFlow.id;
        }

        delete (operation.options as any).flow_name;
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

        const operationsToDeleteIds = operationsToDelete
          .map(property('id'))
          .filter((id: any) => id && id !== '') as (string | number)[];
        if (operationsToDeleteIds.length) {
          await client.request(deleteOperations(operationsToDeleteIds));
        }
      }

      if (flowsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${flowsToDelete.length} flows`);
        }

        const flowsToDeleteIds = flowsToDelete
          .map(property('id'))
          .filter((id: any) => id && id !== '') as (string | number)[];
        if (flowsToDeleteIds.length) {
          await client.request(deleteFlows(flowsToDeleteIds));
        }
      }
    }

    // Operations

    if (operationsToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${operationsToCreate.length} operations`);
      }

      const createdOperations: Operation[] = await client.request(createOperations(operationsToCreate));

      createdOperations.forEach((createdOperation) => {
        const operation = find(operationsToCreate, ['key', createdOperation.key]);
        if (operation) {
          assign(operation, createdOperation);
        }
      });
    }

    if (operationsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${operationsToUpdate.length} operations`);
      }

      operationsToUpdate.forEach(async (operation) => {
        const updatedOperation = await client.request(updateOperation(operation.id!, operation));
        assign(operation, updatedOperation);
      });
    }

    // set flow operation ids and then update the flow
    flows.forEach(async (flow) => {
      if ((flow as any).operation_key) {
        const operation = find(operations, ['key', (flow as any).operation_key]);
        if (!operation) {
          return;
        }

        (flow as any).operation = operation.id;

        try {
          const updatedFlow = await client.request(updateFlow(flow.id!, {
            operation: flow.operation,
          }));
          assign(flow, updatedFlow);
        } catch (err: any) {
          console.error(err, flow);
        }
      }
    });

    // set resolve and reject ids to operations and then update those
    operations.forEach(async (operation) => {
      if (operation.resolve_key) {
        const resolveOperation = find(operations, ['key', operation.resolve_key]);
        (operation as any).resolve = resolveOperation ? resolveOperation.id : null;
      }

      if (operation.reject_key) {
        const rejectOperation = find(operations, ['key', operation.reject_key]);
        (operation as any).reject = rejectOperation ? rejectOperation.id : null;
      }

      if (operation.resolve || operation.reject) {
        try {
          // TODO: for some reason
          const updatedOperation = await client.request(updateOperation(operation.id!, {
            resolve: operation.resolve,
            reject: operation.reject,
          }));

          assign(operation, updatedOperation);
        } catch (err: any) {
          console.error(err, operation);
        }
      }
    });

    if (options.verbose) {
      console.info('Flows imported');
    }
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

export default importFlows;
