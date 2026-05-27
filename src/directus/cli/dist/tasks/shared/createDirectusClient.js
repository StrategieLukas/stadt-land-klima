"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.directusUrl = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const sdk_1 = require("@directus/sdk");
dotenv_1.default.config();
exports.directusUrl = process.env.FRONTEND_DIRECTUS_URL || 'http://directus:8055';
const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;
function createDirectusClient() {
    if (!token) {
        console.error('You must provide a CLI_DIRECTUS_STATIC_TOKEN');
        process.exit(1);
    }
    return (0, sdk_1.createDirectus)(exports.directusUrl).with((0, sdk_1.rest)()).with((0, sdk_1.staticToken)(token));
}
exports.default = createDirectusClient;
//# sourceMappingURL=createDirectusClient.js.map