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
const fse_1 = __importDefault(require("fse"));
const path_1 = __importDefault(require("path"));
const yaml_1 = require("yaml");
const sdk_1 = require("@directus/sdk");
const slugify_1 = __importDefault(require("slugify"));
const createDirectusClient_js_1 = __importStar(require("../shared/createDirectusClient.js"));
async function exportRoles(dest, options = { verbose: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        // Get all policies to map IDs to names
        const allPolicies = await client.request((0, sdk_1.readPolicies)({ limit: -1 }));
        // Create a map from policy ID to policy name for reference
        const policyIdToName = new Map();
        allPolicies.forEach(policy => {
            if (policy.id && policy.name) {
                policyIdToName.set(policy.id, policy.name);
            }
        });
        // Get ALL roles to build a complete mapping of ID to Name for parent/child resolution
        // We include Administrator here to ensure it can be resolved as a parent
        const allRolesForMapping = await client.request((0, sdk_1.readRoles)({ limit: -1, fields: ['id', 'name'] }));
        const roleIdToName = new Map();
        allRolesForMapping.forEach(r => {
            if (r.id && r.name) {
                roleIdToName.set(r.id, r.name);
            }
        });
        // Get roles to export (excluding Administrator)
        const roles = await client.request((0, sdk_1.readRoles)({
            limit: -1,
            filter: {
                name: { _neq: "Administrator" },
            },
            fields: ['*', 'policies.*', 'children.*'],
        }));
        // Get all access entries to map roles to policies
        // In Directus v11+, roles are connected to policies via the directus_access table.
        // We use the REST API directly since directus_access is a system collection.
        let allAccessEntries = [];
        try {
            const params = new URLSearchParams({
                limit: '-1',
                fields: 'role,policy',
            });
            const response = await fetch(`${createDirectusClient_js_1.directusUrl}/access?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
                },
            });
            const data = (await response.json());
            allAccessEntries = data.data || [];
        }
        catch (e) {
            if (options.verbose)
                console.warn('Could not fetch access entries from /access:', e.message);
        }
        // Map role IDs to policy names
        const roleIdToPolicyNames = new Map();
        const publicRolePolicyNames = [];
        allAccessEntries.forEach(entry => {
            const policyName = policyIdToName.get(entry.policy);
            if (!policyName)
                return;
            if (entry.role === null) {
                if (!publicRolePolicyNames.includes(policyName)) {
                    publicRolePolicyNames.push(policyName);
                }
            }
            else {
                if (!roleIdToPolicyNames.has(entry.role)) {
                    roleIdToPolicyNames.set(entry.role, new Set());
                }
                roleIdToPolicyNames.get(entry.role).add(policyName);
            }
        });
        fse_1.default.mkdirSync(dest, { recursive: true });
        let exportedCount = 0;
        // Export all roles except Administrator
        roles.forEach((role) => {
            // Handle i18n translation keys - map $t:public_label to 'public'
            let filename = role.name || '';
            if (filename === '$t:public_label') {
                filename = 'public';
            }
            else if (filename.startsWith('$t:')) {
                // For other translation keys, strip the $t: prefix and slugify
                filename = filename.substring(3);
            }
            const destPath = path_1.default.join(dest, (0, slugify_1.default)(filename, { replacement: '_', lower: false }) + '.yaml');
            if (!options.overwrite && fse_1.default.existsSync(destPath)) {
                if (options.verbose)
                    console.info(`File ${destPath} already exists.`);
                return;
            }
            // Clean up role data for export
            // Convert policy IDs to policy names for portability across environments
            // We primarily use the mapping from directus_access, but fall back to role.policies if available
            const policyNames = Array.from(roleIdToPolicyNames.get(role.id) || []);
            const seenPolicyNames = new Set(policyNames);
            for (const p of role.policies || []) {
                const policyId = p.id || p;
                let policyName = policyIdToName.get(policyId);
                // If not found in map, check if policy exists in allPolicies directly
                if (!policyName) {
                    const policyObj = allPolicies.find(pol => pol.id === policyId);
                    if (policyObj && policyObj.name) {
                        policyName = policyObj.name;
                    }
                }
                if (policyName && !seenPolicyNames.has(policyName)) {
                    policyNames.push(policyName);
                    seenPolicyNames.add(policyName);
                }
            }
            // If still no policies found, try heuristic matching by name pattern
            if (policyNames.length === 0) {
                const roleNameLower = (role.name || '').toLowerCase().replace(/[\s-]/g, '');
                const matchingPolicy = allPolicies.find(pol => {
                    const polNameLower = (pol.name || '').toLowerCase().replace(/[\s-]/g, '');
                    return polNameLower.includes(roleNameLower) || roleNameLower.includes(polNameLower);
                });
                if (matchingPolicy && matchingPolicy.name) {
                    const policyName = matchingPolicy.name;
                    if (!seenPolicyNames.has(policyName)) {
                        policyNames.push(policyName);
                        seenPolicyNames.add(policyName);
                        if (options.verbose) {
                            console.warn(`Role '${role.name}': No policies found in access table. Using heuristic match: '${policyName}'`);
                        }
                    }
                }
            }
            // Convert child role IDs to child role names for portability across environments
            const childRoleNames = [];
            const seenChildNames = new Set(); // Track seen child names for deduplication
            const missingChildRoles = [];
            for (const c of role.children || []) {
                const childId = c.id || c;
                const childName = roleIdToName.get(childId);
                if (childName) {
                    // Deduplicate: only add if we haven't seen this child name before
                    if (!seenChildNames.has(childName)) {
                        childRoleNames.push(childName);
                        seenChildNames.add(childName);
                    }
                }
                else {
                    missingChildRoles.push(childId);
                    if (options.verbose) {
                        console.warn(`Role '${role.name}': Child role with ID '${childId}' not found in role list. Skipping.`);
                    }
                }
            }
            // Convert parent role ID to parent role name for portability across environments
            let parentRoleName = null;
            if (role.parent) {
                parentRoleName = roleIdToName.get(role.parent) ?? null;
                if (!parentRoleName) {
                    if (options.verbose) {
                        console.warn(`Role '${role.name}': Parent role with ID '${role.parent}' not found in role list.`);
                    }
                    parentRoleName = null;
                }
            }
            // Sort policy names for deterministic output
            policyNames.sort();
            const cleanRole = {
                name: role.name,
                icon: role.icon || null,
                description: role.description || null,
                parent: parentRoleName,
                children: childRoleNames.length > 0 ? childRoleNames : undefined,
                // Store policy NAMES (not IDs) that are attached to this role
                // These reference policies by name for portability across environments
                policies: policyNames.length > 0 ? policyNames : undefined,
            };
            // Remove null/undefined values for cleaner YAML
            Object.keys(cleanRole).forEach((key) => {
                if (cleanRole[key] === null || cleanRole[key] === undefined) {
                    delete cleanRole[key];
                }
            });
            // Remove id field for export
            delete cleanRole.id;
            if (cleanRole.users)
                delete cleanRole.users;
            fse_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(cleanRole), { encoding: 'utf8' });
            exportedCount++;
            if (options.verbose)
                console.info(`Exported role ${destPath}`);
        });
        // Export Public role if it has policies attached
        // The Public role is a built-in role that doesn't appear in the roles list
        // In Directus v11.17.4+, it's represented by null in the directus_access table
        if (publicRolePolicyNames.length > 0) {
            const destPath = path_1.default.join(dest, 'public.yaml');
            if (!options.overwrite && fse_1.default.existsSync(destPath)) {
                if (options.verbose)
                    console.info(`File ${destPath} already exists.`);
            }
            else {
                // Create a Public role with the attached policy names (not IDs)
                const publicRole = {
                    name: 'Public',
                    icon: 'globe',
                    description: 'Öffentlicher Zugriff',
                    policies: publicRolePolicyNames.sort(),
                };
                // Remove null/undefined values for cleaner YAML
                Object.keys(publicRole).forEach((key) => {
                    if (publicRole[key] === null || publicRole[key] === undefined) {
                        delete publicRole[key];
                    }
                });
                fse_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(publicRole), { encoding: 'utf8' });
                exportedCount++;
                if (options.verbose)
                    console.info(`Exported Public role ${destPath}`);
            }
        }
        if (options.verbose) {
            console.info(`Exported ${exportedCount} roles.`);
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = exportRoles;
//# sourceMappingURL=exportRoles.js.map