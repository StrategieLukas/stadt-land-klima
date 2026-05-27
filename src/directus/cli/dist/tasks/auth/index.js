"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = index;
const setToken_js_1 = require("./setToken.js");
const checkAuth_js_1 = require("./checkAuth.js");
const setFrontendToken_js_1 = require("./setFrontendToken.js");
function index(yargs) {
    return yargs
        .command('auth:set-token', 'Generate a new static token and set it in Directus and .env', async () => await (0, setToken_js_1.setStaticToken)())
        .command('auth:test', 'Test if this tool can authenticate with Directus', async () => await (0, checkAuth_js_1.checkAuth)())
        .command('auth:set-frontend-token', 'Create a user with role frontend and with token: frontend-dev-token that is configured in the frontends .env file', async () => await (0, setFrontendToken_js_1.setFrontendToken)());
}
//# sourceMappingURL=index.js.map