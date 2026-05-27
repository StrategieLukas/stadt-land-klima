"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const find_js_1 = __importDefault(require("lodash/find.js"));
const property_js_1 = __importDefault(require("lodash/property.js"));
const sdk_1 = require("@directus/sdk");
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
const readYamlFiles_js_1 = __importDefault(require("../shared/readYamlFiles.js"));
async function importPolicies(src, options = { verbose: false, remove: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        // Get existing policies and permissions
        const existingPolicies = await client.request((0, sdk_1.readPolicies)({ limit: -1 }));
        const existingPermissions = await client.request((0, sdk_1.readPermissions)({ limit: -1 }));
        // Read policy YAML files
        const policies = (0, readYamlFiles_js_1.default)(path_1.default.join(src));
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
            const existingPolicy = (0, find_js_1.default)(existingPolicies, ['name', policy.name]);
            if (existingPolicy) {
                policy.id = existingPolicy.id;
                policiesToUpdate.push(policy);
            }
            else {
                policiesToCreate.push(policy);
            }
        });
        // --- Create/Update Policies ---
        let createdPolicies = [];
        if (policiesToCreate.length) {
            if (options.verbose)
                console.info(`Creating ${policiesToCreate.length} policies`);
            createdPolicies = await client.request((0, sdk_1.createPolicies)(policiesToCreate));
            // Update the policy objects with the newly created IDs
            createdPolicies.forEach((createdPolicy) => {
                const policy = (0, find_js_1.default)(policiesToCreate, ['name', createdPolicy.name]);
                if (policy)
                    policy.id = createdPolicy.id;
            });
        }
        if (policiesToUpdate.length) {
            if (options.verbose)
                console.info(`Updating ${policiesToUpdate.length} policies`);
            await Promise.all(policiesToUpdate.map((policy) => client.request((0, sdk_1.updatePolicy)(policy.id, policy)).catch((err) => {
                console.error(err, policy);
            })));
        }
        // --- Refresh policies list to get all IDs ---
        const updatedPolicies = await client.request((0, sdk_1.readPolicies)({ limit: -1 }));
        // --- Process permissions for each policy ---
        for (const policy of policies) {
            const policyName = policy.name;
            const policyPermissions = policyPermissionMap.get(policyName) || [];
            // Find the policy ID (either from existing or newly created)
            const policyObj = (0, find_js_1.default)(updatedPolicies, ['name', policyName]);
            if (!policyObj) {
                console.warn(`Could not find policy with name ${policyName}`);
                continue;
            }
            for (const permission of policyPermissions) {
                // Add policy reference to permission
                const permissionWithPolicy = { ...permission, policy: policyObj.id };
                // Check if this permission already exists
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
        // --- Create/Update Permissions ---
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
        // --- Remove orphaned policies and permissions ---
        if (options.remove) {
            const allPolicies = await client.request((0, sdk_1.readPolicies)({ limit: -1 }));
            const allPermissions = await client.request((0, sdk_1.readPermissions)({ limit: -1 }));
            const policiesToDelete = allPolicies.filter((existingPolicy) => {
                // Don't delete admin policies
                if (existingPolicy.admin_access === true)
                    return false;
                // Don't delete policies that are referenced by roles
                return !(0, find_js_1.default)(policies, ['name', existingPolicy.name]);
            });
            const permissionsToDelete = allPermissions.filter((existingPermission) => {
                if (!existingPermission.id || !existingPermission.policy)
                    return false;
                // Check if this permission belongs to a policy that still exists
                const policyStillExists = (0, find_js_1.default)(updatedPolicies, ['id', existingPermission.policy]);
                if (!policyStillExists)
                    return true;
                // Check if this permission is still in the YAML
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
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = importPolicies;
//# sourceMappingURL=importPolicies.js.map