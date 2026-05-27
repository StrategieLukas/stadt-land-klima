"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAuth = checkAuth;
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
const sdk_1 = require("@directus/sdk");
async function checkAuth() {
    try {
        const directus = (0, createDirectusClient_js_1.default)();
        await directus.request((0, sdk_1.readMe)());
        console.log('\x1b[32m%s\x1b[0m', 'Success!');
    }
    catch (error) {
        console.log(error);
        process.exit(1);
    }
}
//# sourceMappingURL=checkAuth.js.map