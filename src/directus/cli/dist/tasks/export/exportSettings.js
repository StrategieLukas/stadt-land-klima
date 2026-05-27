"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fse_1 = __importDefault(require("fse"));
const path_1 = __importDefault(require("path"));
const yaml_1 = require("yaml");
const sdk_1 = require("@directus/sdk");
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
// Explicitly known sensitive fields that should NOT be exported to version control
// These will be populated from environment variables during import
const SENSITIVE_SETTINGS_FIELDS = [
    'mapbox_key',
    'ai_openai_api_key',
    'ai_anthropic_api_key',
    'ai_google_api_key',
    'ai_openai_compatible_api_key',
    'ai_openai_compatible_headers',
    // Public branding assets that are managed separately
    'project_logo',
    'public_foreground',
    'public_background',
    'public_favicon',
];
// Wildcard pattern to catch any field containing "key" (case-insensitive)
// This provides a safety net for new API key fields added in future Directus versions
const WILDCARD_PATTERNS = [
    /key/i, // Matches any field name containing "key" (case-insensitive)
];
/**
 * Checks if a field name matches any wildcard pattern
 */
function matchesWildcardPattern(fieldName) {
    for (const pattern of WILDCARD_PATTERNS) {
        if (pattern.test(fieldName)) {
            return true;
        }
    }
    return false;
}
/**
 * Filters out sensitive fields from settings that should not be committed to version control
 */
function filterSensitiveSettings(settings) {
    const filtered = { ...settings };
    // Remove explicitly known sensitive fields
    for (const field of SENSITIVE_SETTINGS_FIELDS) {
        if (field in filtered) {
            delete filtered[field];
        }
    }
    // Remove any field matching wildcard patterns (e.g., containing "key")
    for (const fieldName of Object.keys(filtered)) {
        if (matchesWildcardPattern(fieldName)) {
            delete filtered[fieldName];
        }
    }
    return filtered;
}
async function exportSettings(dest, options = { verbose: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        const settings = (await client.request((0, sdk_1.readSettings)()));
        // Filter out sensitive fields before exporting
        const safeSettings = filterSensitiveSettings(settings);
        fse_1.default.mkdirSync(dest);
        const destPath = path_1.default.join(dest, 'settings.yaml');
        if (!options.overwrite && fse_1.default.existsSync(destPath)) {
            if (options.verbose) {
                console.info(`File ${destPath} already exists.`);
            }
            return;
        }
        fse_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(safeSettings), { encoding: 'utf8' });
        if (options.verbose) {
            console.info(`Exported setting ${destPath}`);
            // Count explicitly filtered fields
            const explicitFilteredCount = SENSITIVE_SETTINGS_FIELDS.filter(f => f in settings).length;
            // Count wildcard-matched fields that were filtered
            const wildcardFilteredFields = Object.keys(settings).filter(fieldName => !SENSITIVE_SETTINGS_FIELDS.includes(fieldName) &&
                matchesWildcardPattern(fieldName));
            const wildcardFilteredCount = wildcardFilteredFields.length;
            const totalFiltered = explicitFilteredCount + wildcardFilteredCount;
            if (totalFiltered > 0) {
                console.info(`Filtered out ${totalFiltered} sensitive field(s) from export`);
                if (explicitFilteredCount > 0 && wildcardFilteredCount > 0) {
                    console.info(`  - ${explicitFilteredCount} from explicit list`);
                    console.info(`  - ${wildcardFilteredCount} from wildcard patterns (containing "key")`);
                }
            }
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = exportSettings;
//# sourceMappingURL=exportSettings.js.map