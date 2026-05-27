"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const createDirectusClient_js_1 = __importDefault(require("./createDirectusClient.js"));
const sdk_1 = require("@directus/sdk");
async function clearDirectusCache(options = { verbose: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        if (options.verbose) {
            console.info('Clearing cache');
        }
        await client.request((0, sdk_1.clearCache)());
    }
    catch (err) {
        console.error(err);
    }
}
exports.default = clearDirectusCache;
//# sourceMappingURL=clearDirectusCache.js.map