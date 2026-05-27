"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFrontendToken = setFrontendToken;
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
const sdk_1 = require("@directus/sdk");
async function setFrontendToken() {
    try {
        const directus = (0, createDirectusClient_js_1.default)();
        console.log("Fetching the frontend role...");
        const roles = (await directus.request((0, sdk_1.readRoles)({
            filter: {
                name: {
                    _eq: 'frontend',
                },
            },
        })));
        if (roles.length !== 1) {
            console.error("Could not uniquely identify the frontend role. You probably have to run import:roles first.");
            process.exit(1);
        }
        console.log("Creating the frontend user...");
        await directus.request((0, sdk_1.createUser)({
            first_name: 'Frontend',
            email: 'frontend@example.com',
            token: 'frontend-dev-token',
            role: roles[0].id
        }));
        console.log('\x1b[32m%s\x1b[0m', 'Success!');
    }
    catch (error) {
        console.log(error);
        process.exit(1);
    }
}
//# sourceMappingURL=setFrontendToken.js.map