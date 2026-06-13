import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readPolicies,
  createPolicies,
  updatePolicy,
  deletePolicies,
  createPermissions,
  deletePermissions,
  readPermissions,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

function assertUniquePolicyNames(policies) {
  const policiesByName = new Map();

  for (const policy of policies) {
    if (!policy.name) continue;

    const existing = policiesByName.get(policy.name) || [];
    existing.push(policy.id);
    policiesByName.set(policy.name, existing);
  }

  const duplicates = Array.from(policiesByName.entries())
  .filter(([, ids]) => ids.length > 1);

  if (duplicates.length > 0) {
    const details = duplicates
    .map(([name, ids]) => `"${name}" (${ids.join(', ')})`)
    .join('; ');

    throw new Error(`Duplicate Directus policy names found. Policy names must be unique for import: ${details}`);
  }
}

function getPermissionPayload(permission, policyId) {
  const { id, policy, role, ...payload } = permission;
  return { ...payload, policy: policyId };
}

/**
 * Import policies and permissions for Directus v11+
 *
 * In Directus v11, permissions are attached to POLICIES, not directly to roles.
 * This imports policies with their associated permissions.
 *
 * YAML file format:
 * - name: Policy name
 * - icon: Optional icon
 * - description: Optional description
 * - ip_access: Optional IP access list
 * - enforce_tfa: Optional boolean
 * - admin_access: Optional boolean
 * - app_access: Optional boolean
 * - permissions: Array of permission objects
 */
async function importPolicies(src, options = { verbose: false, remove: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    // Get existing policies and permissions
    const existingPolicies = await client.request(readPolicies({ limit: -1 }));
    assertUniquePolicyNames(existingPolicies);

    // Read policy YAML files
    const policies = readYamlFiles(path.join(src));

    const policiesToCreate = [];
    const policiesToUpdate = [];

    // Track which permissions belong to which policy
    const policyPermissionMap = new Map(); // policyName -> permissions

    // --- Process policies and collect permissions ---
    policies.forEach((policy) => {
      const policyPermissions = policy.permissions || [];
      policyPermissionMap.set(policy.name, policyPermissions);
      delete policy.permissions;

      const existingPolicy = find(existingPolicies, ['name', policy.name]);

      if (existingPolicy) {
        policy.id = existingPolicy.id;
        policiesToUpdate.push(policy);
      } else {
        policiesToCreate.push(policy);
      }
    });

    // --- Create/Update Policies ---
    let createdPolicies = [];
    if (policiesToCreate.length) {
      if (options.verbose) console.info(`Creating ${policiesToCreate.length} policies`);
      createdPolicies = await client.request(createPolicies(policiesToCreate));

      // Update the policy objects with the newly created IDs
      createdPolicies.forEach((createdPolicy) => {
        const policy = find(policiesToCreate, ['name', createdPolicy.name]);
        if (policy) policy.id = createdPolicy.id;
      });
    }

    if (policiesToUpdate.length) {
      if (options.verbose) console.info(`Updating ${policiesToUpdate.length} policies`);
      await Promise.all(
        policiesToUpdate.map((policy) => {
          const { id, ...data } = policy;
          return client.request(updatePolicy(id, data)).catch((err) => {
            console.error(err, policy);
          });
        })
      );
    }

    // --- Refresh policies list to get all IDs ---
    const updatedPolicies = await client.request(readPolicies({ limit: -1 }));
    assertUniquePolicyNames(updatedPolicies);
    const existingPermissions = await client.request(readPermissions({ limit: -1 }));

    // --- Replace permissions for each managed policy ---
    for (const policy of policies) {
      const policyName = policy.name;
      const policyPermissions = policyPermissionMap.get(policyName) || [];

      // Find the policy ID (either from existing or newly created)
      const policyObj = find(updatedPolicies, ['name', policyName]);
      if (!policyObj) {
        console.warn(`Could not find policy with name ${policyName}`);
        continue;
      }

      const policyPermissionsToDelete = existingPermissions
      .filter((permission) => permission.policy === policyObj.id && permission.id)
      .map(property('id'));

      if (policyPermissionsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${policyPermissionsToDelete.length} existing permissions for policy ${policyName}`);
        }
        await client.request(deletePermissions(policyPermissionsToDelete));
      }

      const permissionsToCreate = policyPermissions.map((permission) =>
        getPermissionPayload(permission, policyObj.id)
      );

      if (permissionsToCreate.length) {
        if (options.verbose) console.info(`Creating ${permissionsToCreate.length} permissions for policy ${policyName}`);
        await client.request(createPermissions(permissionsToCreate)).catch((err) => {
          console.error(`Error creating permissions for policy ${policyName} (${policyObj.id})`, permissionsToCreate);
          throw err;
        });
      }
    }

    // --- Remove orphaned policies and permissions ---
    if (options.remove) {
      const policiesToDelete = existingPolicies.filter((existingPolicy) => {
        // Don't delete admin policies
        if (existingPolicy.admin_access === true) return false;
        // Don't delete policies that are referenced by roles
        return !find(policies, ['name', existingPolicy.name]);
      });

      const permissionsToDelete = existingPermissions.filter((existingPermission) => {
        if (!existingPermission.id || !existingPermission.policy) return false;

        // Check if this permission belongs to a policy that still exists
        const policyStillExists = find(updatedPolicies, ['id', existingPermission.policy]);
        if (!policyStillExists) return true;

        // Check if this permission is still in the YAML
        const policy = find(policies, ['name', policyStillExists.name]);
        if (!policy) return true;

        const policyPermissions = policyPermissionMap.get(policy.name) || [];
        return !find(policyPermissions, {
          action: existingPermission.action,
          collection: existingPermission.collection,
        });
      });

      if (permissionsToDelete.length) {
        if (options.verbose) console.info(`Removing ${permissionsToDelete.length} permissions`);
        const permissionsToDeleteIds = permissionsToDelete
          .map(property('id'))
          .filter(id => id && id !== '');
        if (permissionsToDeleteIds.length) {
          await client.request(deletePermissions(permissionsToDeleteIds));
        }
      }

      if (policiesToDelete.length) {
        if (options.verbose) console.info(`Removing ${policiesToDelete.length} policies`);
        const policiesToDeleteIds = policiesToDelete
          .map(property('id'))
          .filter(id => id && id !== '');
        if (policiesToDeleteIds.length) {
          await client.request(deletePolicies(policiesToDeleteIds));
        }
      }
    }

    if (options.verbose) console.info('Policies and permissions imported');
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importPolicies;
