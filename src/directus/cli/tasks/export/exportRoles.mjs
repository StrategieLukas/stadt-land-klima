import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readRoles, readPermissions } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportRoles(dest, options = {verbose: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const roles = await client.request(readRoles({limit: 1000}));
    const permissions = await client.request(readPermissions({limit: 10000}));

    fse.mkdirSync(dest);

    roles.forEach((role) => {
      const destPath = path.join(dest, slugify(role.name, '_') + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      delete role.users;

      role.permissions = permissions.filter((permission) => {
        return permission.role === role.id;
      }).map((permission) => {
        delete permission.id;
        return permission;
      });

      fse.writeFileSync(
        destPath,
        stringify(role),
        { encoding: 'utf8' }
      );

      if (options.verbose) {
        console.info(`Exported role ${destPath}`);
      }
    });

    if (options.verbose) {
      console.info('All roles exported.');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportRoles;
