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
import clearDirectusCache from '../shared/clearDirectusCache.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';
import { readPolicyByNameFromDatabase } from '../shared/resolvePolicyByName.mjs';

const POLICY_RETRY_ATTEMPTS = 5;
const POLICY_RETRY_DELAY_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function isInvalidPolicyForeignKeyError(err) {
  const messages = [
    err?.message,
    ...(Array.isArray(err?.errors) ? err.errors.map((error) => error?.message) : []),
  ]
  .filter(Boolean)
  .join('\n');

  return messages.includes('Invalid foreign key') && messages.includes('field "policy"');
}

async function removePolicyPermissions(client, existingPermissions, policyId, policyName, verbose) {
  const policyPermissionsToDelete = existingPermissions
  .filter((permission) => permission.policy === policyId && permission.id)
  .map(property('id'));

  if (policyPermissionsToDelete.length) {
    if (verbose) {
      console.info(`Removing ${policyPermissionsToDelete.length} existing permissions for policy ${policyName}`);
    }
    await client.request(deletePermissions(policyPermissionsToDelete));
  }
}

async function resolvePolicyForPermissionWrite(client, policyName, policyObj, options) {
  let apiPolicy = policyObj || null;

  for (let attempt = 1; attempt <= POLICY_RETRY_ATTEMPTS; attempt++) {
    const databasePolicy = await readPolicyByNameFromDatabase(policyName, options.verbose);

    if (databasePolicy) {
      if (!apiPolicy) {
        console.warn(
          `Policy ${policyName} was not visible via Directus API, but ${databasePolicy.id} exists in directus_policies; using that ID through the Directus API.`
        );
        return databasePolicy;
      }

      if (apiPolicy.id !== databasePolicy.id) {
        console.warn(
          `Policy ${policyName} resolved to ${apiPolicy.id} via Directus API, but ${databasePolicy.id} exists in directus_policies; using the database ID through the Directus API.`
        );
        return databasePolicy;
      }

      return apiPolicy;
    }

    if (apiPolicy) {
      return apiPolicy;
    }

    if (attempt < POLICY_RETRY_ATTEMPTS) {
      await clearDirectusCache({ verbose: options.verbose });
      await sleep(POLICY_RETRY_DELAY_MS);
      const policies = await client.request(readPolicies({ limit: -1 }));
      assertUniquePolicyNames(policies);
      apiPolicy = find(policies, ['name', policyName]) || null;
    }
  }

  return null;
}

async function readPolicyForDiagnostics(client, policyName) {
  const policies = await client.request(readPolicies({ limit: -1 }));
  assertUniquePolicyNames(policies);
  return find(policies, ['name', policyName]) || null;
}

async function logPolicyForeignKeyDiagnostics(client, policyName, policyId) {
  const [apiPolicy, databasePolicy] = await Promise.all([
    readPolicyForDiagnostics(client, policyName).catch(() => null),
    readPolicyByNameFromDatabase(policyName, false).catch(() => null),
  ]);

  console.error(
    `Directus rejected policy ${policyName} (${policyId}) while creating permissions. ` +
    `API id: ${apiPolicy?.id || 'not visible'}; database id: ${databasePolicy?.id || 'not readable'}. ` +
    'No direct database writes were attempted.'
  );
}

async function createPermissionsForPolicy(client, policyName, policyPermissions, policyObj, existingPermissions, options) {
  let resolvedPolicy = await resolvePolicyForPermissionWrite(client, policyName, policyObj, options);

  if (!resolvedPolicy) {
    throw new Error(`Could not find policy with name ${policyName}`);
  }

  await removePolicyPermissions(client, existingPermissions, resolvedPolicy.id, policyName, options.verbose);

  let permissionsToCreate = policyPermissions.map((permission) =>
    getPermissionPayload(permission, resolvedPolicy.id)
  );

  if (!permissionsToCreate.length) return resolvedPolicy.id;

  if (options.verbose) console.info(`Creating ${permissionsToCreate.length} permissions for policy ${policyName}`);

  try {
    await client.request(createPermissions(permissionsToCreate));
  } catch (err) {
    if (!isInvalidPolicyForeignKeyError(err)) {
      console.error(`Error creating permissions for policy ${policyName} (${resolvedPolicy.id})`, permissionsToCreate);
      throw err;
    }

    console.warn(`Policy ID ${resolvedPolicy.id} for ${policyName} was rejected by Directus; clearing cache and retrying by policy name.`);
    await clearDirectusCache({ verbose: options.verbose });

    const refreshedPolicies = await client.request(readPolicies({ limit: -1 }));
    assertUniquePolicyNames(refreshedPolicies);
    const refreshedPolicyObj = find(refreshedPolicies, ['name', policyName]);
    resolvedPolicy = await resolvePolicyForPermissionWrite(client, policyName, refreshedPolicyObj, options);

    if (!resolvedPolicy) {
      console.error(`Error creating permissions for policy ${policyName}`, permissionsToCreate);
      throw err;
    }

    const refreshedPermissions = await client.request(readPermissions({ limit: -1 }));
    await removePolicyPermissions(client, refreshedPermissions, resolvedPolicy.id, policyName, options.verbose);

    permissionsToCreate = policyPermissions.map((permission) =>
      getPermissionPayload(permission, resolvedPolicy.id)
    );

    try {
      await client.request(createPermissions(permissionsToCreate));
    } catch (retryErr) {
      if (isInvalidPolicyForeignKeyError(retryErr)) {
        await logPolicyForeignKeyDiagnostics(client, policyName, resolvedPolicy.id);
      }

      if (!isInvalidPolicyForeignKeyError(retryErr)) {
        console.error(`Error creating permissions for policy ${policyName} (${resolvedPolicy.id})`, permissionsToCreate);
      }

      throw retryErr;
    }
  }

  return resolvedPolicy.id;
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
            console.error(`Error updating policy ${policy.name || id}`, err);
            throw err;
          });
        })
      );
    }

    // --- Refresh policies list to get all IDs ---
    await clearDirectusCache({ verbose: options.verbose });
    const updatedPolicies = await client.request(readPolicies({ limit: -1 }));
    assertUniquePolicyNames(updatedPolicies);
    const existingPermissions = await client.request(readPermissions({ limit: -1 }));
    const managedPolicyIdsByName = new Map();

    // --- Replace permissions for each managed policy ---
    for (const policy of policies) {
      const policyName = policy.name;
      const policyPermissions = policyPermissionMap.get(policyName) || [];

      // Find the policy ID (either from existing or newly created)
      const policyObj = find(updatedPolicies, ['name', policyName]);
      if (!policyObj) {
        console.warn(`Policy ${policyName} was not visible after policy import; trying persistence-aware fallback before skipping permissions.`);
      }

      const policyId = await createPermissionsForPolicy(client, policyName, policyPermissions, policyObj, existingPermissions, options);
      if (policyId) {
        managedPolicyIdsByName.set(policyName, policyId);
      }
    }

    // --- Remove orphaned policies and permissions ---
    if (options.remove) {
      const allPolicies = await client.request(readPolicies({ limit: -1 }));
      const allPermissions = await client.request(readPermissions({ limit: -1 }));
      const managedPolicyNamesById = new Map(
        Array.from(managedPolicyIdsByName.entries()).map(([name, id]) => [id, name])
      );
      const managedPolicyIdSet = new Set(managedPolicyIdsByName.values());

      const policiesToDelete = allPolicies.filter((existingPolicy) => {
        // Don't delete admin policies
        if (existingPolicy.admin_access === true) return false;
        // Don't delete policies that are referenced by roles
        return !find(policies, ['name', existingPolicy.name]);
      });

      const permissionsToDelete = allPermissions.filter((existingPermission) => {
        if (!existingPermission.id || !existingPermission.policy) return false;

        // Check if this permission belongs to a policy that still exists
        const policyStillExists =
          managedPolicyIdSet.has(existingPermission.policy) ||
          find(updatedPolicies, ['id', existingPermission.policy]);
        if (!policyStillExists) return true;

        // Check if this permission is still in the YAML
        const policyName = managedPolicyNamesById.get(existingPermission.policy) || policyStillExists.name;
        const policy = find(policies, ['name', policyName]);
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
