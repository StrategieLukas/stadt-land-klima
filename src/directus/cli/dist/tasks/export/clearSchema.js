"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fse_1 = __importDefault(require("fse"));
const path_1 = __importDefault(require("path"));
const clearDir_js_1 = __importDefault(require("../shared/clearDir.js"));
const clerDirOpts = { extensions: ['.yaml'] };
async function clearSchema(dest, options = { verbose: false }) {
    try {
        if (fse_1.default.existsSync(path_1.default.join(dest, 'header.yaml'))) {
            fse_1.default.unlinkSync(path_1.default.join(dest, 'header.yaml'));
        }
        (0, clearDir_js_1.default)(path_1.default.join(dest, 'collections'), clerDirOpts);
        (0, clearDir_js_1.default)(path_1.default.join(dest, 'fields'), clerDirOpts);
        (0, clearDir_js_1.default)(path_1.default.join(dest, 'relations'), clerDirOpts);
        if (options.verbose) {
            console.info(`${dest} cleared`);
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = clearSchema;
//# sourceMappingURL=clearSchema.js.map