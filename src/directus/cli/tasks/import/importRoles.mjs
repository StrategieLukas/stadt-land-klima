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
import readYamlFiles from '../shared/readYamlFiles.mjs';

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

async function importRoles(src, options = { verbose: false, remove: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    const existingRoles = await client.request(readRoles({ 
      limit: -1,
      fields: ['*', 'users.*', 'children.*', 'policies.*']
    }));
    const existingPolicies = await client.request(readPolicies({ limit: -1 }));

    const roles = readYamlFiles(path.join(src));

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
        // Only update fields that exist in the YAML
        const roleToUpdate = { id: existingRole.id };
        
        // Copy only the fields that exist in the YAML
        if (role.name !== undefined) roleToUpdate.name = role.name;
        if (role.icon !== undefined) roleToUpdate.icon = role.icon;
        if (role.description !== undefined) roleToUpdate.description = role.description;
        
        // Resolve parent reference (can be UUID or name) to ID
        if (role.parent !== undefined) {
          const resolvedParent = resolveRoleRef(role.parent, existingRoles, options.verbose);
          if (resolvedParent) {
            roleToUpdate.parent = resolvedParent;
          }
        }
        
        // Resolve children references (can be UUIDs or names) to IDs
        if (role.children !== undefined && role.children.length > 0) {
          const resolvedChildren = role.children
            .map(c => resolveRoleRef(c, existingRoles, options.verbose))
            .filter(id => id !== null);
          roleToUpdate.children = resolvedChildren;
        }
        
        // Store policies for later attachment (resolve names to IDs)
        const resolvedPolicies = (role.policies || [])
          .map(p => resolvePolicyRef(p, existingPolicies, options.verbose))
          .filter(id => id !== null);
        roleToUpdate.policiesToAttach = resolvedPolicies;
        
        rolesToUpdate.push(roleToUpdate);
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
        
        // Resolve children references (can be UUIDs or names) to IDs
        if (role.children !== undefined && role.children.length > 0) {
          const resolvedChildren = role.children
            .map(c => resolveRoleRef(c, existingRoles, options.verbose))
            .filter(id => id !== null);
          roleToCreate.children = resolvedChildren;
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
      const createdRoles = await client.request(createRoles(rolesToCreate));

      // Update the roles array with the newly created role IDs
      createdRoles.forEach((createdRole) => {
        const role = find(rolesToCreate, ['name', createdRole.name]);
        if (role) role.id = createdRole.id;
      });
    }

    // --- Update Roles ---
    const safeRolesToUpdate = rolesToUpdate.filter((r) => r.name !== 'Administrator');
    if (safeRolesToUpdate.length) {
      if (options.verbose) console.info(`Updating ${safeRolesToUpdate.length} roles`);
      await Promise.all(
        safeRolesToUpdate.map((role) =>
          client.request(updateRole(role.id, role)).catch((err) => {
            console.error(err, role);
          })
        )
      );
    }

    // --- Refresh roles list to get current state ---
    const updatedRoles = await client.request(readRoles({ 
      limit: -1,
      fields: ['*', 'users.*', 'children.*', 'policies.*']
    }));

    // --- Attach policies to roles ---
    // In v11, roles can have multiple policies attached via many-to-many relationship
    // Note: Policy references have already been resolved to IDs during the processing phase above
    for (const role of [...rolesToCreate, ...rolesToUpdate]) {
      const policiesToAttach = role.policiesToAttach || [];

      if (policiesToAttach.length === 0) continue;

      // Special handling for Public role - it's built-in and uses directus_access table
      if (role.name === 'Public' && role.id === null) {
        // Policies are already resolved to IDs
        await handlePublicRolePolicies(policiesToAttach, existingPolicies, options.verbose);
        continue;
      }

      if (!role.id) {
        // Find the role ID from the updated list
        const updatedRole = find(updatedRoles, ['name', role.name]);
        if (updatedRole) role.id = updatedRole.id;
        if (!role.id) {
          console.warn(`Could not find role ID for ${role.name}`);
          continue;
        }
      }

      // Get current policies attached to this role
      const currentRole = find(updatedRoles, ['id', role.id]);
      const currentPolicyIds = (currentRole?.policies || []).map(p => p.id || p);

      // Policies are already resolved to IDs, just filter out any that couldn't be resolved
      const resolvedPolicyIds = policiesToAttach.filter(id => id !== null);

      // Find policies that need to be added
      const policiesToAdd = resolvedPolicyIds.filter(pid => !currentPolicyIds.includes(pid));

      if (policiesToAdd.length > 0) {
        // Attach policies via updateRole with policies array (expects IDs)
        const allPolicyIds = [...currentPolicyIds, ...policiesToAdd];
        await client.request(updateRole(role.id, { policies: allPolicyIds }));
        if (options.verbose) {
          console.info(`Attached ${policiesToAdd.length} policies to role ${role.name}`);
        }
      }
    }

    // Helper function to handle Public role policy attachments via directus_access table
    async function handlePublicRolePolicies(policyIdsToAttach, allPolicies, verbose) {
      if (policyIdsToAttach.length === 0) {
        if (verbose) console.info('No policies to attach to Public role');
        return;
      }

      // Build URL helper for directus_access table
      const buildAccessUrl = (filters) => {
        const params = new URLSearchParams({
          limit: -1,
          fields: '*,policy.*',
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
        // Get existing access entries for Public role (where role is null)
        const url = buildAccessUrl({ 'filter[role][_null]': 'true' });
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
          if (verbose) console.info('Public role already has all specified policies attached');
          return;
        }

        // Remove access entries for policies that should no longer be attached to Public role
        if (policiesToRemove.length > 0) {
          if (verbose) console.info(`Removing ${policiesToRemove.length} access entries from Public role`);
          
          for (const entry of policiesToRemove) {
            const deleteUrl = `/access/${entry.id}`;
            const deleteResponse = await fetch(`${directusUrl}${deleteUrl}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
              },
            });
            
            if (!deleteResponse.ok) {
              console.warn(`Could not remove access entry ${entry.id} for Public role: ${deleteResponse.statusText}`);
            } else if (verbose) {
              console.info(`Removed access entry ${entry.id} from Public role`);
            }
          }
        }

        // Add access entries for policies that should be attached to Public role
        if (policiesToAdd.length > 0) {
          if (verbose) console.info(`Adding ${policiesToAdd.length} access entries to Public role`);
          
          for (const policyId of policiesToAdd) {
            // Create new access entry with role: null (Public role)
            const createUrl = `/access`;
            const createResponse = await fetch(`${directusUrl}${createUrl}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                role: null,  // Public role is represented by null
                policy: policyId,
              }),
            });
            
            if (!createResponse.ok) {
              const errorText = await createResponse.text();
              console.warn(`Could not add access entry for policy ${policyId} to Public role: ${createResponse.statusText} - ${errorText}`);
            } else if (verbose) {
              const created = await createResponse.json();
              console.info(`Added access entry for policy ${policyId} to Public role (id: ${created.data?.id})`);
            }
          }
        }
        
        if (verbose) {
          console.info(`Public role policy attachments updated successfully`);
        }
        
      } catch (e) {
        console.error('Could not update Public role policies:', e.message);
        console.warn('Public role policy attachments may need to be configured manually in the Directus admin UI');
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
