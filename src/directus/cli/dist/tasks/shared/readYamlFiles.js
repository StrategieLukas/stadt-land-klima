"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fse_1 = __importDefault(require("fse"));
const path_1 = __importDefault(require("path"));
const yaml_1 = require("yaml");
// Substitute ${VAR_NAME} placeholders with process.env values before parsing.
// Unset variables are left as-is (no substitution) to avoid breaking unrelated YAML.
function substituteEnvVars(content) {
    return content.replace(/\$\{([A-Z0-9_]+)\}/g, (match, name) => process.env[name] !== undefined ? process.env[name] : match);
}
function readYamlFiles(dir) {
    const yamls = [];
    if (!fse_1.default.existsSync(dir) || !fse_1.default.statSync(dir).isDirectory()) {
        return yamls;
    }
    fse_1.default.readdirSync(dir)
        .forEach((filename) => {
        const fullPath = path_1.default.join(dir, filename);
        if (fse_1.default.statSync(fullPath).isDirectory()) {
            yamls.push(...readYamlFiles(fullPath));
        }
        else if (path_1.default.extname(filename).toLowerCase() === '.yaml') {
            const raw = fse_1.default.readFileSync(fullPath, { encoding: 'utf8' });
            const yaml = (0, yaml_1.parse)(substituteEnvVars(raw));
            yamls.push(yaml);
        }
    });
    return yamls;
}
exports.default = readYamlFiles;
//# sourceMappingURL=readYamlFiles.js.map