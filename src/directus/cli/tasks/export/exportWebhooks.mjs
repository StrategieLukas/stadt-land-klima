import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readWebhooks } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportWebhooks(dest, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const webhooks = await client.request(readWebhooks({limit: 100}));

    fse.mkdirSync(dest);

    webhooks.forEach((webhook) => {
      const destPath = path.join(dest, slugify(webhook.name, '_') + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      fse.writeFileSync(
        destPath,
        stringify(webhook),
        { encoding: 'utf8' }
      );

      if (options.verbose) {
        console.info(`Exported webhook ${destPath}`);
      }
    });

    if (options.verbose) {
      console.info('All webhooks exported.');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportWebhooks;
