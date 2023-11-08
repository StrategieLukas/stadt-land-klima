import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readFlows, readOperations } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportFlows(dest, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const flows = await client.request(readFlows({limit: -1}));
    const operations = await client.request(readOperations({limit: -1}));

    // create lookup tables for operations and flows
    const flowsById = {};
    const operationsByKey = {};
    const operationsById = {};
    flows.forEach((flow) => {
      flowsById[flow.id] = flow;
    });
    operations.forEach((operation) => {
      operationsByKey[operation.key] = operation;
      operationsById[operation.id] = operation;
    });

    fse.mkdirSync(dest);

    flows.forEach((flow) => {
      const destPath = path.join(dest, slugify(flow.name, '_') + '.yaml');

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

        if (operation.type === 'trigger' && operation.options && operation.options.flow) {
          operation.options.flow_name = flowsById[operation.options.flow].name;
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

      fse.writeFileSync(
        destPath,
        stringify(flow),
        { encoding: 'utf8' }
      );

      if (options.verbose) {
        console.info(`Exported flow ${destPath}`);
      }
    });

    if (options.verbose) {
      console.info('All flows exported.');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportFlows;
