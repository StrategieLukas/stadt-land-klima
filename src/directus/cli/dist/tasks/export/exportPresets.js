"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fse_1 = __importDefault(require("fse"));
const path_1 = __importDefault(require("path"));
const yaml_1 = require("yaml");
const sdk_1 = require("@directus/sdk");
const slugify_1 = __importDefault(require("slugify"));
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
async function exportPresets(dest, options = { verbose: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        // Fetch all presets
        const presets = await client.request((0, sdk_1.readPresets)({ limit: -1 }));
        // Fetch all roles to map role IDs to names
        const roles = await client.request((0, sdk_1.readRoles)({ limit: -1 }));
        const roleMap = Object.fromEntries(roles.map(r => [r.id, r.name]));
        fse_1.default.mkdirSync(dest, { recursive: true });
        for (const preset of presets) {
            // Skip user-specific presets
            if (preset.user)
                continue;
            // Remove ID from export
            const { id, ...presetData } = preset;
            // Determine filename
            let filename = '';
            if (!preset.role) {
                // Global default
                filename = (0, slugify_1.default)(preset.collection, { replacement: '_', lower: false }) + '.yaml';
            }
            else {
                // Role-specific default
                const roleName = roleMap[preset.role] || preset.role;
                filename =
                    (0, slugify_1.default)(`${preset.collection}-${roleName}`, { replacement: '_', lower: false }) +
                        '.yaml';
            }
            const destPath = path_1.default.join(dest, filename);
            if (!options.overwrite && fse_1.default.existsSync(destPath)) {
                if (options.verbose)
                    console.info(`File ${destPath} already exists. Skipping.`);
                continue;
            }
            fse_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(presetData), { encoding: 'utf8' });
            if (options.verbose) {
                console.info(`Exported preset to ${destPath}`);
            }
        }
        if (options.verbose)
            console.info('All eligible presets exported.');
    }
    catch (err) {
        console.error('Error exporting presets:', err);
        process.exit(1);
    }
}
exports.default = exportPresets;
//# sourceMappingURL=exportPresets.js.map