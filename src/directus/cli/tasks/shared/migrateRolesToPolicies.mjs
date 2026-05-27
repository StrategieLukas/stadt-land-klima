import fse from 'fse';
import path from 'path';
import { parse, stringify } from 'yaml';
import slugify from 'slugify';

/**
 * Migration script to convert old Directus v10 role YAML files to v11+ format
 *
 * In v10: Roles had permissions directly attached
 * In v11+: Permissions are in policies, roles reference policies by ID
 *
 * This script:
 * 1. Reads old role YAML files with permissions
 * 2. Creates policy YAML files with the permissions
 * 3. Updates role YAML files to reference the policies
 *
 * Usage: node migrateRolesToPolicies.mjs /path/to/roles/folder /path/to/policies/folder
 */

function parseYamlFile(filePath) {
  const content = fse.readFileSync(filePath, 'utf8');
  return parse(content);
}

async function migrateRolesToPolicies(rolesSrc, policiesDest) {
  console.log(`Migrating roles from ${rolesSrc} to policies format`);
  console.log(`Policies will be saved to ${policiesDest}`);

  // Create policies directory if it doesn't exist
  fse.mkdirSync(policiesDest, { recursive: true });

  // Read all role files
  const roleFiles = fse.readdirSync(rolesSrc).filter(f =>
    (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('.')
  );

  let migratedCount = 0;
  let policyCount = 0;

  for (const roleFile of roleFiles) {
    const rolePath = path.join(rolesSrc, roleFile);
    let role;

    try {
      role = parseYamlFile(rolePath);
    } catch (err) {
      console.warn(`Could not parse ${roleFile}: ${err.message}`);
      continue;
    }

    if (!role.name) {
      console.warn(`Skipping ${roleFile}: no name field`);
      continue;
    }

    // Skip if role already has policies (already migrated)
    if (role.policies && role.policies.length > 0) {
      console.log(`Skipping ${role.name}: already has policies`);
      continue;
    }

    if (!role.permissions || role.permissions.length === 0) {
      console.log(`Skipping ${role.name}: no permissions`);
      continue;
    }

    // Create a policy for this role's permissions
    const policyName = `${role.name} Policy`;
    const policySlug = slugify(policyName, { replacement: '_', lower: true });
    const policyFile = path.join(policiesDest, `${policySlug}.yaml`);

    // Create policy with permissions
    const policy = {
      name: policyName,
      description: `Auto-migrated policy from ${role.name} role`,
      permissions: role.permissions.map(perm => {
        const cleanPerm = { ...perm };
        // Remove role reference if it exists
        delete cleanPerm.role;
        delete cleanPerm.role_name;
        delete cleanPerm.policy;
        delete cleanPerm.id;
        return cleanPerm;
      }),
    };

    // Write policy file
    fse.writeFileSync(policyFile, stringify(policy), { encoding: 'utf8' });
    policyCount++;

    // Update role to reference the policy
    const updatedRole = { ...role };
    delete updatedRole.permissions;

    // Store policy name as reference (will be resolved during import)
    updatedRole.policies = [policyName];

    // Write updated role file
    fse.writeFileSync(rolePath, stringify(updatedRole), { encoding: 'utf8' });
    migratedCount++;

    console.log(`Migrated ${role.name}: created policy "${policyName}"`);
  }

  console.log(`\nMigration complete:`);
  console.log(`- Migrated ${migratedCount} roles`);
  console.log(`- Created ${policyCount} policies`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the generated policy files in ${policiesDest}`);
  console.log(`2. Run: ./directus-cli import:policies ${policiesDest}`);
  console.log(`3. Run: ./directus-cli import:roles ${rolesSrc}`);
}

// Check if this is being run directly
const isMainModule = import.meta.url.endsWith(process.argv[1]);
if (isMainModule) {
  const rolesSrc = process.argv[2] || path.join(process.cwd(), 'roles');
  const policiesDest = process.argv[3] || path.join(process.cwd(), 'policies');

  migrateRolesToPolicies(rolesSrc, policiesDest).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

export default migrateRolesToPolicies;
