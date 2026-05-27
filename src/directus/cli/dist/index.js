#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const index_js_1 = __importDefault(require("./tasks/export/index.js"));
const index_js_2 = __importDefault(require("./tasks/import/index.js"));
const index_js_3 = __importDefault(require("./tasks/special/index.js"));
const index_js_4 = __importDefault(require("./tasks/auth/index.js"));
const _yargs = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv));
_yargs.strict();
(0, index_js_1.default)(_yargs);
(0, index_js_2.default)(_yargs);
(0, index_js_3.default)(_yargs);
(0, index_js_4.default)(_yargs);
_yargs.parse();
_yargs.completion();
//# sourceMappingURL=index.js.map