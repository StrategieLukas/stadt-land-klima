"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setStaticToken = setStaticToken;
const sdk_1 = require("@directus/sdk");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const createDirectusClient_js_1 = require("../shared/createDirectusClient.js");
const envFile = '.env';
async function setStaticToken() {
    try {
        dotenv_1.default.config({ path: envFile });
        const directus = (0, sdk_1.createDirectus)(createDirectusClient_js_1.directusUrl).with((0, sdk_1.authentication)()).with((0, sdk_1.rest)());
        console.log("Logging in with admin credentials to get temporary access token...");
        await directus.login({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
        console.log("Generating static token...");
        const newToken = crypto_1.default.randomBytes(24).toString('hex').slice(0, 32);
        console.log("Setting static token in Directus...");
        await directus.request((0, sdk_1.updateMe)({ token: newToken }));
        console.log("Setting static token in .env ...");
        let envContent = fs_1.default.readFileSync(envFile, 'utf8');
        envContent = envContent.replace(/CLI_DIRECTUS_STATIC_TOKEN=.*/, `CLI_DIRECTUS_STATIC_TOKEN=${newToken}`);
        fs_1.default.writeFileSync(envFile, envContent);
        console.log("Testing static token...");
        dotenv_1.default.config({ path: envFile, override: true });
        await (0, sdk_1.createDirectus)(createDirectusClient_js_1.directusUrl)
            .with((0, sdk_1.staticToken)(process.env.CLI_DIRECTUS_STATIC_TOKEN))
            .with((0, sdk_1.rest)())
            .request((0, sdk_1.readMe)());
    }
    catch (error) {
        console.log(error);
        process.exit(1);
    }
    console.log('\x1b[32m%s\x1b[0m', 'Success! Please run:');
    console.log('\x1b[32m%s\x1b[0m', '    source .env');
    process.exit(0);
}
//# sourceMappingURL=setToken.js.map