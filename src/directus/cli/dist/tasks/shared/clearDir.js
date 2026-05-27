"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fse_1 = __importDefault(require("fse"));
const path_1 = __importDefault(require("path"));
const includes_js_1 = __importDefault(require("lodash/includes.js"));
function clearDir(dir, options = { extensions: null }) {
    if (!fse_1.default.existsSync(dir) || !fse_1.default.statSync(dir).isDirectory()) {
        return;
    }
    fse_1.default.readdirSync(dir)
        .forEach((filename) => {
        if (filename !== '.' && filename !== '..') {
            const fullPath = path_1.default.join(dir, filename);
            if (fse_1.default.statSync(fullPath).isDirectory()) {
                clearDir(fullPath, options);
                if (fse_1.default.readdirSync(fullPath).length === 0) {
                    fse_1.default.rmdirSync(fullPath);
                }
            }
            else {
                const extension = path_1.default.extname(filename);
                if (options.extensions && options.extensions.length) {
                    if ((0, includes_js_1.default)(options.extensions, extension)) {
                        fse_1.default.unlinkSync(fullPath);
                    }
                }
                else {
                    fse_1.default.unlinkSync(fullPath);
                }
            }
        }
    });
}
exports.default = clearDir;
//# sourceMappingURL=clearDir.js.map