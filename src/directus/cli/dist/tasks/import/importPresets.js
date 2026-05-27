"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const sdk_1 = require("@directus/sdk");
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
const readYamlFiles_js_1 = __importDefault(require("../shared/readYamlFiles.js"));
async function importDefaultPresets(src, options = { verbose: false, remove: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        if (options.verbose)
            console.info('Reading presets from YAML files...');
        const presets = (0, readYamlFiles_js_1.default)(path_1.default.join(src));
        if (options.verbose)
            console.info('Fetching existing presets...');
        const existingPresets = (await client.request((0, sdk_1.readPresets)({ limit: -1 })));
        // Filter presets that can be safely replaced (user=null)
        const presetsToDelete = existingPresets.filter((p) => !p.user);
        if (presetsToDelete.length) {
            if (options.verbose)
                console.info(`Deleting ${presetsToDelete.length} old default presets...`);
            const presetsToDeleteIds = presetsToDelete
                .map((p) => p.id)
                .filter((id) => id && id !== '');
            if (presetsToDeleteIds.length) {
                await client.request((0, sdk_1.deletePresets)(presetsToDeleteIds));
            }
        }
        if (options.verbose)
            console.info(`Creating ${presets.length} new default presets...`);
        await client.request((0, sdk_1.createPresets)(presets));
        if (options.verbose)
            console.info('Default and role-specific presets imported successfully.');
    }
    catch (err) {
        console.error('Error importing presets:', err);
        process.exit(1);
    }
}
exports.default = importDefaultPresets;
//# sourceMappingURL=importPresets.js.map