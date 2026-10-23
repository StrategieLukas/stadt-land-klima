import {
  createRoles,
  deleteRoles,
  readPolicies,
  readRoles,
  updateRole,
} from '@directus/sdk';
import find from 'lodash/find.js';
import path from 'path';
import clearDirectusCache from '../shared/clearDirectusCache.ts';
import createDirectusClient from '../shared/createDirectusClient.ts';
import type {
  CliClient,
  NamedRecord,
  Role,
  TaskOptions,
} from '../shared/models.ts';
import { relationId, requiredId, RoleSchema } from '../shared/models.ts';
import readYamlFiles from '../shared/readYamlFiles.ts';
import resolvePolicyByName from '../shared/resolvePolicyByName.ts';
import resolveRoleByName from '../shared/resolveRoleByName.ts';
import syncRolePolicies from '../shared/syncRolePolicies.ts';

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
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a reference is NOT a UUID (strict name-only format)
 * @param {string} ref - The reference to validate
 * @param {string} type - Type of reference for error messages ('policy' or 'role')
 * @returns {string} The validated reference
 * @throws {Error} If the reference is a UUID
 */
function validateNotUuid(ref: string, type: string) {
  if (!ref) return ref;

  if (UUID_PATTERN.test(ref)) {
    throw new Error(
      `Invalid ${type} reference: '${ref}' appears to be a UUID. ` +
        `This import only accepts name-based references. ` +
        `Please re-export your configuration using the export command to generate name-based YAML files.`,
    );
  }

  return ref;
}

// Helper function to resolve a policy reference (NAME ONLY - no UUIDs)
async function resolvePolicyRef(
  ref: string,
  client: CliClient,
  existingPolicies: NamedRecord[],
  verbose = false,
) {
  if (!ref) return null;

  // Validate that this is not a UUID
  validateNotUuid(ref, 'policy');

  // Only try by name (strict name-only resolution)
  const policy = await resolvePolicyByName(client, ref, existingPolicies, {
    verbose,
  });
  if (policy) return policy.id;

  if (verbose) {
    console.warn(`Could not resolve policy reference by name: ${ref}`);
  }
  throw new Error(`Could not resolve policy reference by name: ${ref}`);
}

async function resolvePolicyRefs(
  refs: string[] | undefined,
  client: CliClient,
  existingPolicies: NamedRecord[],
  verbose = false,
) {
  const resolvedPolicies = await Promise.all(
    (refs || []).map((ref) =>
      resolvePolicyRef(ref, client, existingPolicies, verbose),
    ),
  );

  return resolvedPolicies.filter((id) => id !== null);
}

// Helper function to resolve a role reference (NAME ONLY - no UUIDs)
async function resolveRoleRef(
  ref: string | null,
  client: CliClient,
  existingRoles: NamedRecord[],
  verbose = false,
) {
  if (!ref) return ref; // Return null/undefined as-is for optional fields

  // Validate that this is not a UUID
  validateNotUuid(ref, 'role');

  // Only try by name (strict name-only resolution)
  const role = await resolveRoleByName(client, ref, existingRoles, { verbose });
  if (role) return role.id;

  if (verbose) {
    console.warn(`Could not resolve role reference by name: ${ref}`);
  }
  throw new Error(`Could not resolve parent role reference by name: ${ref}`);
}

async function importRoles(src: string, options: TaskOptions = {}) {
  const client = createDirectusClient();

  try {
    const existingRoles = await client.request(
      readRoles({
        limit: -1,
        fields: ['*'],
      }),
    );
    let existingPolicies = await client.request(readPolicies({ limit: -1 }));

    const roles = readYamlFiles(path.join(src), RoleSchema);

    const rolesToCreate: Role[] = [];
    const rolesToUpdate: Role[] = [];

    // --- Process roles ---
    for (const role of roles) {
      // Always skip Administrator - it's built-in
      if (role.name === 'Administrator') {
        if (options.verbose) console.info(`Skipping Administrator role`);
        continue;
      }

      const policyRefsToAttach = role.policies || [];
      const resolvedPolicies = await resolvePolicyRefs(
        policyRefsToAttach,
        client,
        existingPolicies,
        options.verbose,
      );

      // Special handling for Public role - it's built-in and doesn't appear in roles list
      // We'll handle its policy attachments separately via directus_access table
      if (role.name === 'Public') {
        if (options.verbose)
          console.info(
            `Skipping Public role (built-in), will handle policy attachments separately`,
          );
        // Store for later - we'll process Public role policy attachments via directus_access
        role.id = null; // Mark as Public role for later processing
        role.policiesToAttach = resolvedPolicies;
        role.policyRefsToAttach = policyRefsToAttach;
        rolesToUpdate.push(role);
        continue;
      }

      const existingRole = find(existingRoles, ['name', role.name]);
      const resolvedExistingRole = await resolveRoleByName(
        client,
        role.name,
        existingRoles,
        options,
      );

      if (existingRole || resolvedExistingRole) {
        // Preserve existing role data that we don't want to overwrite
        // Only update fields that exist in the YAML AND have changed
        const roleToUpdate: Role = {
          id: resolvedExistingRole?.id || existingRole?.id,
          name: existingRole?.name || resolvedExistingRole?.name || role.name,
        };
        let hasChanges = false;

        if (role.icon !== undefined && role.icon !== existingRole?.icon) {
          roleToUpdate.icon = role.icon || null;
          hasChanges = true;
        }

        const existingDescription =
          existingRole?.description === undefined
            ? null
            : existingRole.description;
        if (
          role.description !== undefined &&
          role.description !== existingDescription
        ) {
          roleToUpdate.description = role.description || null;
          hasChanges = true;
        }

        // Resolve parent reference (can be UUID or name) to ID
        if (role.parent !== undefined) {
          const resolvedParent = await resolveRoleRef(
            role.parent,
            client,
            existingRoles,
            options.verbose,
          );
          const currentParentId = relationId(existingRole?.parent);
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
            _skipMetadataUpdate: true,
          });
        }
      } else {
        // New role - include all fields from YAML
        const roleToCreate: Role = {
          name: role.name,
          icon: role.icon,
          description: role.description,
        };

        // Resolve parent reference (can be UUID or name) to ID
        if (role.parent !== undefined) {
          const resolvedParent = await resolveRoleRef(
            role.parent,
            client,
            existingRoles,
            options.verbose,
          );
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
      if (options.verbose)
        console.info(`Creating ${rolesToCreate.length} roles`);
      // Clean up internal fields before sending to API
      const rolesToCreatePayload = rolesToCreate.map((r) => {
        const { policiesToAttach, policyRefsToAttach, ...data } = r;
        return data;
      });
      const createdRoles = await client.request(
        createRoles(
          rolesToCreatePayload.map((role) => ({
            ...role,
            icon: role.icon ?? undefined,
            id: role.id ?? undefined,
          })),
        ),
      );

      // Update the roles array with the newly created role IDs
      createdRoles.forEach((createdRole) => {
        const role = find(rolesToCreate, ['name', createdRole.name]);
        if (role) role.id = createdRole.id;
      });
    }

    // --- Update Roles ---
    const rolesToActuallyUpdate = rolesToUpdate.filter(
      (r) =>
        r.name !== 'Administrator' && r.id !== null && !r._skipMetadataUpdate,
    );
    if (rolesToActuallyUpdate.length) {
      if (options.verbose)
        console.info(`Updating ${rolesToActuallyUpdate.length} roles`);
      await Promise.all(
        rolesToActuallyUpdate.map((role) => {
          // Clean up internal fields before sending to API
          const {
            id,
            policiesToAttach,
            policyRefsToAttach,
            _skipMetadataUpdate,
            ...data
          } = role;
          return client
            .request(
              updateRole(requiredId(id), {
                ...data,
                icon: data.icon ?? undefined,
              }),
            )
            .catch((err) => {
              console.error(`Error updating role ${role.name || id}:`, err);
              throw err;
            });
        }),
      );
    }

    // --- Refresh roles and policies to get current state ---
    await clearDirectusCache({ verbose: options.verbose });
    const updatedRoles = await client.request(
      readRoles({
        limit: -1,
        fields: ['*'],
      }),
    );
    existingPolicies = await client.request(readPolicies({ limit: -1 }));

    // --- Attach policies to roles ---
    // In v11, roles can have multiple policies attached via many-to-many relationship
    // We use the directus_access table directly for all roles to be consistent and bypass potential 403s on /roles
    for (const role of [...rolesToCreate, ...rolesToUpdate]) {
      const policiesToAttach = await resolvePolicyRefs(
        role.policyRefsToAttach || role.policies || [],
        client,
        existingPolicies,
        options.verbose,
      );

      // Resolve the role ID immediately before writing directus_access. The Directus API
      // can briefly return stale role IDs after role imports in some environments.
      const resolvedRole = await resolveRoleByName(
        client,
        role.name,
        updatedRoles,
        options,
      );
      const roleIdForAccess = role.name === 'Public' ? null : resolvedRole?.id;

      if (!roleIdForAccess && role.name !== 'Public') {
        throw new Error(`Could not find role ID for ${role.name}`);
      }

      // Special handling for Public role - it's built-in and uses directus_access table with role: null
      await syncRolePolicies(
        roleIdForAccess ?? null,
        role.name,
        policiesToAttach,
        options.verbose,
      );
    }

    // --- Remove orphaned roles ---
    if (options.remove) {
      const rolesToDelete = existingRoles.filter((existingRole) => {
        if (existingRole.name === 'Administrator') return false;
        return !find(roles, ['name', existingRole.name]);
      });

      if (rolesToDelete.length) {
        if (options.verbose)
          console.info(`Removing ${rolesToDelete.length} roles`);
        const rolesToDeleteIds = rolesToDelete
          .map((item) => item.id)
          .filter((id) => id && id !== '');
        if (rolesToDeleteIds.length) {
          await client.request(deleteRoles(rolesToDeleteIds));
        }
      }
    }

    if (options.verbose) console.info('Roles imported');
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default importRoles;
