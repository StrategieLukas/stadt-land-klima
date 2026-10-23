import { readFlows, readOperations } from '@directus/sdk';
import fse from 'node:fs';
import path from 'path';
import slugify from 'slugify';
import { stringify } from 'yaml';
import createDirectusClient from '../shared/createDirectusClient.ts';
import type { Flow, Operation, TaskOptions } from '../shared/models.ts';
import {
  ApiFlowSchema,
  OperationSchema,
  requiredId,
} from '../shared/models.ts';

async function exportFlows(dest: string, options: TaskOptions = {}) {
  const client = createDirectusClient();

  try {
    const flows = ApiFlowSchema.array().parse(
      await client.request(readFlows({ limit: -1 })),
    );
    const operations = OperationSchema.array().parse(
      await client.request(readOperations({ limit: -1 })),
    );

    // create lookup tables for operations and flows
    const flowsById: Record<string, Flow> = {};
    const operationsByKey: Record<string, Operation> = {};
    const operationsById: Record<string, Operation> = {};
    flows.forEach((flow) => {
      flowsById[requiredId(flow.id)] = flow;
    });
    operations.forEach((operation) => {
      operationsByKey[operation.key] = operation;
      operationsById[requiredId(operation.id)] = operation;
    });

    fse.mkdirSync(dest, { recursive: true });

    flows.forEach((flow) => {
      const destPath = path.join(
        dest,
        slugify(flow.name, { replacement: '_', lower: false }) + '.yaml',
      );

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      flow.operations = operations
        .filter((operation) => {
          return operation.flow === flow.id;
        })
        .map((operation) => {
          delete operation.flow;
          delete operation.id;
          delete operation.user_created;
          delete operation.date_created;

          if (operation.resolve && operationsById[operation.resolve]) {
            operation.resolve_key = operationsById[operation.resolve].key;
          }

          if (operation.reject && operationsById[operation.reject]) {
            operation.reject_key = operationsById[operation.reject].key;
          }

          if (
            operation.type === 'trigger' &&
            operation.options &&
            operation.options.flow
          ) {
            operation.options.flow_name =
              flowsById[requiredId(operation.options.flow)].name;
            delete operation.options.flow;
          }

          delete operation.resolve;
          delete operation.reject;

          return operation;
        });

      delete flow.id;
      delete flow.date_created;
      delete flow.user_created;
      if (flow.operation && operationsById[flow.operation]) {
        flow.operation_key = operationsById[flow.operation].key;
      }

      delete flow.operation;

      fse.writeFileSync(destPath, stringify(flow), { encoding: 'utf8' });

      if (options.verbose) {
        console.info(`Exported flow ${destPath}`);
      }
    });

    if (options.verbose) {
      console.info('All flows exported.');
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default exportFlows;
