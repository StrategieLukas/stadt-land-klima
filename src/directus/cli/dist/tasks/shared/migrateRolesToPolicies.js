"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fse_1 = __importDefault(require("fse"));
const path_1 = __importDefault(require("path"));
const yaml_1 = require("yaml");
const slugify_1 = __importDefault(require("slugify"));
function parseYamlFile(filePath) {
    const content = fse_1.default.readFileSync(filePath, 'utf8');
    return (0, yaml_1.parse)(content);
}
async function migrateRolesToPolicies(rolesSrc, policiesDest) {
    console.log(`Migrating roles from ${rolesSrc} to policies format`);
    console.log(`Policies will be saved to ${policiesDest}`);
    // Create policies directory if it doesn't exist
    fse_1.default.mkdirSync(policiesDest, { recursive: true });
    // Read all role files
    const roleFiles = fse_1.default.readdirSync(rolesSrc).filter(f => (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('.'));
    let migratedCount = 0;
    let policyCount = 0;
    for (const roleFile of roleFiles) {
        const rolePath = path_1.default.join(rolesSrc, roleFile);
        let role;
        try {
            role = parseYamlFile(rolePath);
        }
        catch (err) {
            console.warn(`Could not parse ${roleFile}: ${err.message}`);
            continue;
        }
        if (!role.name) {
            console.warn(`Skipping ${roleFile}: no name field`);
            continue;
        }
        // Skip if role already has policies (already migrated)
        if (role.policies && role.policies.length > 0) {
            console.log(`Skipping ${role.name}: already has policies`);
            continue;
        }
        if (!role.permissions || role.permissions.length === 0) {
            console.log(`Skipping ${role.name}: no permissions`);
            continue;
        }
        // Create a policy for this role's permissions
        const policyName = `${role.name} Policy`;
        const policySlug = (0, slugify_1.default)(policyName, { replacement: '_', lower: true });
        const policyFile = path_1.default.join(policiesDest, `${policySlug}.yaml`);
        // Create policy with permissions
        const policy = {
            name: policyName,
            description: `Auto-migrated policy from ${role.name} role`,
            permissions: role.permissions.map(perm => {
                const cleanPerm = { ...perm };
                // Remove role reference if it exists
                delete cleanPerm.role;
                delete cleanPerm.role_name;
                delete cleanPerm.policy;
                delete cleanPerm.id;
                return cleanPerm;
            }),
        };
        // Write policy file
        fse_1.default.writeFileSync(policyFile, (0, yaml_1.stringify)(policy), { encoding: 'utf8' });
        policyCount++;
        // Update role to reference the policy
        const updatedRole = { ...role };
        delete updatedRole.permissions;
        // Store policy name as reference (will be resolved during import)
        updatedRole.policies = [policyName];
        // Write updated role file
        fse_1.default.writeFileSync(rolePath, (0, yaml_1.stringify)(updatedRole), { encoding: 'utf8' });
        migratedCount++;
        console.log(`Migrated ${role.name}: created policy "${policyName}"`);
    }
    console.log(`\nMigration complete:`);
    console.log(`- Migrated ${migratedCount} roles`);
    console.log(`- Created ${policyCount} policies`);
    console.log(`\nNext steps:`);
    console.log(`1. Review the generated policy files in ${policiesDest}`);
    console.log(`2. Run: ./directus-cli import:policies ${policiesDest}`);
    console.log(`3. Run: ./directus-cli import:roles ${rolesSrc}`);
}
// Check if this is being run directly
const isMainModule = process.argv[1]?.endsWith('migrateRolesToPolicies.ts') || process.argv[1]?.endsWith('migrateRolesToPolicies.js');
if (isMainModule) {
    const rolesSrc = process.argv[2] || path_1.default.join(process.cwd(), 'roles');
    const policiesDest = process.argv[3] || path_1.default.join(process.cwd(), 'policies');
    migrateRolesToPolicies(rolesSrc, policiesDest).catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
}
exports.default = migrateRolesToPolicies;
//# sourceMappingURL=migrateRolesToPolicies.js.map