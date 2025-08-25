import path from 'path';
import find from 'lodash/find.js';
import property from 'lodash/property.js';
import fs from 'fs';
import {
  readRoles, createRoles, updateRole, deleteRoles,
  readPermissions, createPermissions, updatePermission, deletePermissions,
} from '@directus/sdk';
import createDirectusClient from '../shared/createDirectusClient.mjs';
import readYamlFiles from '../shared/readYamlFiles.mjs';

async function importRoles(src, options = {verbose: false, remove: false, overwrite: false}) {
  const client = createDirectusClient();

  try {
    // fetch all roles
    const existingRoles = await client.request(readRoles({limit: -1}));

    // find the Administrator role ID
    const adminRole = existingRoles.find(r => r.name === 'Administrator');
    const adminId = adminRole?.id;

    // fetch all permissions, excluding the Administrator role
    const existingPermissions = await client.request(
      readPermissions({
        limit: -1,
        filter: {
          _or: [
            { role: { _null: true } },   // include public / role=null
            { role: { _neq: adminId } }  // exclude Administrator
          ]
        }
      })
    );

    const roles = readYamlFiles(path.join(src));
    let permissions = [];

    const rolesToCreate = [];
    const rolesToUpdate = [];
    const permissionsToCreate = [];
    const permissionsToUpdate = [];

    // Filter out Administrator role
    const filteredRoles = roles.filter(r => r.name !== 'Administrator');

    filteredRoles.forEach((role) => {
      const isPublic = role.name === 'public';
      const existingRole = isPublic
        ? null
        : find(existingRoles, ['name', role.name]);

      const rolePermissions = role.permissions.filter(p => {
        // Skip forbidden directus_files read public combination
        if (isPublic && p.collection === 'directus_files' && p.action === 'read') return false;
        return true;
      });

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
        const existingRoleForPerm = isPublic ? null : find(existingRoles, ['name', permission.role_name]);

        const existingPermission = existingRoleForPerm
          ? find(existingPermissions, {
              action: permission.action,
              role: existingRoleForPerm.id,
              collection: permission.collection,
            })
          : null;

        if (existingPermission) {
          permission.id = existingPermission.id;
          permission.role = isPublic ? null : existingRoleForPerm.id;
          permissionsToUpdate.push(permission);
        } else {
          permission.role = isPublic ? null : existingRoleForPerm?.id;
          permissionsToCreate.push(permission);
        }
      });
    });

    // Roles creation & update
    if (rolesToCreate.length) {
      if (options.verbose) console.info(`Creating ${rolesToCreate.length} roles`);
      await client.request(createRoles(rolesToCreate));
    }

    if (options.overwrite && rolesToUpdate.length) {
      if (options.verbose) console.info(`Updating ${rolesToUpdate.length} roles`);
      for (const role of rolesToUpdate) {
        try {
          await client.request(updateRole(role.id, role));
        } catch (err) {
          console.error(err, role);
        }
      }
    }

    // Permissions creation & update
    permissions.forEach((permission) => {
      const role = find(filteredRoles, ['name', permission.role_name]);
      permission.role = role.name === 'public' ? null : role.id;
    });

    if (permissionsToCreate.length) {
      if (options.verbose) console.info(`Creating ${permissionsToCreate.length} permissions`);
      await client.request(createPermissions(permissionsToCreate));
    }

    if (permissionsToUpdate.length) {
      if (options.verbose) console.info(`Updating ${permissionsToUpdate.length} permissions`);
      for (const permission of permissionsToUpdate) {
        try {
          await client.request(updatePermission(permission.id, permission));
        } catch (err) {
          console.error(err, permission);
        }
      }
    }

    // Remove old permissions & roles
    if (options.remove || options.overwrite) {
//       if (options.verbose) {
//         console.info(`Hard-removing all public permissions (role=null), except directus_files read`);
//       }

        // TODO - find way to delete permissions that are no longer active for PUBLIC

      // ----------------------------
      // Handle other roles normally
      // ----------------------------
      const rolesToDelete = existingRoles.filter(role => {
        return role.name !== 'Administrator' && !find(roles, ['name', role.name]);
      });

      if (rolesToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${rolesToDelete.length} roles`);
        }
        await client.request(deleteRoles(rolesToDelete.map(r => r.id)));
      }

      const permissionsToDelete = existingPermissions.filter(permission => {
        if (permission.role === null) return false; // public already handled
        const existingRole = find(existingRoles, ['id', permission.role]);
        if (!existingRole) return true; // role removed
        return !find(permissions, {
          action: permission.action,
          role_name: existingRole.name,
          collection: permission.collection
        });
      });

      if (permissionsToDelete.length) {
        if (options.verbose) {
          console.info(`Removing ${permissionsToDelete.length} old permissions`);
          console.log(permissionsToDelete)
        }
        await client.request(deletePermissions(permissionsToDelete.map(p => p.id)));
      }


    if (options.verbose) console.info('Roles imported successfully');
}
  } catch (err) {
    console.error(err);
    return process.exit(1);
  }
}


export default importRoles;
