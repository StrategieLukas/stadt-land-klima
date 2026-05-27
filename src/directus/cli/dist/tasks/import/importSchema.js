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
const readYamlFiles_js_1 = __importDefault(require("../shared/readYamlFiles.js"));
const readYamlFile_js_1 = __importDefault(require("../shared/readYamlFile.js"));
async function importSchema(src, options = { verbose: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        const header = (0, readYamlFile_js_1.default)(path_1.default.join(src, 'header.yaml'));
        const collections = (0, readYamlFiles_js_1.default)(path_1.default.join(src, 'collections'));
        const fields = (0, readYamlFiles_js_1.default)(path_1.default.join(src, 'fields'));
        const relations = (0, readYamlFiles_js_1.default)(path_1.default.join(src, 'relations'));
        const schema = Object.assign({}, header, {
            collections: collections,
            fields: fields,
            relations: relations,
        });
        if (options.verbose) {
            console.info('Applying schema...');
        }
        // Use REST API directly for schema operations
        const diffUrl = new URL('/schema/diff?force=true', createDirectusClient_js_1.directusUrl).toString();
        const applyUrl = new URL('/schema/apply?force=true', createDirectusClient_js_1.directusUrl).toString();
        // First, try schema/diff
        const diffResponse = await fetch(diffUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
            },
            body: JSON.stringify(schema),
        });
        if (!diffResponse.ok) {
            const errorText = await diffResponse.text();
            console.error('Schema diff error:', diffResponse.status, errorText);
            process.exit(1);
        }
        let diffData;
        const responseText = await diffResponse.text();
        // Handle 204 No Content (schema already matches)
        if (diffResponse.status === 204 || !responseText.trim()) {
            if (options.verbose) {
                console.info('No schema differences. Done.');
            }
            return;
        }
        try {
            diffData = JSON.parse(responseText);
        }
        catch (e) {
            console.error('Failed to parse schema diff response:', e.message);
            console.error('Response status:', diffResponse.status);
            console.error('Response body:', responseText.substring(0, 500));
            process.exit(1);
        }
        const diff = diffData.data;
        // If no differences, exit early
        if (!diff) {
            if (options.verbose) {
                console.info('No schema differences. Done.');
            }
            return;
        }
        if (options.verbose) {
            console.info('Schema differences found. Applying...');
        }
        const applyResponse = await fetch(applyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}`,
            },
            body: JSON.stringify(diff),
        });
        if (!applyResponse.ok) {
            const errorText = await applyResponse.text();
            console.error('Schema apply error:', applyResponse.status, errorText);
            process.exit(1);
        }
        // Handle 204 No Content for apply as well
        const applyText = await applyResponse.text();
        if (applyResponse.status !== 204 && applyText.trim()) {
            try {
                const applyData = JSON.parse(applyText);
                if (options.verbose) {
                    console.info('Schema apply response:', applyData);
                }
            }
            catch (e) {
                // Non-JSON response is OK
            }
        }
        if (options.verbose) {
            console.info('Schema imported.');
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = importSchema;
//# sourceMappingURL=importSchema.js.map