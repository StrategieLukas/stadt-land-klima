import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readRoles,
  readPolicies,
  createRoles,
  updateRole,
  deleteRoles,
  createPolicies,
  updatePolicy,
  deletePolicies,
  createPermissions,
  updatePermission,
  deletePermissions,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

/**
 * Import roles and permissions for Directus v11+ (Policies System)
 * 
 * In Directus v11, permissions are attached to POLICIES, not directly to roles.
 * Each role can have multiple policies attached to it.
 * The YAML files still use the old format (permissions on roles), so we need to:
 * 1. Create/update roles
 * 2. Create a policy for each role (with the permissions from the YAML)
 * 3. Attach the policy to the role
 * 
 * Note: The Public role is special - it has no DB entry, permissions with role=null are for Public
 */
async function importRoles(src, options = { verbose: false, remove: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    const existingRoles = await client.request(readRoles({ limit: -1 }));
    const existingPolicies = await client.request(readPolicies({ limit: -1 }));
    
    // Read permissions with IDs using raw REST API
    const permissionsUrl = new URL('/permissions', client.url).toString();
    const permissionsResponse = await fetch(permissionsUrl + '?limit=-1&fields=*', {
      headers: {
        'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
      },
    });
    const permissionsData = await permissionsResponse.json();
    const existingPermissions = permissionsData.data || [];

    const roles = readYamlFiles(path.join(src));
    let allPermissions = [];

    const rolesToCreate = [];
    const rolesToUpdate = [];
    const policiesToCreate = [];
    const policiesToUpdate = [];
    const permissionsToCreate = [];
    const permissionsToUpdate = [];

    // --- Process roles and collect permissions ---
    roles.forEach((role) => {
      const rolePermissions = role.permissions || [];
      allPermissions = allPermissions.concat(rolePermissions);
      delete role.permissions;
      const roleIsPublic = role.name === 'Public' || role.name === 'public'

      if (role.name === 'Administrator') {
        // Skip Administrator entirely
        return;
      } else if (roleIsPublic) {
        // Public has no DB entry - create a policy for public permissions
        role.id = null;
      } else {
        const existingRole = find(existingRoles, ['name', role.name]);
        if (existingRole) {
          role.id = existingRole.id;
          rolesToUpdate.push(role);
        } else {
          rolesToCreate.push(role);
        }
      }

      // --- Create policy for this role's permissions ---
      // In v11, each role should have a policy with its permissions
      const policyName = `policy-${role.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      // Check if policy already exists
      const existingPolicy = find(existingPolicies, ['name', policyName]);
      
      const policyData = {
        name: policyName,
        description: `Auto-generated policy for ${role.name} role`,
        // In v11, permissions are stored on policies, not roles
        // We'll attach permissions to the policy after creating the role
      };
      
      if (existingPolicy) {
        policyData.id = existingPolicy.id;
        policiesToUpdate.push(policyData);
      } else {
        policiesToCreate.push(policyData);
      }
      
      // Store role name on permissions for later mapping
      rolePermissions.forEach((permission) => {
        permission.role_name = role.name;
        permission.policy_name = policyName;
      });
    });

    // --- Roles ---
    if (rolesToCreate.length) {
      if (options.verbose) console.info(`Creating ${rolesToCreate.length} roles`);
      const createdRoles = await client.request(createRoles(rolesToCreate));
      
      // Update the roles array with the newly created role IDs
      createdRoles.forEach((createdRole) => {
        const role = find(rolesToCreate, ['name', createdRole.name]);
        if (role) role.id = createdRole.id;
      });
    }

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

    // --- Refresh roles with IDs from database ---
    const updatedRoles = await client.request(readRoles({ limit: -1 }));
    roles.forEach((role) => {
      if (role.name !== 'Administrator' && role.name !== 'Public' && !role.id) {
        const updatedRole = find(updatedRoles, ['name', role.name]);
        if (updatedRole) role.id = updatedRole.id;
      }
    });

    // --- Create/Update Policies ---
    // Note: In v11, we create policies first, then attach permissions to them
    // But the SDK doesn't have direct policy-permission attachment methods
    // So we'll use the REST API directly
    
    // First, create all policies
    if (policiesToCreate.length) {
      if (options.verbose) console.info(`Creating ${policiesToCreate.length} policies`);
      await client.request(createPolicies(policiesToCreate));
    }
    
    // Get updated policy list
    const updatedPolicies = await client.request(readPolicies({ limit: -1 }));
    
    // --- Map permissions to policies ---
    // For each permission, we need to find the corresponding policy
    allPermissions.forEach((permission) => {
      const role = find(roles, ['name', permission.role_name]);
      if (!role) return;
      
      const policyName = `policy-${role.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const policy = find(updatedPolicies, ['name', policyName]);
      
      if (!policy) {
        console.warn(`Could not find policy ${policyName} for role ${role.name}`);
        return;
      }
      
      // In v11, permissions have a 'policy' field instead of 'role'
      permission.policy = policy.id;
      delete permission.role;
      delete permission.role_name;
      delete permission.policy_name;
      
      // Handle Public role - permissions with role=null
      if (role.name === 'Public' || role.name === 'public') {
        // For public, we need to find or create a public policy
        // This is a special case in v11
        const publicPolicy = find(updatedPolicies, (p) => p.name === 'public' || p.name === 'Public');
        if (publicPolicy) {
          permission.policy = publicPolicy.id;
        } else {
          // Create a public policy if it doesn't exist
          console.warn('Public policy not found, creating...');
        }
      }
      
      // Check if permission already exists
      const existingPermission = find(existingPermissions, {
        action: permission.action,
        collection: permission.collection,
        policy: permission.policy,
      });
      
      if (existingPermission && existingPermission.id) {
        permission.id = existingPermission.id;
        permissionsToUpdate.push(permission);
      } else {
        permissionsToCreate.push(permission);
      }
    });

    // --- Permissions ---
    if (permissionsToCreate.length) {
      if (options.verbose) console.info(`Creating ${permissionsToCreate.length} permissions`);
      await client.request(createPermissions(permissionsToCreate));
    }

    if (permissionsToUpdate.length) {
      if (options.verbose) console.info(`Updating ${permissionsToUpdate.length} permissions`);
      await Promise.all(
        permissionsToUpdate.map((permission) => {
          return client.request(updatePermission(permission.id, permission)).catch((err) => {
            console.error(err, permission);
          });
        })
      );
    }

    // --- Attach policies to roles ---
    // In v11, roles can have multiple policies attached via a m2m relationship
    // We need to use the REST API to update the role's policies
    for (const role of roles) {
      if (role.name === 'Administrator' || role.name === 'Public' || !role.id) continue;
      
      const policyName = `policy-${role.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const policy = find(updatedPolicies, ['name', policyName]);
      
      if (policy) {
        // Attach policy to role via REST API
        try {
          const roleUrl = new URL(`/roles/${role.id}`, client.url).toString();
          const currentRole = await fetch(roleUrl, {
            headers: {
              'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
            },
          }).then(r => r.json());
          
          // Update role to include policy in its policies array
          const policies = currentRole.data?.policies || [];
          if (!policies.some(p => p.id === policy.id || p === policy.id)) {
            policies.push(policy.id);
            await fetch(roleUrl, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
              },
              body: JSON.stringify({ policies }),
            });
          }
        } catch (err) {
          console.warn(`Failed to attach policy ${policyName} to role ${role.name}:`, err.message);
        }
      }
    }

    // --- Remove ---
    if (options.remove) {
      const rolesToDelete = existingRoles.filter((role) => {
        if (role.name === 'Administrator') return false;
        return !find(roles, ['name', role.name]);
      });

      const policiesToDelete = existingPolicies.filter((policy) => {
        // Don't delete auto-generated policies
        if (policy.name.startsWith('policy-')) {
          const roleName = policy.name.replace(/^policy-/, '').replace(/-/g, ' ');
          return !find(roles, (r) => r.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === policy.name.replace(/^policy-/, ''));
        }
        return false;
      });

      const permissionsToDelete = existingPermissions.filter((permission) => {
        if (!permission.id) return false;
        
        // Check if this permission belongs to a role that still exists
        const policy = find(existingPolicies, ['id', permission.policy]);
        if (!policy) return true; // Orphaned permission
        
        const roleName = policy.name.replace(/^policy-/, '').replace(/-/g, ' ');
        const role = find(roles, (r) => r.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === policy.name.replace(/^policy-/, ''));
        
        if (!role) return true; // Role doesn't exist anymore
        
        // Check if this specific permission still exists in the YAML
        const originalPermissions = role.permissions || [];
        return !find(originalPermissions, {
          action: permission.action,
          collection: permission.collection,
        });
      });

      if (permissionsToDelete.length) {
        if (options.verbose) console.info(`Removing ${permissionsToDelete.length} permissions`);
        await client.request(deletePermissions(permissionsToDelete.map(property('id'))));
      }

      if (policiesToDelete.length) {
        if (options.verbose) console.info(`Removing ${policiesToDelete.length} policies`);
        await client.request(deletePolicies(policiesToDelete.map(property('id'))));
      }

      if (rolesToDelete.length) {
        if (options.verbose) console.info(`Removing ${rolesToDelete.length} roles`);
        await client.request(deleteRoles(rolesToDelete.map(property('id'))));
      }
    }

    if (options.verbose) console.info('Roles and policies imported');
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importRoles;
