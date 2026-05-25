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
import createDirectusClient from '../shared/createDirectusClient.mjs';
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
 * YAML file format:
 * - name: Role name
 * - icon: Optional icon
 * - description: Optional description  
 * - parent: Optional parent role ID
 * - children: Array of child role IDs
 * - policies: Array of policy IDs to attach to this role
 */
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

      const existingRole = find(existingRoles, ['name', role.name]);

      if (existingRole) {
        // Preserve existing role data that we don't want to overwrite
        // Only update fields that are present in the YAML
        const roleToUpdate = { id: existingRole.id };
        
        // Copy only the fields that exist in the YAML
        if (role.name !== undefined) roleToUpdate.name = role.name;
        if (role.icon !== undefined) roleToUpdate.icon = role.icon;
        if (role.description !== undefined) roleToUpdate.description = role.description;
        if (role.parent !== undefined) roleToUpdate.parent = role.parent;
        if (role.children !== undefined) roleToUpdate.children = role.children;
        
        // Store policies for later attachment
        roleToUpdate.policiesToAttach = role.policies || [];
        
        rolesToUpdate.push(roleToUpdate);
      } else {
        // New role - include all fields from YAML
        const roleToCreate = { ...role };
        // Store policies for later attachment
        roleToCreate.policiesToAttach = role.policies || [];
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
    for (const role of [...rolesToCreate, ...rolesToUpdate]) {
      if (!role.id) {
        // Find the role ID from the updated list
        const updatedRole = find(updatedRoles, ['name', role.name]);
        if (updatedRole) role.id = updatedRole.id;
        if (!role.id) {
          console.warn(`Could not find role ID for ${role.name}`);
          continue;
        }
      }

      const policiesToAttach = role.policiesToAttach || [];

      if (policiesToAttach.length === 0) continue;

      // Get current policies attached to this role
      const currentRole = find(updatedRoles, ['id', role.id]);
      const currentPolicyIds = (currentRole?.policies || []).map(p => p.id || p);

      // Filter to only valid policy IDs that exist
      const validPolicyIds = policiesToAttach.filter(pid => {
        return find(existingPolicies, ['id', pid]) || find(existingPolicies, ['name', pid]);
      });

      // Find policies that need to be added
      const policiesToAdd = validPolicyIds.filter(pid => !currentPolicyIds.includes(pid));

      if (policiesToAdd.length > 0) {
        // Attach policies via updateRole with policies array
        const allPolicyIds = [...currentPolicyIds, ...policiesToAdd];
        await client.request(updateRole(role.id, { policies: allPolicyIds }));
        if (options.verbose) {
          console.info(`Attached ${policiesToAdd.length} policies to role ${role.name}`);
        }
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
