"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const fse_1 = __importDefault(require("fse"));
const path_1 = __importDefault(require("path"));
const yaml_1 = require("yaml");
const sdk_1 = require("@directus/sdk");
const slugify_1 = __importDefault(require("slugify"));
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
async function exportPolicies(dest, options = { verbose: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        // Get all policies (excluding admin policies if needed)
        const policies = await client.request((0, sdk_1.readPolicies)({
            limit: -1,
            fields: ['*', 'permissions.*'],
        }));
        // Get all permissions to find those attached to policies
        const allPermissions = await client.request((0, sdk_1.readPermissions)({ limit: -1 }));
        fs_1.default.mkdirSync(dest, { recursive: true });
        let exportedCount = 0;
        // Export each policy with its permissions
        policies.forEach((policy) => {
            // Skip system/admin policies if they have admin_access true
            // as these are typically auto-generated
            if (policy.admin_access === true) {
                if (options.verbose)
                    console.info(`Skipping admin policy: ${policy.name}`);
                return;
            }
            // Handle i18n translation keys - map $t:public_label to 'public'
            let filename = policy.name;
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
            // Get permissions for this policy
            const policyPermissions = allPermissions.filter((permission) => permission.policy === policy.id);
            // Clean up policy data for export
            // Note: We explicitly use NAME (not ID) as the unique identifier for portability
            const cleanPolicy = {
                name: policy.name,
                icon: policy.icon || null,
                description: policy.description || null,
                ip_access: policy.ip_access || null,
                enforce_tfa: policy.enforce_tfa || false,
                admin_access: policy.admin_access || false,
                app_access: policy.app_access !== undefined ? policy.app_access : true,
                permissions: policyPermissions.map((permission) => {
                    // Remove internal fields for export
                    const cleanPermission = { ...permission };
                    delete cleanPermission.id;
                    delete cleanPermission.policy;
                    return cleanPermission;
                }).sort((a, b) => {
                    // Sort by collection then action for deterministic order
                    if (a.collection === b.collection) {
                        return a.action < b.action ? -1 : 1;
                    }
                    return a.collection < b.collection ? -1 : 1;
                }),
            };
            // Remove null/undefined values for cleaner YAML
            Object.keys(cleanPolicy).forEach((key) => {
                if (cleanPolicy[key] === null || cleanPolicy[key] === undefined) {
                    delete cleanPolicy[key];
                }
            });
            // Explicitly remove id field to ensure no UUIDs are exported (use name as identifier)
            delete cleanPolicy.id;
            fs_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(cleanPolicy), { encoding: 'utf8' });
            exportedCount++;
            if (options.verbose)
                console.info(`Exported policy ${destPath}`);
        });
        if (options.verbose) {
            console.info(`Exported ${exportedCount} policies.`);
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = exportPolicies;
//# sourceMappingURL=exportPolicies.js.map