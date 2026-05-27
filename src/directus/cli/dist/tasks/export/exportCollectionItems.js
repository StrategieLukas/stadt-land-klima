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
async function exportCollectionItems(collection, dest, options = { verbose: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        const items = await client.request((0, sdk_1.readItems)(collection, { limit: -1 }));
        fse_1.default.mkdirSync(dest);
        const destPath = path_1.default.join(dest, (0, slugify_1.default)(collection, { replacement: '_', lower: false }) + '.yaml');
        if (!options.overwrite && fse_1.default.existsSync(destPath)) {
            if (options.verbose) {
                console.info(`File ${destPath} already exists.`);
            }
            return;
        }
        fse_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(items), { encoding: 'utf8' });
        if (options.verbose) {
            console.info(`Exported ${collection} items to ${destPath}`);
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = exportCollectionItems;
//# sourceMappingURL=exportCollectionItems.js.map