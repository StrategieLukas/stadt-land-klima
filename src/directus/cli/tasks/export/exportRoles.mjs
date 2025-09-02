import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readRoles, readPermissions } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

async function exportRoles(dest, options = { verbose: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    const roles = await client.request(
      readRoles({
        limit: -1,
        filter: {
          name: { _neq: "Administrator" },
        },
      })
    );
    const permissions = await client.request(readPermissions({ limit: -1 }));

    fse.mkdirSync(dest, { recursive: true });

    // Export all roles except Administrator
    roles.forEach((role) => {
      const destPath = path.join(dest, slugify(role.name, '_') + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) console.info(`File ${destPath} already exists.`);
        return;
      }

      delete role.users;

      role.permissions = permissions
        .filter((permission) => permission.role === role.id)
        .map((permission) => {
          delete permission.id;
          delete permission.role;
          return permission;
        })
        // 🔹 Ensure deterministic order
        .sort((a, b) => {
          if (a.collection === b.collection) {
            if (a.action === b.action) return 0;
            return a.action < b.action ? -1 : 1;
          }
          return a.collection < b.collection ? -1 : 1;
        });

      delete role.id;

      fse.writeFileSync(destPath, stringify(role), { encoding: 'utf8' });

      if (options.verbose) console.info(`Exported role ${destPath}`);
    });

    // 🔹 Export public permissions (role = null)
    const publicPerms = permissions.filter((permission) => permission.role === null);
    if (publicPerms.length) {
      const destPath = path.join(dest, 'public.yaml');
      const publicRole = {
        name: 'Public',
        description: 'Unauthenticated access',
        permissions: publicPerms.map((permission) => {
          delete permission.id;
          delete permission.role;
          return permission;
        }),
      };

      fse.writeFileSync(destPath, stringify(publicRole), { encoding: 'utf8' });

      if (options.verbose) console.info(`Exported Public role to ${destPath}`);
    }

    if (options.verbose) console.info('All roles exported.');
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportRoles;
