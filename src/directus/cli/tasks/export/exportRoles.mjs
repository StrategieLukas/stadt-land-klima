import fse from 'fse';
import path from 'path';
import { stringify } from 'yaml';
import { readRoles } from '@directus/sdk';
import slugify from 'slugify';
import createDirectusClient from '../shared/createDirectusClient.mjs';

/**
 * Export roles for Directus v11+
 * 
 * In Directus v11, roles no longer hold permissions directly.
 * Instead, roles have policies attached to them via many-to-many relationship.
 * This exports roles with their attached policies (by ID reference).
 * 
 * The actual policy definitions (with permissions) are exported separately.
 */
async function exportRoles(dest, options = { verbose: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    const roles = await client.request(
      readRoles({
        limit: -1,
        filter: {
          name: { _neq: "Administrator" },
        },
        fields: ['*', 'policies.*', 'users.*', 'children.*'],
      })
    );

    fse.mkdirSync(dest, { recursive: true });

    let exportedCount = 0;

    // Export all roles except Administrator
    roles.forEach((role) => {
      const destPath = path.join(dest, slugify(role.name, { replacement: '_', lower: true }) + '.yaml');

      if (!options.overwrite && fse.existsSync(destPath)) {
        if (options.verbose) console.info(`File ${destPath} already exists.`);
        return;
      }

      // Clean up role data for export
      const cleanRole = {
        name: role.name,
        icon: role.icon || null,
        description: role.description || null,
        parent: role.parent || null,
        children: role.children ? role.children.map(c => c.id || c) : [],
        // Store policy IDs that are attached to this role
        // These reference policies that are exported separately
        policies: role.policies ? role.policies.map(p => p.id || p) : [],
      };

      // Remove null/undefined values for cleaner YAML
      Object.keys(cleanRole).forEach((key) => {
        if (cleanRole[key] === null || cleanRole[key] === undefined) {
          delete cleanRole[key];
        }
      });

      // Remove id field for export
      delete cleanRole.id;
      if (cleanRole.users) delete cleanRole.users;

      fse.writeFileSync(destPath, stringify(cleanRole), { encoding: 'utf8' });
      exportedCount++;

      if (options.verbose) console.info(`Exported role ${destPath}`);
    });

    if (options.verbose) {
      console.info(`Exported ${exportedCount} roles.`);
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default exportRoles;
