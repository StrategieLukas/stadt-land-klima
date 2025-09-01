import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readRoles, createRoles, updateRole, deleteRoles,
  readPermissions, createPermissions, updatePermission, deletePermissions,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importRoles(src, options = { verbose: false, remove: false, overwrite: false }) {
  const client = createDirectusClient();

  try {
    let existingRoles = await client.request(readRoles({ limit: -1 }));
    let existingPermissions = await client.request(readPermissions({ limit: -1 }));
    const roles = readYamlFiles(path.join(src));
    let permissions = [];

    const rolesToCreate = [];
    const rolesToUpdate = [];
    const permissionsToCreate = [];
    const permissionsToUpdate = [];

    // Split roles and permissions
    roles.forEach((role) => {
      const existingRole = find(existingRoles, ['name', role.name]);
      const rolePermissions = role.permissions || [];
      permissions = permissions.concat(
        rolePermissions.map((p) => ({ ...p, role_name: role.name }))
      );
      delete role.permissions;

      if (existingRole) {
        role.id = existingRole.id;
        rolesToUpdate.push(role);
      } else {
        rolesToCreate.push(role);
      }
    });

    // Create new roles
    if (rolesToCreate.length) {
      if (options.verbose) console.info(`Creating ${rolesToCreate.length} roles`);
      await client.request(createRoles(rolesToCreate));
      // 🔑 Re-fetch roles to get fresh IDs for new ones
      existingRoles = await client.request(readRoles({ limit: -1 }));
    }

    // Update roles
    if (options.overwrite && rolesToUpdate.length) {
      if (options.verbose) console.info(`Updating ${rolesToUpdate.length} roles`);
      await Promise.all(
        rolesToUpdate.map((role) =>
          client.request(updateRole(role.id, role)).catch((err) => console.error(err, role))
        )
      );
      // Re-fetch to sync state after updates
      existingRoles = await client.request(readRoles({ limit: -1 }));
    }

    // Match permissions
    permissions.forEach((permission) => {
      const role = find(existingRoles, ['name', permission.role_name]);

      if (!role) return;

      // Handle "Public" role explicitly
      if (role.name === 'Public') {
        permission.role = null;
      } else {
        permission.role = role.id;
      }

      const existingPermission = find(existingPermissions, {
        action: permission.action,
        role: permission.role,
        collection: permission.collection,
      });

      if (existingPermission) {
        permission.id = existingPermission.id;
        permissionsToUpdate.push(permission);
      } else {
        permissionsToCreate.push(permission);
      }
    });

    // Create permissions
    if (permissionsToCreate.length) {
      if (options.verbose) console.info(`Creating ${permissionsToCreate.length} permissions`);
      await client.request(createPermissions(permissionsToCreate));
    }

    // Update permissions
    if (permissionsToUpdate.length) {
      if (options.verbose) console.info(`Updating ${permissionsToUpdate.length} permissions`);
      await Promise.all(
        permissionsToUpdate.map((permission) =>
          client.request(updatePermission(permission.id, permission)).catch((err) =>
            console.error(err, permission)
          )
        )
      );
    }

    // Remove obsolete roles/permissions
    if (options.remove) {
      const rolesToDelete = existingRoles.filter((role) => !find(roles, ['name', role.name]));
      const permissionsToDelete = existingPermissions.filter((permission) => {
        if (!(permission.id && (permission.role || permission.role === null))) return false;
        const role = find(existingRoles, ['id', permission.role]) || (permission.role === null && { name: 'Public' });
        return !role || !find(permissions, {
          action: permission.action,
          role_name: role.name,
          collection: permission.collection,
        });
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
    process.exit(1);
  }
}

export default importRoles;
