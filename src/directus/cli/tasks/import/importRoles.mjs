import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readRoles,
  createRoles,
  updateRole,
  deleteRoles,
  readPolicies,
} from '@directus/sdk';
import createDirectusClient, { directusUrl } from '../shared/createDirectusClient.mjs';
import clearDirectusCache from '../shared/clearDirectusCache.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';
import resolvePolicyByName from '../shared/resolvePolicyByName.mjs';
import resolveRoleByName from '../shared/resolveRoleByName.mjs';

/**
 * Import roles for Directus v11+
 *
 * In Directus v11, permissions are attached to POLICIES, not directly to roles.
 * Roles can have multiple policies attached to them.
 *
 * This import:
 * 1. Creates/updates roles with their metadata (preserving existing users, children, etc.)
 * 2. Attaches policies to roles (policies must be imported first)
 * 3. NEVER modifies user assignments - only role metadata and policy attachments
 *
 * YAML file format (STRICT - names only, NO UUIDs):
 * - name: Role name
 * - icon: Optional icon
 * - description: Optional description
 * - parent: Optional parent role NAME (resolved to ID during import)
 * - children: Array of child role NAMES (resolved to IDs during import)
 * - policies: Array of policy NAMES (resolved to IDs during import)
 *
 * IMPORTANT: This import ONLY accepts name-based references. UUIDs are NOT supported.
 * Use the export command to generate proper name-based YAML files.
 *
 * @param {string} src - Source directory containing role YAML files
 * @param {object} options - Import options
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
async function resolvePolicyRef(ref, client, existingPolicies, verbose = false) {
  if (!ref) return null;

  // Validate that this is not a UUID
  validateNotUuid(ref, 'policy');

  // Only try by name (strict name-only resolution)
  const policy = await resolvePolicyByName(client, ref, existingPolicies, { verbose });
  if (policy) return policy.id;

  if (verbose) {
    console.warn(`Could not resolve policy reference by name: ${ref}`);
  }
  return null;
}

async function resolvePolicyRefs(refs, client, existingPolicies, verbose = false) {
  const resolvedPolicies = await Promise.all(
    (refs || []).map((ref) => resolvePolicyRef(ref, client, existingPolicies, verbose))
  );

  return resolvedPolicies.filter((id) => id !== null);
}

// Helper function to resolve a role reference (NAME ONLY - no UUIDs)
async function resolveRoleRef(ref, client, existingRoles, verbose = false) {
  if (!ref) return ref; // Return null/undefined as-is for optional fields

  // Validate that this is not a UUID
  validateNotUuid(ref, 'role');

  // Only try by name (strict name-only resolution)
  const role = await resolveRoleByName(client, ref, existingRoles, { verbose });
  if (role) return role.id;

  if (verbose) {
    console.warn(`Could not resolve role reference by name: ${ref}`);
  }
  return null;
}

function getRelationId(value) {
  return value && typeof value === 'object' ? value.id : value;
}

async function importRoles(src, options = { verbose: false, remove: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    const existingRoles = await client.request(readRoles({
      limit: -1,
      fields: ['*', 'users.*', 'children.*', 'policies.*']
    }));
    let existingPolicies = await client.request(readPolicies({ limit: -1 }));

    const roles = readYamlFiles(path.join(src));

    const rolesToCreate = [];
    const rolesToUpdate = [];

    // --- Process roles ---
    for (const role of roles) {
      // Always skip Administrator - it's built-in
      if (role.name === 'Administrator') {
        if (options.verbose) console.info(`Skipping Administrator role`);
        continue;
      }

      const policyRefsToAttach = role.policies || [];
      const resolvedPolicies = await resolvePolicyRefs(policyRefsToAttach, client, existingPolicies, options.verbose);

      // Special handling for Public role - it's built-in and doesn't appear in roles list
      // We'll handle its policy attachments separately via directus_access table
      if (role.name === 'Public') {
        if (options.verbose) console.info(`Skipping Public role (built-in), will handle policy attachments separately`);
        // Store for later - we'll process Public role policy attachments via directus_access
        role.id = null; // Mark as Public role for later processing
        role.policiesToAttach = resolvedPolicies;
        role.policyRefsToAttach = policyRefsToAttach;
        rolesToUpdate.push(role);
        continue;
      }

      const existingRole = find(existingRoles, ['name', role.name]);
      const resolvedExistingRole = await resolveRoleByName(client, role.name, existingRoles, options);

      if (existingRole || resolvedExistingRole) {
        // Preserve existing role data that we don't want to overwrite
        // Only update fields that exist in the YAML AND have changed
        const roleToUpdate = {
          id: resolvedExistingRole?.id || existingRole.id,
          name: existingRole?.name || resolvedExistingRole.name
        };
        let hasChanges = false;

        if (role.icon !== undefined && role.icon !== existingRole?.icon) {
          roleToUpdate.icon = role.icon || null;
          hasChanges = true;
        }

        const existingDescription = existingRole?.description === undefined ? null : existingRole.description;
        if (role.description !== undefined && role.description !== existingDescription) {
          roleToUpdate.description = role.description || null;
          hasChanges = true;
        }

        // Resolve parent reference (can be UUID or name) to ID
        if (role.parent !== undefined) {
          const resolvedParent = await resolveRoleRef(role.parent, client, existingRoles, options.verbose);
          const currentParentId = existingRole?.parent?.id || existingRole?.parent || null;
          if (resolvedParent !== currentParentId) {
            roleToUpdate.parent = resolvedParent || null;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          roleToUpdate.policiesToAttach = resolvedPolicies;
          roleToUpdate.policyRefsToAttach = policyRefsToAttach;
          rolesToUpdate.push(roleToUpdate);
        } else {
          // If no metadata changes, still need to check policies
          rolesToUpdate.push({
            id: roleToUpdate.id,
            name: role.name,
            policiesToAttach: resolvedPolicies,
            policyRefsToAttach,
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
          const resolvedParent = await resolveRoleRef(role.parent, client, existingRoles, options.verbose);
          if (resolvedParent) {
            roleToCreate.parent = resolvedParent;
          }
        }

        roleToCreate.policiesToAttach = resolvedPolicies;
        roleToCreate.policyRefsToAttach = policyRefsToAttach;

        delete roleToCreate.policies;
        rolesToCreate.push(roleToCreate);
      }
    }

    // --- Create Roles ---
    if (rolesToCreate.length) {
      if (options.verbose) console.info(`Creating ${rolesToCreate.length} roles`);
      // Clean up internal fields before sending to API
      const rolesToCreatePayload = rolesToCreate.map((r) => {
        const { policiesToAttach, policyRefsToAttach, ...data } = r;
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
          const { id, policiesToAttach, policyRefsToAttach, _skipMetadataUpdate, ...data } = role;
          return client.request(updateRole(id, data)).catch((err) => {
            console.error(`Error updating role ${role.name || id}:`, err);
          });
        })
      );
    }

    // --- Refresh roles and policies to get current state ---
    await clearDirectusCache({ verbose: options.verbose });
    const updatedRoles = await client.request(readRoles({
      limit: -1,
      fields: ['*', 'users.*', 'children.*', 'policies.*']
    }));
    existingPolicies = await client.request(readPolicies({ limit: -1 }));

    // --- Attach policies to roles ---
    // In v11, roles can have multiple policies attached via many-to-many relationship
    // We use the directus_access table directly for all roles to be consistent and bypass potential 403s on /roles
    for (const role of [...rolesToCreate, ...rolesToUpdate]) {
      const policiesToAttach = await resolvePolicyRefs(
        role.policyRefsToAttach || role.policies || [],
        client,
        existingPolicies,
        options.verbose
      );

      // Resolve the role ID immediately before writing directus_access. The Directus API
      // can briefly return stale role IDs after role imports in some environments.
      const resolvedRole = await resolveRoleByName(client, role.name, updatedRoles, options);
      const roleIdForAccess = role.name === 'Public' ? null : resolvedRole?.id;

      if (!roleIdForAccess && role.name !== 'Public') {
        console.warn(`Could not find role ID for ${role.name}`);
        continue;
      }

      // Special handling for Public role - it's built-in and uses directus_access table with role: null
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
        const existingPolicyIds = existingAccessEntries.map(entry => getRelationId(entry.policy));

        // Find which policies need to be added or removed
        const policiesToAdd = policyIdsToAttach.filter(pid => !existingPolicyIds.includes(pid));
        const policiesToRemove = existingAccessEntries.filter(entry =>
          !policyIdsToAttach.includes(getRelationId(entry.policy))
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
      const rolesToDelete = existingRoles.filter((existingRole) => {
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

    if (options.verbose) console.info('Roles imported');
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importRoles;
