import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readPolicies,
  createPolicies,
  updatePolicy,
  deletePolicies,
  createPermissions,
  updatePermission,
  deletePermissions,
  readPermissions,
  readRoles,
  createRoles,
  updateRole,
  deleteRoles,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

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
 * Role YAML format:
 * - name: Role name
 * - icon: Optional icon
 * - description: Optional description  
 * - parent: Optional parent role ID
 * - children: Array of child role IDs
 * - policies: Array of policy IDs to attach to this role
 */
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
    let existingPermissions = await client.request(readPermissions({ limit: -1 }));

    // Read policy YAML files
    const policies = readYamlFiles(policiesSrc);

    const policiesToCreate = [];
    const policiesToUpdate = [];
    const permissionsToCreate = [];
    const permissionsToUpdate = [];

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
        policiesToUpdate.map((policy) =>
          client.request(updatePolicy(policy.id, policy)).catch((err) => {
            console.error(err, policy);
          })
        )
      );
    }

    // --- Refresh policies list to get all IDs ---
    const updatedPolicies = await client.request(readPolicies({ limit: -1 }));

    // --- Process permissions for each policy ---
    for (const policy of policies) {
      const policyName = policy.name;
      const policyPermissions = policyPermissionMap.get(policyName) || [];

      // Find the policy ID (either from existing or newly created)
      const policyObj = find(updatedPolicies, ['name', policyName]);
      if (!policyObj) {
        console.warn(`Could not find policy with name ${policyName}`);
        continue;
      }

      for (const permission of policyPermissions) {
        // Add policy reference to permission
        const permissionWithPolicy = { ...permission, policy: policyObj.id };

        // Check if this permission already exists
        const existingPermission = find(existingPermissions, {
          action: permission.action,
          collection: permission.collection,
          policy: policyObj.id,
        });

        if (existingPermission && existingPermission.id) {
          permissionWithPolicy.id = existingPermission.id;
          permissionsToUpdate.push(permissionWithPolicy);
        } else {
          permissionsToCreate.push(permissionWithPolicy);
        }
      }
    }

    // --- Create/Update Permissions ---
    if (permissionsToCreate.length) {
      if (options.verbose) console.info(`Creating ${permissionsToCreate.length} permissions`);
      await client.request(createPermissions(permissionsToCreate));
    }

    if (permissionsToUpdate.length) {
      if (options.verbose) console.info(`Updating ${permissionsToUpdate.length} permissions`);
      await Promise.all(
        permissionsToUpdate.map((permission) =>
          client.request(updatePermission(permission.id, permission)).catch((err) => {
            console.error(err, permission);
          })
        )
      );
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
    const updatedRoles = await client.request(
      readRoles({ 
        limit: -1,
        fields: ['*', 'users.*', 'children.*', 'policies.*']
      })
    );

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
