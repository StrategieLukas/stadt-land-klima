"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fse_1 = __importDefault(require("fse"));
const yaml_1 = require("yaml");
// Substitute ${VAR_NAME} placeholders with process.env values before parsing.
// Unset variables are left as-is (no substitution) to avoid breaking unrelated YAML.
function substituteEnvVars(content) {
    return content.replace(/\$\{([A-Z0-9_]+)\}/g, (match, name) => process.env[name] !== undefined ? process.env[name] : match);
}
function readYamlFile(filepath) {
    const raw = fse_1.default.readFileSync(filepath, { encoding: 'utf8' });
    return (0, yaml_1.parse)(substituteEnvVars(raw));
}
exports.default = readYamlFile;
//# sourceMappingURL=readYamlFile.js.map