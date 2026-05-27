"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const find_js_1 = __importDefault(require("lodash/find.js"));
const property_js_1 = __importDefault(require("lodash/property.js"));
const sdk_1 = require("@directus/sdk");
const createDirectusClient_js_1 = __importStar(require("../shared/createDirectusClient.js"));
const readYamlFiles_js_1 = __importDefault(require("../shared/readYamlFiles.js"));
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
function validateNotUuid(ref, type) {
    if (!ref)
        return ref;
    if (UUID_PATTERN.test(ref)) {
        throw new Error(`Invalid ${type} reference: '${ref}' appears to be a UUID. ` +
            `This import only accepts name-based references. ` +
            `Please re-export your configuration using the export command to generate name-based YAML files.`);
    }
    return ref;
}
function resolvePolicyRef(ref, existingPolicies, verbose = false) {
    if (!ref)
        return null;
    validateNotUuid(ref, 'policy');
    const policy = (0, find_js_1.default)(existingPolicies, ['name', ref]);
    if (policy && policy.id)
        return policy.id;
    if (verbose)
        console.warn(`Could not resolve policy reference by name: ${ref}`);
    return null;
}
function resolveRoleRef(ref, existingRoles, verbose = false) {
    if (!ref)
        return ref;
    validateNotUuid(ref, 'role');
    const role = (0, find_js_1.default)(existingRoles, ['name', ref]);
    if (role && role.id)
        return role.id;
    if (verbose)
        console.warn(`Could not resolve role reference by name: ${ref}`);
    return null;
}
async function handleRolePolicies(roleId, roleName, policyIdsToAttach, verbose) {
    const buildAccessUrl = (filters) => {
        const params = new URLSearchParams({
            limit: '-1',
            fields: 'id,policy',
        });
        for (const [key, value] of Object.entries(filters)) {
            if (value === null) {
                params.append(key, 'null');
            }
            else {
                params.append(key, value);
            }
        }
        return `/access?${params.toString()}`;
    };
    try {
        const filterKey = roleId === null ? 'filter[role][_null]' : 'filter[role][_eq]';
        const url = buildAccessUrl({ [filterKey]: roleId === null ? 'true' : roleId });
        const response = await fetch(`${createDirectusClient_js_1.directusUrl}${url}`, {
            headers: {
                'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = (await response.json());
        const existingAccessEntries = data.data || [];
        const existingPolicyIds = existingAccessEntries.map((entry) => entry.policy);
        const policiesToAdd = policyIdsToAttach.filter(pid => !existingPolicyIds.includes(pid));
        const policiesToRemove = existingAccessEntries.filter(entry => !policyIdsToAttach.includes(entry.policy));
        if (policiesToAdd.length === 0 && policiesToRemove.length === 0) {
            if (verbose)
                console.info(`Role ${roleName} already has all specified policies attached`);
            return;
        }
        if (policiesToRemove.length > 0) {
            if (verbose)
                console.info(`Removing ${policiesToRemove.length} access entries from role ${roleName}`);
            for (const entry of policiesToRemove) {
                const deleteUrl = `/access/${entry.id}`;
                const deleteResponse = await fetch(`${createDirectusClient_js_1.directusUrl}${deleteUrl}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
                    },
                });
                if (!deleteResponse.ok) {
                    console.warn(`Could not remove access entry ${entry.id} for role ${roleName}: ${deleteResponse.statusText}`);
                }
                else if (verbose) {
                    console.info(`Removed access entry ${entry.id} from role ${roleName}`);
                }
            }
        }
        if (policiesToAdd.length > 0) {
            if (verbose)
                console.info(`Adding ${policiesToAdd.length} access entries to role ${roleName}`);
            for (const policyId of policiesToAdd) {
                const createUrl = `/access`;
                const createResponse = await fetch(`${createDirectusClient_js_1.directusUrl}${createUrl}`, {
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
                }
                else if (verbose) {
                    const created = (await createResponse.json());
                    console.info(`Added access entry for policy ${policyId} to role ${roleName} (id: ${created.data?.id})`);
                }
            }
        }
    }
    catch (e) {
        console.error(`Could not update policies for role ${roleName}:`, e.message);
    }
}
async function importRolesAndPolicies(src, options = { verbose: false, remove: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        // ============================================
        // PHASE 1: Import Policies
        // ============================================
        if (options.verbose)
            console.info('Importing policies...');
        const policiesSrc = path_1.default.join(src, 'policies');
        let existingPolicies = await client.request((0, sdk_1.readPolicies)({ limit: -1 }));
        let existingPermissions = await client.request((0, sdk_1.readPermissions)({ limit: -1 }));
        const policies = (0, readYamlFiles_js_1.default)(policiesSrc);
        const policiesToCreate = [];
        const policiesToUpdate = [];
        const permissionsToCreate = [];
        const permissionsToUpdate = [];
        const policyPermissionMap = new Map();
        policies.forEach((policy) => {
            const policyPermissions = policy.permissions || [];
            policyPermissionMap.set(policy.name, policyPermissions);
            delete policy.permissions;
            const existingPolicy = (0, find_js_1.default)(existingPolicies, ['name', policy.name]);
            if (existingPolicy) {
                policy.id = existingPolicy.id;
                policiesToUpdate.push(policy);
            }
            else {
                policiesToCreate.push(policy);
            }
        });
        let createdPolicies = [];
        if (policiesToCreate.length) {
            if (options.verbose)
                console.info(`Creating ${policiesToCreate.length} policies`);
            createdPolicies = await client.request((0, sdk_1.createPolicies)(policiesToCreate));
            createdPolicies.forEach((createdPolicy) => {
                const policy = (0, find_js_1.default)(policiesToCreate, ['name', createdPolicy.name]);
                if (policy)
                    policy.id = createdPolicy.id;
            });
        }
        if (policiesToUpdate.length) {
            if (options.verbose)
                console.info(`Updating ${policiesToUpdate.length} policies`);
            await Promise.all(policiesToUpdate.map((policy) => {
                const { id, ...data } = policy;
                return client.request((0, sdk_1.updatePolicy)(id, data)).catch((err) => {
                    console.error(`Error updating policy ${policy.name || id}:`, err);
                });
            }));
        }
        const updatedPolicies = await client.request((0, sdk_1.readPolicies)({ limit: -1 }));
        for (const policy of policies) {
            const policyName = policy.name;
            const policyPermissions = policyPermissionMap.get(policyName) || [];
            const policyObj = (0, find_js_1.default)(updatedPolicies, ['name', policyName]);
            if (!policyObj) {
                console.warn(`Could not find policy with name ${policyName}`);
                continue;
            }
            for (const permission of policyPermissions) {
                const permissionWithPolicy = { ...permission, policy: policyObj.id };
                const existingPermission = (0, find_js_1.default)(existingPermissions, {
                    action: permission.action,
                    collection: permission.collection,
                    policy: policyObj.id,
                });
                if (existingPermission && existingPermission.id) {
                    permissionWithPolicy.id = existingPermission.id;
                    permissionsToUpdate.push(permissionWithPolicy);
                }
                else {
                    permissionsToCreate.push(permissionWithPolicy);
                }
            }
        }
        if (permissionsToCreate.length) {
            if (options.verbose)
                console.info(`Creating ${permissionsToCreate.length} permissions`);
            await client.request((0, sdk_1.createPermissions)(permissionsToCreate));
        }
        if (permissionsToUpdate.length) {
            if (options.verbose)
                console.info(`Updating ${permissionsToUpdate.length} permissions`);
            await Promise.all(permissionsToUpdate.map((permission) => client.request((0, sdk_1.updatePermission)(permission.id, permission)).catch((err) => {
                console.error(err, permission);
            })));
        }
        if (options.remove) {
            const allPolicies = await client.request((0, sdk_1.readPolicies)({ limit: -1 }));
            const allPermissions = await client.request((0, sdk_1.readPermissions)({ limit: -1 }));
            const policiesToDelete = allPolicies.filter((existingPolicy) => {
                if (existingPolicy.admin_access === true)
                    return false;
                return !(0, find_js_1.default)(policies, ['name', existingPolicy.name]);
            });
            const permissionsToDelete = allPermissions.filter((existingPermission) => {
                if (!existingPermission.id || !existingPermission.policy)
                    return false;
                const policyStillExists = (0, find_js_1.default)(updatedPolicies, ['id', existingPermission.policy]);
                if (!policyStillExists)
                    return true;
                const policy = (0, find_js_1.default)(policies, ['name', policyStillExists.name]);
                if (!policy)
                    return true;
                const policyPermissions = policyPermissionMap.get(policy.name) || [];
                return !(0, find_js_1.default)(policyPermissions, {
                    action: existingPermission.action,
                    collection: existingPermission.collection,
                });
            });
            if (permissionsToDelete.length) {
                if (options.verbose)
                    console.info(`Removing ${permissionsToDelete.length} permissions`);
                const permissionsToDeleteIds = permissionsToDelete
                    .map((0, property_js_1.default)('id'))
                    .filter((id) => id && id !== '');
                if (permissionsToDeleteIds.length) {
                    await client.request((0, sdk_1.deletePermissions)(permissionsToDeleteIds));
                }
            }
            if (policiesToDelete.length) {
                if (options.verbose)
                    console.info(`Removing ${policiesToDelete.length} policies`);
                const policiesToDeleteIds = policiesToDelete
                    .map((0, property_js_1.default)('id'))
                    .filter((id) => id && id !== '');
                if (policiesToDeleteIds.length) {
                    await client.request((0, sdk_1.deletePolicies)(policiesToDeleteIds));
                }
            }
        }
        if (options.verbose)
            console.info('Policies and permissions imported');
        // ============================================
        // PHASE 2: Import Roles
        // ============================================
        if (options.verbose)
            console.info('Importing roles...');
        const rolesSrc = path_1.default.join(src, 'roles');
        const existingRoles = await client.request((0, sdk_1.readRoles)({
            limit: -1,
            fields: ['*', 'users.*', 'children.*', 'policies.*']
        }));
        existingPolicies = await client.request((0, sdk_1.readPolicies)({ limit: -1 }));
        const roles = (0, readYamlFiles_js_1.default)(rolesSrc);
        const rolesToCreate = [];
        const rolesToUpdate = [];
        roles.forEach((role) => {
            if (role.name === 'Administrator') {
                if (options.verbose)
                    console.info(`Skipping Administrator role`);
                return;
            }
            if (role.name === 'Public') {
                if (options.verbose)
                    console.info(`Skipping Public role (built-in), will handle policy attachments separately`);
                const resolvedPolicies = (role.policies || [])
                    .map(p => resolvePolicyRef(p, existingPolicies, options.verbose))
                    .filter((id) => id !== null);
                role.id = null;
                role.policiesToAttach = resolvedPolicies;
                rolesToUpdate.push(role);
                return;
            }
            const existingRole = (0, find_js_1.default)(existingRoles, ['name', role.name]);
            if (existingRole) {
                const roleToUpdate = { id: existingRole.id, name: existingRole.name };
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
                    const resolvedParentStr = resolveRoleRef(role.parent, existingRoles, options.verbose);
                    let currentParentId = null;
                    if (typeof existingRole.parent === 'string') {
                        currentParentId = existingRole.parent;
                    }
                    else if (existingRole.parent && typeof existingRole.parent === 'object') {
                        currentParentId = existingRole.parent.id;
                    }
                    if (resolvedParentStr !== currentParentId) {
                        roleToUpdate.parent = resolvedParentStr || null;
                        hasChanges = true;
                    }
                }
                const resolvedPolicies = (role.policies || [])
                    .map(p => resolvePolicyRef(p, existingPolicies, options.verbose))
                    .filter((id) => id !== null);
                if (hasChanges) {
                    roleToUpdate.policiesToAttach = resolvedPolicies;
                    rolesToUpdate.push(roleToUpdate);
                }
                else {
                    rolesToUpdate.push({
                        id: existingRole.id,
                        name: role.name,
                        policiesToAttach: resolvedPolicies,
                        _skipMetadataUpdate: true
                    });
                }
            }
            else {
                const roleToCreate = {
                    name: role.name,
                    icon: role.icon,
                    description: role.description
                };
                if (role.parent !== undefined) {
                    const resolvedParentStr = resolveRoleRef(role.parent, existingRoles, options.verbose);
                    if (resolvedParentStr) {
                        roleToCreate.parent = resolvedParentStr;
                    }
                }
                const resolvedPolicies = (role.policies || [])
                    .map(p => resolvePolicyRef(p, existingPolicies, options.verbose))
                    .filter((id) => id !== null);
                roleToCreate.policiesToAttach = resolvedPolicies;
                delete roleToCreate.policies;
                rolesToCreate.push(roleToCreate);
            }
        });
        if (rolesToCreate.length) {
            if (options.verbose)
                console.info(`Creating ${rolesToCreate.length} roles`);
            const rolesToCreatePayload = rolesToCreate.map((r) => {
                const { policiesToAttach, ...data } = r;
                return data;
            });
            const createdRoles = await client.request((0, sdk_1.createRoles)(rolesToCreatePayload));
            createdRoles.forEach((createdRole) => {
                const role = (0, find_js_1.default)(rolesToCreate, ['name', createdRole.name]);
                if (role)
                    role.id = createdRole.id;
            });
        }
        const rolesToActuallyUpdate = rolesToUpdate.filter((r) => r.name !== 'Administrator' && r.id !== null && !r._skipMetadataUpdate);
        if (rolesToActuallyUpdate.length) {
            if (options.verbose)
                console.info(`Updating ${rolesToActuallyUpdate.length} roles`);
            await Promise.all(rolesToActuallyUpdate.map((role) => {
                const { id, policiesToAttach, _skipMetadataUpdate, ...data } = role;
                return client.request((0, sdk_1.updateRole)(id, data)).catch((err) => {
                    console.error(`Error updating role ${role.name || id}:`, err);
                });
            }));
        }
        const updatedRoles = await client.request((0, sdk_1.readRoles)({
            limit: -1,
            fields: ['*', 'users.*', 'children.*', 'policies.*']
        }));
        for (const role of [...rolesToCreate, ...rolesToUpdate]) {
            const policiesToAttach = role.policiesToAttach || [];
            if (!role.id && role.name !== 'Public') {
                const updatedRole = (0, find_js_1.default)(updatedRoles, ['name', role.name]);
                if (updatedRole)
                    role.id = updatedRole.id;
            }
            if (!role.id && role.name !== 'Public') {
                console.warn(`Could not find role ID for ${role.name}`);
                continue;
            }
            const roleIdForAccess = role.name === 'Public' ? null : (role.id || null);
            await handleRolePolicies(roleIdForAccess, role.name || '', policiesToAttach, options.verbose || false);
        }
        if (options.remove) {
            const allRoles = await client.request((0, sdk_1.readRoles)({
                limit: -1,
                fields: ['*', 'users.*', 'children.*', 'policies.*']
            }));
            const rolesToDelete = allRoles.filter((existingRole) => {
                if (existingRole.name === 'Administrator')
                    return false;
                return !(0, find_js_1.default)(roles, ['name', existingRole.name]);
            });
            if (rolesToDelete.length) {
                if (options.verbose)
                    console.info(`Removing ${rolesToDelete.length} roles`);
                const rolesToDeleteIds = rolesToDelete
                    .map((0, property_js_1.default)('id'))
                    .filter((id) => id && id !== '');
                if (rolesToDeleteIds.length) {
                    await client.request((0, sdk_1.deleteRoles)(rolesToDeleteIds));
                }
            }
        }
        if (options.verbose)
            console.info('Roles and policies imported');
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = importRolesAndPolicies;
//# sourceMappingURL=importRolesAndPolicies.js.map