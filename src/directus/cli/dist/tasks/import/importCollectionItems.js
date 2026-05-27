"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const find_js_1 = __importDefault(require("lodash/find.js"));
const property_js_1 = __importDefault(require("lodash/property.js"));
const sdk_1 = require("@directus/sdk");
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
const readYamlFile_js_1 = __importDefault(require("../shared/readYamlFile.js"));
async function importCollectionItems(collection, src, options = { verbose: false, remove: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        const existingItems = await client.request((0, sdk_1.readItems)(collection, { limit: -1 }));
        const items = (0, readYamlFile_js_1.default)(src);
        const itemsToCreate = [];
        const itemsToUpdate = [];
        items.forEach((item) => {
            const existingItem = (0, find_js_1.default)(existingItems, ['id', item.id]);
            if (existingItem) {
                itemsToUpdate.push(item);
            }
            else {
                itemsToCreate.push(item);
            }
        });
        if (itemsToCreate.length) {
            if (options.verbose) {
                console.info(`Creating ${itemsToCreate.length} items`);
            }
            await client.request((0, sdk_1.createItems)(collection, itemsToCreate));
        }
        if (options.overwrite && itemsToUpdate.length) {
            if (options.verbose) {
                console.info(`Updating ${itemsToUpdate.length} items`);
            }
            itemsToUpdate.forEach(async (item) => {
                try {
                    await client.request((0, sdk_1.updateItem)(collection, item.id, item));
                }
                catch (err) {
                    console.error(err, item);
                }
            });
        }
        // Remove
        if (options.remove) {
            const itemsToDelete = existingItems.filter((item) => {
                return !(0, find_js_1.default)(items, ['id', item.id]);
            });
            if (itemsToDelete.length) {
                if (options.verbose) {
                    console.info(`Removing ${itemsToDelete.length} items`);
                }
                const itemsToDeleteIds = itemsToDelete
                    .map((0, property_js_1.default)('id'))
                    .filter((id) => id && id !== '');
                if (itemsToDeleteIds.length) {
                    await client.request((0, sdk_1.deleteItems)(collection, itemsToDeleteIds));
                }
            }
        }
        if (options.verbose) {
            console.info(`${collection} items imported`);
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = importCollectionItems;
//# sourceMappingURL=importCollectionItems.js.map