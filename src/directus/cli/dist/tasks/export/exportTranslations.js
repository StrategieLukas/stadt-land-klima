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
async function exportTranslations(dest, options = { verbose: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        const translations = await client.request((0, sdk_1.readTranslations)({ limit: -1 }));
        fse_1.default.mkdirSync(dest);
        translations.forEach((translation) => {
            const destPath = path_1.default.join(dest, (0, slugify_1.default)(translation.key, { replacement: '_', lower: false }) + '.' + translation.language + '.yaml');
            if (!options.overwrite && fse_1.default.existsSync(destPath)) {
                if (options.verbose) {
                    console.info(`File ${destPath} already exists.`);
                }
                return;
            }
            delete translation.id;
            fse_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(translation), { encoding: 'utf8' });
            if (options.verbose) {
                console.info(`Exported translation ${destPath}`);
            }
        });
        if (options.verbose) {
            console.info('All translations exported.');
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = exportTranslations;
//# sourceMappingURL=exportTranslations.js.map