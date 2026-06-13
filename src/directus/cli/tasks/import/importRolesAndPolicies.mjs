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
  readRoles,
  createRoles,
  updateRole,
  deleteRoles,
} from '@directus/sdk';
import createDirectusClient, { directusUrl } from '../shared/createDirectusClient.mjs';
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
 * Import roles and policies for Directus v11+
 *
 * In Directus v11, permissions are attached to POLICIES, not directly to roles.
 * Roles can have multiple policies attached to them via many-to-many relationship.
 *
 * This import:
 * 1. Imports policies with their associated permissions
 * 2. Imports roles and attaches policies to them
 * 3. Policies are imported first since roles reference them
 *
 * Source directory structure:
 * - {src}/policies/  - policy YAML files
 * - {src}/roles/    - role YAML files
 *
 * Policy YAML format:
 * - name: Policy name
 * - icon: Optional icon
 * - description: Optional description
 * - ip_access: Optional IP access list
 * - enforce_tfa: Optional boolean
 * - admin_access: Optional boolean
 * - app_access: Optional boolean
 * - permissions: Array of permission objects
 *
 * Role YAML format (STRICT - names only, NO UUIDs):
 * - name: Role name
 * - icon: Optional icon
 * - description: Optional description
 * - parent: Optional parent role NAME (resolved to ID during import)
 * - children: Array of child role NAMES (resolved to IDs during import)
 * - policies: Array of policy NAMES (resolved to IDs during import)
 *
 * IMPORTANT: This import ONLY accepts name-based references. UUIDs are NOT supported.
 * Use the export command to generate proper name-based YAML files.
 */

// UUID regex pattern (version 4 UUIDs are most common in Directus)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a reference is NOT a UUID (strict name-only format)
 * @param {string} ref - The reference to validate
 * @param {string} type - Type of reference for error messages ('policy' or 'role')
 * @returns {string} The validated reference
 * @throws {Error} If the reference is a UUID
 */
function validateNotUuid(ref, type) {
  if (!ref) return ref;

  if (UUID_PATTERN.test(ref)) {
    throw new Error(
      `Invalid ${type} reference: '${ref}' appears to be a UUID. ` +
      `This import only accepts name-based references. ` +
      `Please re-export your configuration using the export command to generate name-based YAML files.`
    );
  }

  return ref;
}

// Helper function to resolve a policy reference (NAME ONLY - no UUIDs)
function resolvePolicyRef(ref, existingPolicies, verbose = false) {
  if (!ref) return null;

  // Validate that this is not a UUID
  validateNotUuid(ref, 'policy');

  // Only try by name (strict name-only resolution)
  const policy = find(existingPolicies, ['name', ref]);
  if (policy) return policy.id;

  if (verbose) {
    console.warn(`Could not resolve policy reference by name: ${ref}`);
  }
  return null;
}

// Helper function to resolve a role reference (NAME ONLY - no UUIDs)
function resolveRoleRef(ref, existingRoles, verbose = false) {
  if (!ref) return ref; // Return null/undefined as-is for optional fields

  // Validate that this is not a UUID
  validateNotUuid(ref, 'role');

  // Only try by name (strict name-only resolution)
  const role = find(existingRoles, ['name', ref]);
  if (role) return role.id;

  if (verbose) {
    console.warn(`Could not resolve role reference by name: ${ref}`);
  }
  return null;
}
async function importRolesAndPolicies(src, options = { verbose: false, remove: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    // ============================================
    // PHASE 1: Import Policies
    // ============================================

    if (options.verbose) console.info('Importing policies...');

    const policiesSrc = path.join(src, 'policies');

    // Get existing policies and permissions
    let existingPolicies = await client.request(readPolicies({ limit: -1 }));
    assertUniquePolicyNames(existingPolicies);

    // Read policy YAML files
    const policies = readYamlFiles(policiesSrc);

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
            console.error(`Error updating policy ${policy.name || id}:`, err);
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
      const allPolicies = await client.request(readPolicies({ limit: -1 }));
      const allPermissions = await client.request(readPermissions({ limit: -1 }));

      const policiesToDelete = allPolicies.filter((existingPolicy) => {
        // Don't delete admin policies
        if (existingPolicy.admin_access === true) return false;
        // Don't delete policies that are referenced by roles
        return !find(policies, ['name', existingPolicy.name]);
      });

      const permissionsToDelete = allPermissions.filter((existingPermission) => {
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

    // ============================================
    // PHASE 2: Import Roles
    // ============================================

    if (options.verbose) console.info('Importing roles...');

    const rolesSrc = path.join(src, 'roles');

    // Get existing roles (refresh after policies import)
    const existingRoles = await client.request(
      readRoles({
        limit: -1,
        fields: ['*', 'users.*', 'children.*', 'policies.*']
      })
    );
    existingPolicies = await client.request(readPolicies({ limit: -1 }));

    const roles = readYamlFiles(rolesSrc);

    const rolesToCreate = [];
    const rolesToUpdate = [];

    // --- Process roles ---
    roles.forEach((role) => {
      // Always skip Administrator - it's built-in
      if (role.name === 'Administrator') {
        if (options.verbose) console.info(`Skipping Administrator role`);
        return;
      }

      // Special handling for Public role - it's built-in and doesn't appear in roles list
      // We'll handle its policy attachments separately via directus_access table
      if (role.name === 'Public') {
        if (options.verbose) console.info(`Skipping Public role (built-in), will handle policy attachments separately`);
        // Resolve policy references to IDs
        const resolvedPolicies = (role.policies || [])
          .map(p => resolvePolicyRef(p, existingPolicies, options.verbose))
          .filter(id => id !== null);
        // Store for later - we'll process Public role policy attachments via directus_access
        role.id = null; // Mark as Public role for later processing
        role.policiesToAttach = resolvedPolicies;
        rolesToUpdate.push(role);
        return;
      }

      const existingRole = find(existingRoles, ['name', role.name]);

      if (existingRole) {
        // Preserve existing role data that we don't want to overwrite
        // Only update fields that are present in the YAML AND have changed
        const roleToUpdate = { id: existingRole.id, name: existingRole.name };
        let hasChanges = false;

        if (role.icon !== undefined && role.icon !== existingRole.icon) {
          roleToUpdate.icon = role.icon || null;
          hasChanges = true;
        }

        const existingDescription = existingRole.description === undefined ? null : existingRole.description;
        if (role.description !== undefined && role.description !== existingDescription) {
          roleToUpdate.description = role.description || null;
          hasChanges = true;
        }

        // Resolve parent reference (can be UUID or name) to ID
        if (role.parent !== undefined) {
          const resolvedParent = resolveRoleRef(role.parent, existingRoles, options.verbose);
          const currentParentId = existingRole.parent?.id || existingRole.parent || null;
          if (resolvedParent !== currentParentId) {
            roleToUpdate.parent = resolvedParent || null;
            hasChanges = true;
          }
        }

        // Store policies for later attachment (resolve names to IDs)
        const resolvedPolicies = (role.policies || [])
          .map(p => resolvePolicyRef(p, existingPolicies, options.verbose))
          .filter(id => id !== null);

        if (hasChanges) {
          roleToUpdate.policiesToAttach = resolvedPolicies;
          rolesToUpdate.push(roleToUpdate);
        } else {
          // If no metadata changes, still need to check policies
          rolesToUpdate.push({
            id: existingRole.id,
            name: role.name,
            policiesToAttach: resolvedPolicies,
            _skipMetadataUpdate: true
          });
        }
      } else {
        // New role - include all fields from YAML
        const roleToCreate = {
          name: role.name,
          icon: role.icon,
          description: role.description
        };

        // Resolve parent reference (can be UUID or name) to ID
        if (role.parent !== undefined) {
          const resolvedParent = resolveRoleRef(role.parent, existingRoles, options.verbose);
          if (resolvedParent) {
            roleToCreate.parent = resolvedParent;
          }
        }

        // Store policies for later attachment (resolve names to IDs)
        const resolvedPolicies = (role.policies || [])
          .map(p => resolvePolicyRef(p, existingPolicies, options.verbose))
          .filter(id => id !== null);
        roleToCreate.policiesToAttach = resolvedPolicies;

        delete roleToCreate.policies;
        rolesToCreate.push(roleToCreate);
      }
    });

    // --- Create Roles ---
    if (rolesToCreate.length) {
      if (options.verbose) console.info(`Creating ${rolesToCreate.length} roles`);
      // Clean up internal fields before sending to API
      const rolesToCreatePayload = rolesToCreate.map((r) => {
        const { policiesToAttach, ...data } = r;
        return data;
      });
      const createdRoles = await client.request(createRoles(rolesToCreatePayload));

      // Update the roles array with the newly created role IDs
      createdRoles.forEach((createdRole) => {
        const role = find(rolesToCreate, ['name', createdRole.name]);
        if (role) role.id = createdRole.id;
      });
    }

    // --- Update Roles ---
    const rolesToActuallyUpdate = rolesToUpdate.filter((r) => r.name !== 'Administrator' && r.id !== null && !r._skipMetadataUpdate);
    if (rolesToActuallyUpdate.length) {
      if (options.verbose) console.info(`Updating ${rolesToActuallyUpdate.length} roles`);
      await Promise.all(
        rolesToActuallyUpdate.map((role) => {
          // Clean up internal fields before sending to API
          const { id, policiesToAttach, _skipMetadataUpdate, ...data } = role;
          return client.request(updateRole(id, data)).catch((err) => {
            console.error(`Error updating role ${role.name || id}:`, err);
          });
        })
      );
    }

    // --- Refresh roles list to get current state ---
    const updatedRoles = await client.request(
      readRoles({
        limit: -1,
        fields: ['*', 'users.*', 'children.*', 'policies.*']
      })
    );

    // --- Attach policies to roles ---
    // In v11, roles can have multiple policies attached via many-to-many relationship
    // We use the directus_access table directly for all roles to be consistent and bypass potential 403s on /roles
    for (const role of [...rolesToCreate, ...rolesToUpdate]) {
      const policiesToAttach = role.policiesToAttach || [];

      // Find the role ID if it's not already set
      if (!role.id && role.name !== 'Public') {
        const updatedRole = find(updatedRoles, ['name', role.name]);
        if (updatedRole) role.id = updatedRole.id;
      }

      if (!role.id && role.name !== 'Public') {
        console.warn(`Could not find role ID for ${role.name}`);
        continue;
      }

      // Special handling for Public role - it's built-in and uses directus_access table with role: null
      const roleIdForAccess = role.name === 'Public' ? null : role.id;
      await handleRolePolicies(roleIdForAccess, role.name, policiesToAttach, options.verbose);
    }

    // Helper function to handle role policy attachments via directus_access table
    async function handleRolePolicies(roleId, roleName, policyIdsToAttach, verbose) {
      // Build URL helper for directus_access table
      const buildAccessUrl = (filters) => {
        const params = new URLSearchParams({
          limit: -1,
          fields: 'id,policy',
        });

        for (const [key, value] of Object.entries(filters)) {
          if (value === null) {
            params.append(key, 'null');
          } else {
            params.append(key, value);
          }
        }

        return `/access?${params.toString()}`;
      };

      try {
        // Get existing access entries for this role
        const filterKey = roleId === null ? 'filter[role][_null]' : 'filter[role][_eq]';
        const url = buildAccessUrl({ [filterKey]: roleId === null ? 'true' : roleId });

        const response = await fetch(`${directusUrl}${url}`, {
          headers: {
            'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const existingAccessEntries = data.data || [];
        const existingPolicyIds = existingAccessEntries.map(entry => entry.policy);

        // Find which policies need to be added or removed
        const policiesToAdd = policyIdsToAttach.filter(pid => !existingPolicyIds.includes(pid));
        const policiesToRemove = existingAccessEntries.filter(entry =>
          !policyIdsToAttach.includes(entry.policy)
        );

        if (policiesToAdd.length === 0 && policiesToRemove.length === 0) {
          if (verbose) console.info(`Role ${roleName} already has all specified policies attached`);
          return;
        }

        // Remove access entries for policies that should no longer be attached
        if (policiesToRemove.length > 0) {
          if (verbose) console.info(`Removing ${policiesToRemove.length} access entries from role ${roleName}`);

          for (const entry of policiesToRemove) {
            const deleteUrl = `/access/${entry.id}`;
            const deleteResponse = await fetch(`${directusUrl}${deleteUrl}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
              },
            });

            if (!deleteResponse.ok) {
              console.warn(`Could not remove access entry ${entry.id} for role ${roleName}: ${deleteResponse.statusText}`);
            } else if (verbose) {
              console.info(`Removed access entry ${entry.id} from role ${roleName}`);
            }
          }
        }

        // Add access entries for policies that should be attached
        if (policiesToAdd.length > 0) {
          if (verbose) console.info(`Adding ${policiesToAdd.length} access entries to role ${roleName}`);

          for (const policyId of policiesToAdd) {
            const createUrl = `/access`;
            const createResponse = await fetch(`${directusUrl}${createUrl}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                role: roleId,
                policy: policyId,
              }),
            });

            if (!createResponse.ok) {
              const errorText = await createResponse.text();
              console.warn(`Could not add access entry for policy ${policyId} to role ${roleName}: ${createResponse.statusText} - ${errorText}`);
            } else if (verbose) {
              const created = await createResponse.json();
              console.info(`Added access entry for policy ${policyId} to role ${roleName} (id: ${created.data?.id})`);
            }
          }
        }
      } catch (e) {
        console.error(`Could not update policies for role ${roleName}:`, e.message);
      }
    }

    // --- Remove orphaned roles ---
    if (options.remove) {
      const allRoles = await client.request(
        readRoles({
          limit: -1,
          fields: ['*', 'users.*', 'children.*', 'policies.*']
        })
      );

      const rolesToDelete = allRoles.filter((existingRole) => {
        if (existingRole.name === 'Administrator') return false;
        return !find(roles, ['name', existingRole.name]);
      });

      if (rolesToDelete.length) {
        if (options.verbose) console.info(`Removing ${rolesToDelete.length} roles`);
        const rolesToDeleteIds = rolesToDelete
          .map(property('id'))
          .filter(id => id && id !== '');
        if (rolesToDeleteIds.length) {
          await client.request(deleteRoles(rolesToDeleteIds));
        }
      }
    }

    if (options.verbose) console.info('Roles and policies imported');
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importRolesAndPolicies;
