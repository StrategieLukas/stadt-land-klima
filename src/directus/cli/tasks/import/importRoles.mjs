import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import {
  readRoles, createRoles, updateRole, deleteRoles,
  readPermissions, createPermissions, updatePermission, deletePermissions,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importRoles(src, options = {verbose: false, remove: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    const existingRoles = await client.request(readRoles({limit: -1}));
    const existingPermissions = await client.request(readPermissions({limit: -1}));
    const roles = readYamlFiles(path.join(src));
    let permissions = [];

    const rolesToCreate = [];
    const rolesToUpdate = [];
    const permissionsToCreate = [];
    const permissionsToUpdate = [];

    roles.forEach((role) => {
      const existingRole = find(existingRoles, ['name', role.name]);
      const rolePermissions = role.permissions;
      permissions = permissions.concat(rolePermissions);
      delete role.permissions;

      if (existingRole) {
        role.id = existingRole.id;
        rolesToUpdate.push(role);
      } else {
        rolesToCreate.push(role);
      }

      rolePermissions.forEach((permission) => {
        permission.role_name = role.name;
        const existingRole = find(existingRoles, ['name', permission.role_name]);

        const existingPermission = existingRole
        ? find(existingPermissions, {
          action: permission.action,
          role: existingRole.id,
          collection: permission.collection,
        }) : null;

        if (existingPermission) {
          permission.id = existingPermission.id;
          permission.role = existingRole.id;
          permissionsToUpdate.push(permission);
        } else {
          permissionsToCreate.push(permission);
        }
      });
    });

    // Roles

    if (rolesToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${rolesToCreate.length} roles`);
      }

      await client.request(createRoles(rolesToCreate));
    }

    if (options.overwrite && rolesToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${rolesToUpdate.length} roles`);
      }

      rolesToUpdate.forEach(async (role) => {
        try {
          await client.request(updateRole(role.id, role));
        } catch (err) {
          console.error(err);
        }
      });
    }

    // set role ids to permissions before creating or updating them
    permissions.forEach((permission) => {
      const role = find(roles, ['name', permission.role_name]);
      permission.role = role.id;
    });

    // Permissions

    if (permissionsToCreate.length) {
      if (options.verbose) {
        console.info(`Creating ${permissionsToCreate.length} permissions`);
      }

      await client.request(createPermissions(permissionsToCreate));
    }

    if (permissionsToUpdate.length) {
      if (options.verbose) {
        console.info(`Updating ${permissionsToUpdate.length} permissions`);
      }

      permissionsToUpdate.forEach(async (permission) => {
        try {
          await client.request(updatePermission(permission.id, permission));
        } catch (err) {
          console.error(err);
        }
      });
    }

    // Remove
    if (options.remove) {
      const rolesToDelete = existingRoles.filter((role) => {
        return !find(roles, ['name', role.name]);
      });

      const permissionsToDelete = existingPermissions.filter((permission) => {
        if (!(permission.id && permission.role)) {
          return false;
        }

        const existingRole = find(existingRoles, ['id', permission.role]);

        return !existingRole || !find(permissions, {
          action: permission.action,
          role_name: existingRole.name,
          collection: permission.collection,
        });
      });

      if (permissionsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${permissionsToDelete.length} permissions`);
        }

        await client.request(deletePermissions(permissionsToDelete.map(property('id'))));
      }

      if (rolesToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${rolesToDelete.length} roles`);
        }

        await client.request(deleteRoles(rolesToDelete.map(property('id'))));
      }
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
