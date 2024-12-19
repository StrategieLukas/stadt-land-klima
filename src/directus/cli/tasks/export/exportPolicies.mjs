import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readPolicies } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportPolicies(dest, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();
  try {
    // Fetch policies
    const policies = await client.request(readPolicies());

    if (!policies || !policies.length) {
      console.log('No policies found to export.');
      return;
    }

    fse.mkdirSync(dest);

    policies.forEach((policy) => {
      const destPath = path.join(dest, slugify(policy.name, { replacement: '_', remove: ":", lower: true}) + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      fse.writeFileSync(
        destPath,
        stringify(policy),
        { encoding: 'utf8' }
      );

      if (options.verbose) {
        console.info(`Exported policy ${destPath}`);
      }
    });

  } catch (error) {
        console.error(error);
        return process.exit(1);
  }
}

export default exportPolicies;
