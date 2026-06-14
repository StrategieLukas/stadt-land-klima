import path from 'path';
import importPolicies from './importPolicies.mjs';
import importRoles from './importRoles.mjs';

/**
 * Import roles and policies for Directus v11+.
 *
 * Source directory structure:
 * - {src}/policies/  - policy YAML files
 * - {src}/roles/     - role YAML files
 */
async function importRolesAndPolicies(src, options = { verbose: false, remove: false, overwrite: false }) {
  try {
    if (options.verbose) console.info('Importing policies...');
    await importPolicies(path.join(src, 'policies'), options);

    if (options.verbose) console.info('Importing roles...');
    await importRoles(path.join(src, 'roles'), options);

    if (options.verbose) console.info('Roles and policies imported');
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importRolesAndPolicies;
