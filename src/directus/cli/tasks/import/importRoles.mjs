import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readRoles, createRoles, updateRole, deleteRoles,
  readPermissions, createPermissions, updatePermission, deletePermissions,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importRoles(src, options = {verbose: false}) {
  const client = createDirectusClient();

  const existingRoles = await client.request(readRoles({limit: 1000}));
  const existingPermissions = await client.request(readPermissions({limit: 10000}));

  try {
    const roles = readYamlFiles(path.join(src));
    let permissions = [];

    const rolesToCreate = [];
    const rolesToUpdate = [];
    const permissionsToCreate = [];
    const permissionsToUpdate = [];

    roles.forEach((role) => {
      const existingRole = find(existingRoles, ['id', role.id]);
      const rolePermissions = role.permissions;
      permissions = permissions.concat(rolePermissions);
      delete role.permissions;

      if (existingRole) {
        rolesToUpdate.push(role);
      } else {
        rolesToCreate.push(role);
      }

      rolePermissions.forEach((permission) => {
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
    });

    // Roles

    if (options.verbose) {
      console.info(`Creating ${rolesToCreate.length} roles`);
    }

    await client.request(createRoles(rolesToCreate));

    if (options.verbose) {
      console.info(`Updating ${rolesToUpdate.length} roles`);
    }

    rolesToUpdate.forEach(async (role) => {
      await client.request(updateRole(role.id, role));
    });

    // Permissions

    if (options.verbose) {
      console.info(`Creating ${permissionsToCreate.length} permissions`);
    }

    await client.request(createPermissions(permissionsToCreate));

    if (options.verbose) {
      console.info(`Updating ${permissionsToUpdate.length} permissions`);
    }

    permissionsToUpdate.forEach(async (permission) => {
      await client.request(updatePermission(permission.id, permission));
    });

    // Remove
    if (options.remove) {
      const rolesToDelete = existingRoles.filter((role) => {
        return !find(roles, ['id', role.id]);
      });

      const permissionsToDelete = existingPermissions.filter((permission) => {
        return permission.id && permission.role && !find(permissions, ['id', permission.id]);
      });

      if (options.verbose) {
        console.info(`Removing ${permissionsToDelete.length} permissions`);
      }

      await client.request(deletePermissions(permissionsToDelete.map(property('id'))));

      if (options.verbose) {
        console.info(`Removing ${rolesToDelete.length} roles`);
      }

      await client.request(deleteRoles(rolesToDelete.map(property('id'))));
    }

    if (options.verbose) {
      console.info('Roles imported');
    }
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}

export default importRoles;
