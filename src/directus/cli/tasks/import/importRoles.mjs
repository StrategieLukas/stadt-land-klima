import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readRoles,
  createRoles,
  updateRole,
  deleteRoles,
  createPermissions,
  updatePermission,
  deletePermissions,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importRoles(src, options = { verbose: false, remove: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    const existingRoles = await client.request(readRoles({ limit: -1 }));
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
    let permissions = [];

    const rolesToCreate = [];
    const rolesToUpdate = [];
    const permissionsToCreate = [];
    const permissionsToUpdate = [];

    // --- Process roles and collect permissions ---
    roles.forEach((role) => {
      const rolePermissions = role.permissions;
      permissions = permissions.concat(rolePermissions);
      delete role.permissions;
      const roleIsPublic = role.name === 'Public' || role.name === 'public'

      if (role.name === 'Administrator') {
        // Skip Administrator entirely
        return;
      } else if (roleIsPublic) {
        // Public has no DB entry
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

      // --- Match permissions ---
      rolePermissions.forEach((permission) => {
        permission.role_name = role.name;

        let existingRoleEntry = null;
        if (!roleIsPublic) {
          existingRoleEntry = find(existingRoles, ['name', permission.role_name]);
        }

        let existingPermission = null;
        if(roleIsPublic) {
          // Match public permissions: role is null or undefined (use callback for flexibility)
          existingPermission = find(existingPermissions, (p) =>
            p.action === permission.action &&
            !p.role &&
            p.collection === permission.collection
          );
        } else if(existingRoleEntry && existingRoleEntry.id) {
          existingPermission = find(existingPermissions, {
            action: permission.action,
            role: existingRoleEntry.id,
            collection: permission.collection,
          })
        } else {
          // do nothing if no existing role entry is found and role is not public
        }

        // Only update if we have a matching permission with a valid id
        const shouldUpdate = roleIsPublic
          ? existingPermission && existingPermission.id
          : existingPermission && existingPermission.id && existingRoleEntry && existingRoleEntry.id;

        if (shouldUpdate) {
          permission.id = existingPermission.id;
          permission.role = roleIsPublic ? null : existingRoleEntry.id;
          permissionsToUpdate.push(permission);
        } else {
          permission.role = roleIsPublic ? null : existingRoleEntry?.id || null;
          permissionsToCreate.push(permission);
        }
      });
    });

    // --- Roles ---
    if (rolesToCreate.length) {
      if (options.verbose) console.info(`Creating ${rolesToCreate.length} roles`);
      await client.request(createRoles(rolesToCreate));
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
    // Re-fetch roles to get the actual IDs (especially for newly created roles)
    const updatedRoles = await client.request(readRoles({ limit: -1 }));

    // Update the roles array with the fresh data including IDs
    roles.forEach((role) => {
      if (role.name !== 'Administrator' && role.name !== 'Public' && !role.id) {
        const updatedRole = find(updatedRoles, ['name', role.name]);
        if (updatedRole) {
          role.id = updatedRole.id;
        }
      }
    });

    // --- Map role IDs onto permissions ---
    permissions.forEach((permission) => {
      if (permission.role_name === 'Administrator') {
        // Never touch Administrator permissions
        return;
      } else if (permission.role_name === 'Public') {
        permission.role = null;
      } else {
        const role = find(roles, ['name', permission.role_name]);
        permission.role = role.id;
      }
    });

    // --- Permissions ---
    if (permissionsToCreate.length) {
      if (options.verbose) console.info(`Creating ${permissionsToCreate.length} permissions`);
      // Remove role_name field as it's not part of Directus permission schema
      const permissionsToCreateClean = permissionsToCreate.map(({ role_name, ...rest }) => rest);
      await client.request(createPermissions(permissionsToCreateClean));
    }

    if (permissionsToUpdate.length) {
      if (options.verbose) console.info(`Updating ${permissionsToUpdate.length} permissions`);
      await Promise.all(
        permissionsToUpdate.map((permission) => {
          // Remove role_name field as it's not part of Directus permission schema
          const { role_name, ...permissionClean } = permission;
          return client.request(updatePermission(permission.id, permissionClean)).catch((err) => {
            console.error(err, permission);
          });
        })
      );
    }

    // --- Remove ---
    if (options.remove) {
      const rolesToDelete = existingRoles.filter((role) => {
        // Never delete Administrator
        if (role.name === 'Administrator') return false;
        return !find(roles, ['name', role.name]);
      });

      const permissionsToDelete = existingPermissions.filter((permission) => {
        if (!(permission.id && (permission.role || permission.role === null))) return false;

        // Check for Public role: role is null, undefined, or other falsy value
        const roleEntry =
          !permission.role
            ? { name: 'Public' }
            : find(existingRoles, ['id', permission.role]);

        return (
          !roleEntry ||
          !find(permissions, {
            action: permission.action,
            role_name: roleEntry.name,
            collection: permission.collection,
          })
        );
      });

      if (permissionsToDelete.length) {
        if (options.verbose) console.info(`Removing ${permissionsToDelete.length} permissions`);
        await client.request(deletePermissions(permissionsToDelete.map(property('id'))));
      }

      if (rolesToDelete.length) {
        if (options.verbose) console.info(`Removing ${rolesToDelete.length} roles`);
        await client.request(deleteRoles(rolesToDelete.map(property('id'))));
      }
    }

    if (options.verbose) console.info('Roles imported');
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importRoles;
