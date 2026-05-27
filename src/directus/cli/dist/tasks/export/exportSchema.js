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
async function exportSchema(dest, options = { verbose: false, remove: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        const snapshot = await client.request((0, sdk_1.schemaSnapshot)());
        const header = {
            version: snapshot.version,
            directus: snapshot.directus,
            vendor: snapshot.vendor,
        };
        const collections = (snapshot.collections || []).sort((a, b) => a.collection.localeCompare(b.collection));
        const fields = (snapshot.fields || []).sort((a, b) => {
            if (a.collection === b.collection)
                return a.field.localeCompare(b.field);
            return a.collection.localeCompare(b.collection);
        });
        const relations = (snapshot.relations || []).sort((a, b) => {
            if (a.related_collection === b.related_collection) {
                if (a.collection === b.collection) {
                    return (a.field || '').localeCompare(b.field || '');
                }
                return a.collection.localeCompare(b.collection);
            }
            return a.related_collection.localeCompare(b.related_collection);
        });
        fse_1.default.mkdirSync(dest, { recursive: true });
        fse_1.default.mkdirSync(path_1.default.join(dest, 'collections'), { recursive: true });
        fse_1.default.mkdirSync(path_1.default.join(dest, 'fields'), { recursive: true });
        fse_1.default.mkdirSync(path_1.default.join(dest, 'relations'), { recursive: true });
        fse_1.default.writeFileSync(path_1.default.join(dest, 'header.yaml'), (0, yaml_1.stringify)(header), { encoding: 'utf8' });
        let exportedCollections = 0;
        let exportedFields = 0;
        let exportedRelations = 0;
        collections.forEach((collection) => {
            const destPath = path_1.default.join(dest, 'collections', collection.collection + '.yaml');
            fse_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(collection), { encoding: 'utf8' });
            exportedCollections++;
            if (options.verbose)
                console.info(`Exported collection ${destPath}`);
        });
        fields.forEach((field) => {
            const fieldDir = path_1.default.join(dest, 'fields', field.collection);
            fse_1.default.mkdirSync(fieldDir, { recursive: true });
            const destPath = path_1.default.join(fieldDir, field.field + '.yaml');
            fse_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(field), { encoding: 'utf8' });
            exportedFields++;
            if (options.verbose)
                console.info(`Exported field ${destPath}`);
        });
        relations.forEach((relation) => {
            const destPath = path_1.default.join(dest, 'relations', relation.related_collection +
                '.' +
                relation.collection +
                '.' +
                relation.field +
                '.yaml');
            fse_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(relation), { encoding: 'utf8' });
            exportedRelations++;
            if (options.verbose)
                console.info(`Exported relation ${destPath}`);
        });
        if (options.verbose) {
            console.info(`Schema exported: ${exportedCollections} collections, ${exportedFields} fields, ${exportedRelations} relations`);
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = exportSchema;
//# sourceMappingURL=exportSchema.js.map