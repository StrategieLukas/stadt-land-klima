"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fse_1 = __importDefault(require("fse"));
const path_1 = __importDefault(require("path"));
const yaml_1 = require("yaml");
const sdk_1 = require("@directus/sdk");
const slugify_1 = __importDefault(require("slugify"));
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
async function exportFlows(dest, options = { verbose: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        const flows = await client.request((0, sdk_1.readFlows)({ limit: -1 }));
        const operations = await client.request((0, sdk_1.readOperations)({ limit: -1 }));
        // create lookup tables for operations and flows
        const flowsById = {};
        const operationsByKey = {};
        const operationsById = {};
        flows.forEach((flow) => {
            flowsById[flow.id] = flow;
        });
        operations.forEach((operation) => {
            operationsByKey[operation.key] = operation;
            operationsById[operation.id] = operation;
        });
        fse_1.default.mkdirSync(dest);
        flows.forEach((flow) => {
            const destPath = path_1.default.join(dest, (0, slugify_1.default)(flow.name, { replacement: '_', lower: false }) + '.yaml');
            if (!options.overwrite && fse_1.default.existsSync(destPath)) {
                if (options.verbose) {
                    console.info(`File ${destPath} already exists.`);
                }
                return;
            }
            flow.operations = operations
                .filter((operation) => {
                return operation.flow === flow.id;
            })
                .map((operation) => {
                delete operation.flow;
                delete operation.id;
                delete operation.user_created;
                delete operation.date_created;
                if (operation.resolve && operationsById[operation.resolve]) {
                    operation.resolve_key = operationsById[operation.resolve].key;
                }
                if (operation.reject && operationsById[operation.reject]) {
                    operation.reject_key = operationsById[operation.reject].key;
                }
                if (operation.type === 'trigger' && operation.options && operation.options.flow) {
                    operation.options.flow_name = flowsById[operation.options.flow].name;
                    delete operation.options.flow;
                }
                delete operation.resolve;
                delete operation.reject;
                return operation;
            });
            delete flow.id;
            delete flow.date_created;
            delete flow.user_created;
            if (flow.operation && operationsById[flow.operation]) {
                flow.operation_key = operationsById[flow.operation].key;
            }
            delete flow.operation;
            fse_1.default.writeFileSync(destPath, (0, yaml_1.stringify)(flow), { encoding: 'utf8' });
            if (options.verbose) {
                console.info(`Exported flow ${destPath}`);
            }
        });
        if (options.verbose) {
            console.info('All flows exported.');
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = exportFlows;
//# sourceMappingURL=exportFlows.js.map