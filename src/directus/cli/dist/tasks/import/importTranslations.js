"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const find_js_1 = __importDefault(require("lodash/find.js"));
const property_js_1 = __importDefault(require("lodash/property.js"));
const sdk_1 = require("@directus/sdk");
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
const readYamlFiles_js_1 = __importDefault(require("../shared/readYamlFiles.js"));
async function importTranslations(src, options = { verbose: false, overwrite: false, remove: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        const existingTranslations = await client.request((0, sdk_1.readTranslations)({ limit: -1 }));
        const translations = (0, readYamlFiles_js_1.default)(path_1.default.join(src));
        const translationsToCreate = [];
        const translationsToUpdate = [];
        translations.forEach((translation) => {
            const existingTranslation = (0, find_js_1.default)(existingTranslations, { key: translation.key, language: translation.language });
            if (existingTranslation) {
                translation.id = existingTranslation.id;
                translationsToUpdate.push(translation);
            }
            else {
                translationsToCreate.push(translation);
            }
        });
        if (translationsToCreate.length) {
            if (options.verbose) {
                console.info(`Creating ${translationsToCreate.length} translations`);
            }
            await client.request((0, sdk_1.createTranslations)(translationsToCreate));
        }
        if (options.overwrite && translationsToUpdate.length) {
            if (options.verbose) {
                console.info(`Updating ${translationsToUpdate.length} translations`);
            }
            translationsToUpdate.forEach(async (translation) => {
                try {
                    await client.request((0, sdk_1.updateTranslation)(translation.id, { value: translation.value }));
                }
                catch (err) {
                    console.error(err, translation);
                }
            });
        }
        // Remove
        if (options.remove) {
            const translationsToDelete = existingTranslations.filter((translation) => {
                return !(0, find_js_1.default)(translations, { key: translation.key, language: translation.language });
            });
            if (translationsToDelete.length) {
                if (options.verbose) {
                    console.info(`Removing ${translationsToDelete.length} translations`);
                }
                const translationsToDeleteIds = translationsToDelete
                    .map((0, property_js_1.default)('id'))
                    .filter((id) => id && id !== '');
                if (translationsToDeleteIds.length) {
                    await client.request((0, sdk_1.deleteTranslations)(translationsToDeleteIds));
                }
            }
        }
        if (options.verbose) {
            console.info('Translations imported');
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = importTranslations;
//# sourceMappingURL=importTranslations.js.map