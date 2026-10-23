import type { DirectusPermission } from "@directus/sdk";
import {
  createPermissions,
  createPolicies,
  deletePermissions,
  deletePolicies,
  readPermissions,
  readPolicies,
  updatePolicy,
} from "@directus/sdk";
import find from "lodash/find.js";
import path from "path";
import clearDirectusCache from "../shared/clearDirectusCache.ts";
import createDirectusClient from "../shared/createDirectusClient.ts";
import type { CliClient, NamedRecord, Permission, Policy, TaskOptions } from "../shared/models.ts";
import { errorMessages, PolicySchema, requiredId } from "../shared/models.ts";
import readYamlFiles from "../shared/readYamlFiles.ts";
import resolvePolicyByName from "../shared/resolvePolicyByName.ts";

function assertUniquePolicyNames(policies: NamedRecord[]) {
  const policiesByName = new Map<string, string[]>();

  for (const policy of policies) {
    if (!policy.name) continue;

    const existing = policiesByName.get(policy.name) || [];
    existing.push(policy.id);
    policiesByName.set(policy.name, existing);
  }

  const duplicates = Array.from(policiesByName.entries()).filter(([, ids]) => ids.length > 1);

  if (duplicates.length > 0) {
    const details = duplicates.map(([name, ids]) => `"${name}" (${ids.join(", ")})`).join("; ");

    throw new Error(`Duplicate Directus policy names found. Policy names must be unique for import: ${details}`);
  }
}

function getPermissionPayload(permission: Permission, policyId: string) {
  const { id, policy, role, ...payload } = permission;
  return { ...payload, policy: policyId };
}

function isInvalidPolicyForeignKeyError(err: unknown) {
  const messages = errorMessages(err);

  return messages.includes("Invalid foreign key") && messages.includes('field "policy"');
}

async function removePolicyPermissions(
  client: CliClient,
  existingPermissions: DirectusPermission<{}>[],
  policyId: string,
  policyName: string,
  verbose = false,
) {
  const policyPermissionsToDelete = existingPermissions
    .filter((permission) => permission.policy === policyId && permission.id)
    .map((item) => item.id);

  if (policyPermissionsToDelete.length) {
    if (verbose) {
      console.info(`Removing ${policyPermissionsToDelete.length} existing permissions for policy ${policyName}`);
    }
    await client.request(deletePermissions(policyPermissionsToDelete));
  }
}

async function createPermissionsForPolicy(
  client: CliClient,
  policyName: string,
  policyPermissions: Permission[],
  policyObj: NamedRecord,
  existingPermissions: DirectusPermission<{}>[],
  options: TaskOptions,
) {
  let resolvedPolicy = await resolvePolicyByName(client, policyName, [policyObj], options);

  if (!resolvedPolicy) {
    throw new Error(`Could not find policy with name ${policyName}`);
  }

  await removePolicyPermissions(client, existingPermissions, resolvedPolicy.id, policyName, options.verbose);

  let permissionsToCreate = policyPermissions.map((permission) =>
    getPermissionPayload(permission, requiredId(resolvedPolicy?.id)),
  );

  if (!permissionsToCreate.length) return;

  if (options.verbose) console.info(`Creating ${permissionsToCreate.length} permissions for policy ${policyName}`);

  try {
    await client.request(createPermissions(permissionsToCreate));
  } catch (err) {
    if (!isInvalidPolicyForeignKeyError(err)) {
      console.error(`Error creating permissions for policy ${policyName} (${resolvedPolicy.id})`, permissionsToCreate);
      throw err;
    }

    console.warn(
      `Policy ID ${resolvedPolicy.id} for ${policyName} was rejected by Directus; clearing cache and retrying by policy name.`,
    );
    await clearDirectusCache({ verbose: options.verbose });

    const refreshedPolicies = await client.request(readPolicies({ limit: -1 }));
    assertUniquePolicyNames(refreshedPolicies);
    resolvedPolicy = await resolvePolicyByName(client, policyName, refreshedPolicies, options);

    if (!resolvedPolicy) {
      console.error(`Error creating permissions for policy ${policyName}`, permissionsToCreate);
      throw err;
    }

    const refreshedPermissions = await client.request(readPermissions({ limit: -1 }));
    await removePolicyPermissions(client, refreshedPermissions, resolvedPolicy.id, policyName, options.verbose);

    permissionsToCreate = policyPermissions.map((permission) =>
      getPermissionPayload(permission, requiredId(resolvedPolicy?.id)),
    );

    try {
      await client.request(createPermissions(permissionsToCreate));
    } catch (retryErr) {
      console.error(`Error creating permissions for policy ${policyName} (${resolvedPolicy.id})`, permissionsToCreate);
      throw retryErr;
    }
  }
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
async function importPolicies(src: string, options: TaskOptions = {}) {
  const client = createDirectusClient();

  try {
    // Get existing policies and permissions
    const existingPolicies = await client.request(readPolicies({ limit: -1 }));
    assertUniquePolicyNames(existingPolicies);

    // Read policy YAML files
    const policies = readYamlFiles(path.join(src), PolicySchema);

    const policiesToCreate: Policy[] = [];
    const policiesToUpdate: Policy[] = [];

    // Track which permissions belong to which policy
    const policyPermissionMap = new Map<string, Permission[]>(); // policyName -> permissions

    // --- Process policies and collect permissions ---
    policies.forEach((policy) => {
      const policyPermissions = policy.permissions || [];
      policyPermissionMap.set(policy.name, policyPermissions);
      delete policy.permissions;

      const existingPolicy = find(existingPolicies, ["name", policy.name]);

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
      createdPolicies = await client.request(
        createPolicies(
          policiesToCreate.map((policy) => ({
            ...policy,
            icon: policy.icon ?? undefined,
          })),
        ),
      );

      // Update the policy objects with the newly created IDs
      createdPolicies.forEach((createdPolicy) => {
        const policy = find(policiesToCreate, ["name", createdPolicy.name]);
        if (policy) policy.id = createdPolicy.id;
      });
    }

    if (policiesToUpdate.length) {
      if (options.verbose) console.info(`Updating ${policiesToUpdate.length} policies`);
      await Promise.all(
        policiesToUpdate.map((policy) => {
          const { id, ...data } = policy;
          return client
            .request(
              updatePolicy(requiredId(id), {
                ...data,
                icon: data.icon ?? undefined,
              }),
            )
            .catch((err) => {
              console.error(err, policy);
              throw err;
            });
        }),
      );
    }

    // --- Refresh policies list to get all IDs ---
    await clearDirectusCache({ verbose: options.verbose });
    const updatedPolicies = await client.request(readPolicies({ limit: -1 }));
    assertUniquePolicyNames(updatedPolicies);
    const existingPermissions = await client.request(readPermissions({ limit: -1 }));

    // --- Replace permissions for each managed policy ---
    for (const policy of policies) {
      const policyName = policy.name;
      const policyPermissions = policyPermissionMap.get(policyName) || [];

      // Find the policy ID (either from existing or newly created)
      const policyObj = find(updatedPolicies, ["name", policyName]);
      if (!policyObj) {
        console.warn(`Could not find policy with name ${policyName}`);
        continue;
      }

      await createPermissionsForPolicy(client, policyName, policyPermissions, policyObj, existingPermissions, options);
    }

    // --- Remove orphaned policies and permissions ---
    if (options.remove) {
      const allPolicies = await client.request(readPolicies({ limit: -1 }));
      const allPermissions = await client.request(readPermissions({ limit: -1 }));

      const policiesToDelete = allPolicies.filter((existingPolicy) => {
        // Don't delete admin policies
        if (existingPolicy.admin_access === true) return false;
        // Don't delete policies that are referenced by roles
        return !find(policies, ["name", existingPolicy.name]);
      });

      const permissionsToDelete = allPermissions.filter((existingPermission) => {
        if (!existingPermission.id || !existingPermission.policy) return false;

        // Check if this permission belongs to a policy that still exists
        const policyStillExists = find(updatedPolicies, ["id", existingPermission.policy]);
        if (!policyStillExists) return true;

        // Check if this permission is still in the YAML
        const policy = find(policies, ["name", policyStillExists.name]);
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
          .map((item) => item.id)
          .filter((id) => id !== null && id !== undefined);
        if (permissionsToDeleteIds.length) {
          await client.request(deletePermissions(permissionsToDeleteIds));
        }
      }

      if (policiesToDelete.length) {
        if (options.verbose) console.info(`Removing ${policiesToDelete.length} policies`);
        const policiesToDeleteIds = policiesToDelete
          .map((item) => item.id)
          .filter((id) => id !== null && id !== undefined);
        if (policiesToDeleteIds.length) {
          await client.request(deletePolicies(policiesToDeleteIds));
        }
      }
    }

    if (options.verbose) console.info("Policies and permissions imported");
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default importPolicies;
