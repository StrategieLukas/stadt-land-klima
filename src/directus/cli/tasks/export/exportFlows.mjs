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

    fse.mkdirSync(dest);

    flows.forEach((flow) => {
      const destPath = path.join(dest, slugify(flow.name, '_') + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      flow.operations = operations.filter((operation) => {
        return operation.flow = flow.id;
      });

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
