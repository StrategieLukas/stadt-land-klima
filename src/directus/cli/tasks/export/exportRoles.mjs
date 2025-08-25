import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readRoles, readPermissions } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportRoles(dest, options = { verbose: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    const roles = await client.request(readRoles({ limit: -1 }));
    const permissions = await client.request(readPermissions({ limit: -1 }));

    fse.mkdirSync(dest, { recursive: true });

    // Add public role
    roles.push({ id: null, name: "public" });

    roles
    .filter((role) => role.name !== 'Administrator')
    .forEach((role) => {
      const destPath = path.join(dest, slugify(role.name, "_") + ".yaml");

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) {
          console.info(`File ${destPath} already exists.`);
        }
        return;
      }

      const rolePermissions = permissions
        .filter((permission) => permission.role === role.id)
        .map((permission) => {
          delete permission.id;
          delete permission.role;
          return permission;
        });

      const roleData = { ...role };
      delete roleData.users;
      delete roleData.id;
      roleData.permissions = rolePermissions;

      fse.writeFileSync(destPath, stringify(roleData), { encoding: "utf8" });

      if (options.verbose) {
        console.info(`Exported role ${destPath}`);
      }
    });

    if (options.verbose) {
      console.info("All roles exported.");
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}



export default exportRoles;
