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
const createDirectusClient_js_1 = __importStar(require("../shared/createDirectusClient.js"));
const readYamlFile_js_1 = __importDefault(require("../shared/readYamlFile.js"));
// Sensitive settings fields that should be populated from environment variables
// These are filtered out during export and merged during import
const SENSITIVE_SETTINGS_FIELDS = {
    mapbox_key: 'string',
    ai_openai_api_key: 'string',
    ai_anthropic_api_key: 'string',
    ai_google_api_key: 'string',
    ai_openai_compatible_api_key: 'string',
    ai_openai_compatible_headers: 'json',
    // Public branding assets that are managed separately
    project_logo: 'json',
    public_foreground: 'string',
    public_background: 'string',
    public_favicon: 'json',
};
// Wildcard pattern to catch any field containing "key" (case-insensitive)
const WILDCARD_PATTERN = /key/i;
/**
 * Parses a string value based on the expected field type
 * - 'string': returns value as-is
 * - 'json': attempts to parse as JSON, falls back to string
 */
function parseValue(value, type) {
    if (type === 'json') {
        try {
            return JSON.parse(value);
        }
        catch (e) {
            // If parsing fails, return as string
            return value;
        }
    }
    return value;
}
/**
 * Merges environment variables into settings for sensitive fields
 * Automatically detects all DIRECTUS_* environment variables and maps them
 * to setting fields by removing the DIRECTUS_ prefix and converting to lowercase.
 * Only merges fields that are in SENSITIVE_SETTINGS_FIELDS or match wildcard patterns.
 */
function mergeEnvSettings(settings, verbose = false) {
    const merged = { ...settings };
    let mergedCount = 0;
    for (const [envVar, envValue] of Object.entries(process.env)) {
        if (envVar.startsWith('DIRECTUS_') && envValue !== undefined && envValue !== null && envValue !== '') {
            // Remove DIRECTUS_ prefix and convert to lowercase
            const settingField = envVar.slice('DIRECTUS_'.length).toLowerCase();
            // Check if this field should be merged
            // Either it's in our known list, or it matches a wildcard pattern
            const isKnownField = settingField in SENSITIVE_SETTINGS_FIELDS;
            const matchesWildcard = WILDCARD_PATTERN.test(settingField);
            if (isKnownField || matchesWildcard) {
                const fieldType = isKnownField ? SENSITIVE_SETTINGS_FIELDS[settingField] : 'string';
                merged[settingField] = parseValue(envValue, fieldType);
                mergedCount++;
                if (verbose) {
                    console.info(`Merged ${settingField} (type: ${fieldType}) from ${envVar} environment variable`);
                }
            }
        }
    }
    return { merged, mergedCount };
}
async function importSettings(src, options = { verbose: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        const settings = (0, readYamlFile_js_1.default)(path_1.default.join(src, 'settings.yaml'));
        // Merge environment variables for sensitive fields
        const { merged: settingsWithEnv, mergedCount } = mergeEnvSettings(settings, options.verbose);
        // Use PATCH request to avoid the SDK's full update behavior
        // Directus 11.17.4 has a bug with updateSettings and parameter counting
        const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;
        const response = await fetch(`${createDirectusClient_js_1.directusUrl}/settings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(settingsWithEnv),
        });
        if (!response.ok) {
            const errorData = (await response.json());
            throw new Error(`Failed to update settings: ${errorData.errors?.[0]?.message || errorData.message || response.statusText}`);
        }
        if (options.verbose) {
            console.info('Settings imported');
            if (mergedCount > 0) {
                console.info(`Merged ${mergedCount} sensitive field(s) from environment variables`);
            }
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = importSettings;
//# sourceMappingURL=importSettings.js.map