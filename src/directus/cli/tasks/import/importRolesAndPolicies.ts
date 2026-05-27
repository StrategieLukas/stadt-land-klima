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
import createDirectusClient, { directusUrl } from '../shared/createDirectusClient.js';
import readYamlFiles from '../shared/readYamlFiles.js';

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
 */

// UUID regex pattern (version 4 UUIDs are most common in Directus)
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateNotUuid(ref: string, type: string): string {
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

function resolvePolicyRef(ref: string, existingPolicies: any[], verbose = false): string | null {
  if (!ref) return null;
  validateNotUuid(ref, 'policy');
  const policy = find(existingPolicies, ['name', ref]);
  if (policy) return policy.id;
  if (verbose) console.warn(`Could not resolve policy reference by name: ${ref}`);
  return null;
}

function resolveRoleRef(ref: string, existingRoles: any[], verbose = false): string | null {
  if (!ref) return ref;
  validateNotUuid(ref, 'role');
  const role = find(existingRoles, ['name', ref]);
  if (role) return role.id;
  if (verbose) console.warn(`Could not resolve role reference by name: ${ref}`);
  return null;
}

async function handleRolePolicies(roleId: string | null, roleName: string, policyIdsToAttach: string[], verbose: boolean): Promise<void> {
  const buildAccessUrl = (filters: Record<string, any>) => {
    const params = new URLSearchParams({
      limit: -1,
      fields: 'id,policy',
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
    const filterKey = roleId === null ? 'filter[role][_null]' : 'filter[role][_eq]';
    const url = buildAccessUrl({ [filterKey]: roleId === null ? 'true' : roleId });

    const response = await fetch(`${directusUrl}${url}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const existingAccessEntries: any[] = data.data || [];
    const existingPolicyIds = existingAccessEntries.map((entry: any) => entry.policy);

    const policiesToAdd = policyIdsToAttach.filter(pid => !existingPolicyIds.includes(pid));
    const policiesToRemove = existingAccessEntries.filter(entry =>
      !policyIdsToAttach.includes(entry.policy)
    );

    if (policiesToAdd.length === 0 && policiesToRemove.length === 0) {
      if (verbose) console.info(`Role ${roleName} already has all specified policies attached`);
      return;
    }

    if (policiesToRemove.length > 0) {
      if (verbose) console.info(`Removing ${policiesToRemove.length} access entries from role ${roleName}`);
      for (const entry of policiesToRemove) {
        const deleteUrl = `/access/${entry.id}`;
        const deleteResponse = await fetch(`${directusUrl}${deleteUrl}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
          },
        });
        if (!deleteResponse.ok) {
          console.warn(`Could not remove access entry ${entry.id} for role ${roleName}: ${deleteResponse.statusText}`);
        } else if (verbose) {
          console.info(`Removed access entry ${entry.id} from role ${roleName}`);
        }
      }
    }

    if (policiesToAdd.length > 0) {
      if (verbose) console.info(`Adding ${policiesToAdd.length} access entries to role ${roleName}`);
      for (const policyId of policiesToAdd) {
        const createUrl = `/access`;
        const createResponse = await fetch(`${directusUrl}${createUrl}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: roleId,
            policy: policyId,
          }),
        });
        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.warn(`Could not add access entry for policy ${policyId} to role ${roleName}: ${createResponse.statusText} - ${errorText}`);
        } else if (verbose) {
          const created = await createResponse.json();
          console.info(`Added access entry for policy ${policyId} to role ${roleName} (id: ${created.data?.id})`);
        }
      }
    }
  } catch (e: any) {
    console.error(`Could not update policies for role ${roleName}:`, e.message);
  }
}

interface Policy {
  name: string;
  icon?: string;
  description?: string;
  id?: string;
  permissions?: any[];
  [key: string]: any;
}

interface Role {
  name?: string;
  icon?: string;
  description?: string;
  parent?: string | null;
  policies?: string[];
  id?: string | null;
  policiesToAttach?: string[];
  _skipMetadataUpdate?: boolean;
  [key: string]: any;
}

interface ImportRolesAndPoliciesOptions {
  verbose?: boolean;
  remove?: boolean;
  overwrite?: boolean;
}

async function importRolesAndPolicies(src: string, options: ImportRolesAndPoliciesOptions = { verbose: false, remove: false, overwrite: false }): Promise<void> {
  const client = createDirectusClient();

  try {
    // ============================================
    // PHASE 1: Import Policies
    // ============================================

    if (options.verbose) console.info('Importing policies...');

    const policiesSrc = path.join(src, 'policies');

    let existingPolicies: Policy[] = await client.request(readPolicies({ limit: -1 }));
    let existingPermissions: any[] = await client.request(readPermissions({ limit: -1 }));

    const policies: Policy[] = readYamlFiles(policiesSrc);

    const policiesToCreate: Policy[] = [];
    const policiesToUpdate: Policy[] = [];
    const permissionsToCreate: any[] = [];
    const permissionsToUpdate: any[] = [];

    const policyPermissionMap = new Map<string, any[]>();

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

    let createdPolicies: Policy[] = [];
    if (policiesToCreate.length) {
      if (options.verbose) console.info(`Creating ${policiesToCreate.length} policies`);
      createdPolicies = await client.request(createPolicies(policiesToCreate));
      createdPolicies.forEach((createdPolicy) => {
        const policy = find(policiesToCreate, ['name', createdPolicy.name]);
        if (policy) (policy as any).id = createdPolicy.id;
      });
    }

    if (policiesToUpdate.length) {
      if (options.verbose) console.info(`Updating ${policiesToUpdate.length} policies`);
      await Promise.all(
        policiesToUpdate.map((policy) => {
          const { id, ...data } = policy;
          return client.request(updatePolicy(id!, data)).catch((err) => {
            console.error(`Error updating policy ${policy.name || id}:`, err);
          });
        })
      );
    }

    const updatedPolicies: Policy[] = await client.request(readPolicies({ limit: -1 }));

    for (const policy of policies) {
      const policyName = policy.name;
      const policyPermissions = policyPermissionMap.get(policyName) || [];

      const policyObj = find(updatedPolicies, ['name', policyName]);
      if (!policyObj) {
        console.warn(`Could not find policy with name ${policyName}`);
        continue;
      }

      for (const permission of policyPermissions) {
        const permissionWithPolicy = { ...permission, policy: policyObj.id };

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

    if (options.remove) {
      const allPolicies: Policy[] = await client.request(readPolicies({ limit: -1 }));
      const allPermissions: any[] = await client.request(readPermissions({ limit: -1 }));

      const policiesToDelete = allPolicies.filter((existingPolicy) => {
        if (existingPolicy.admin_access === true) return false;
        return !find(policies, ['name', existingPolicy.name]);
      });

      const permissionsToDelete = allPermissions.filter((existingPermission) => {
        if (!existingPermission.id || !existingPermission.policy) return false;
        const policyStillExists = find(updatedPolicies, ['id', existingPermission.policy]);
        if (!policyStillExists) return true;
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
          .filter((id: any) => id && id !== '');
        if (permissionsToDeleteIds.length) {
          await client.request(deletePermissions(permissionsToDeleteIds));
        }
      }

      if (policiesToDelete.length) {
        if (options.verbose) console.info(`Removing ${policiesToDelete.length} policies`);
        const policiesToDeleteIds = policiesToDelete
          .map(property('id'))
          .filter((id: any) => id && id !== '');
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

    const existingRoles: Role[] = await client.request(
      readRoles({
        limit: -1,
        fields: ['*', 'users.*', 'children.*', 'policies.*']
      })
    );
    existingPolicies = await client.request(readPolicies({ limit: -1 }));

    const roles: Role[] = readYamlFiles(rolesSrc);

    const rolesToCreate: Role[] = [];
    const rolesToUpdate: Role[] = [];

    roles.forEach((role) => {
      if (role.name === 'Administrator') {
        if (options.verbose) console.info(`Skipping Administrator role`);
        return;
      }

      if (role.name === 'Public') {
        if (options.verbose) console.info(`Skipping Public role (built-in), will handle policy attachments separately`);
        const resolvedPolicies = (role.policies || [])
          .map(p => resolvePolicyRef(p, existingPolicies, options.verbose))
          .filter((id: any) => id !== null);
        role.id = null;
        (role as any).policiesToAttach = resolvedPolicies;
        rolesToUpdate.push(role);
        return;
      }

      const existingRole = find(existingRoles, ['name', role.name]);

      if (existingRole) {
        const roleToUpdate: Role = { id: existingRole.id, name: existingRole.name };
        let hasChanges = false;

        if (role.icon !== undefined && role.icon !== existingRole.icon) {
          roleToUpdate.icon = role.icon || null;
          hasChanges = true;
        }

        const existingDescription = existingRole.description === undefined ? null : existingRole.description;
        if (role.description !== undefined && role.description !== existingDescription) {
          roleToUpdate.description = role.description || null;
          hasChanges = true;
        }

        if (role.parent !== undefined) {
          const resolvedParent = resolveRoleRef(role.parent, existingRoles, options.verbose);
          const currentParentId = existingRole.parent?.id || existingRole.parent || null;
          if (resolvedParent !== currentParentId) {
            roleToUpdate.parent = resolvedParent || null;
            hasChanges = true;
          }
        }

        const resolvedPolicies = (role.policies || [])
          .map(p => resolvePolicyRef(p, existingPolicies, options.verbose))
          .filter((id: any) => id !== null);

        if (hasChanges) {
          (roleToUpdate as any).policiesToAttach = resolvedPolicies;
          rolesToUpdate.push(roleToUpdate);
        } else {
          rolesToUpdate.push({
            id: existingRole.id,
            name: role.name,
            policiesToAttach: resolvedPolicies,
            _skipMetadataUpdate: true
          });
        }
      } else {
        const roleToCreate: Role = {
          name: role.name,
          icon: role.icon,
          description: role.description
        };

        if (role.parent !== undefined) {
          const resolvedParent = resolveRoleRef(role.parent, existingRoles, options.verbose);
          if (resolvedParent) {
            roleToCreate.parent = resolvedParent;
          }
        }

        const resolvedPolicies = (role.policies || [])
          .map(p => resolvePolicyRef(p, existingPolicies, options.verbose))
          .filter((id: any) => id !== null);
        (roleToCreate as any).policiesToAttach = resolvedPolicies;

        delete roleToCreate.policies;
        rolesToCreate.push(roleToCreate);
      }
    });

    if (rolesToCreate.length) {
      if (options.verbose) console.info(`Creating ${rolesToCreate.length} roles`);
      const rolesToCreatePayload = rolesToCreate.map((r) => {
        const { policiesToAttach, ...data } = r;
        return data;
      });
      const createdRoles: Role[] = await client.request(createRoles(rolesToCreatePayload));
      createdRoles.forEach((createdRole) => {
        const role = find(rolesToCreate, ['name', createdRole.name]);
        if (role) (role as any).id = createdRole.id;
      });
    }

    const rolesToActuallyUpdate = rolesToUpdate.filter((r) => r.name !== 'Administrator' && r.id !== null && !r._skipMetadataUpdate);
    if (rolesToActuallyUpdate.length) {
      if (options.verbose) console.info(`Updating ${rolesToActuallyUpdate.length} roles`);
      await Promise.all(
        rolesToActuallyUpdate.map((role) => {
          const { id, policiesToAttach, _skipMetadataUpdate, ...data } = role;
          return client.request(updateRole(id!, data)).catch((err) => {
            console.error(`Error updating role ${role.name || id}:`, err);
          });
        })
      );
    }

    const updatedRoles: Role[] = await client.request(
      readRoles({
        limit: -1,
        fields: ['*', 'users.*', 'children.*', 'policies.*']
      })
    );

    for (const role of [...rolesToCreate, ...rolesToUpdate]) {
      const policiesToAttach = (role as any).policiesToAttach || [];

      if (!role.id && role.name !== 'Public') {
        const updatedRole = find(updatedRoles, ['name', role.name]);
        if (updatedRole) (role as any).id = updatedRole.id;
      }

      if (!role.id && role.name !== 'Public') {
        console.warn(`Could not find role ID for ${role.name}`);
        continue;
      }

      const roleIdForAccess = role.name === 'Public' ? null : role.id;
      await handleRolePolicies(roleIdForAccess, role.name || '', policiesToAttach, options.verbose || false);
    }

    if (options.remove) {
      const allRoles: Role[] = await client.request(
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
          .filter((id: any) => id && id !== '');
        if (rolesToDeleteIds.length) {
          await client.request(deleteRoles(rolesToDeleteIds));
        }
      }
    }

    if (options.verbose) console.info('Roles and policies imported');
  } catch (err: any) {
    console.error(err);
    process.exit(1);
  }
}

export default importRolesAndPolicies;
