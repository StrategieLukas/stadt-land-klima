"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const find_js_1 = __importDefault(require("lodash/find.js"));
const property_js_1 = __importDefault(require("lodash/property.js"));
const assign_js_1 = __importDefault(require("lodash/assign.js"));
const sdk_1 = require("@directus/sdk");
const createDirectusClient_js_1 = __importDefault(require("../shared/createDirectusClient.js"));
const readYamlFiles_js_1 = __importDefault(require("../shared/readYamlFiles.js"));
async function importFlows(src, options = { verbose: false, overwrite: false }) {
    const client = (0, createDirectusClient_js_1.default)();
    try {
        const existingFlows = await client.request((0, sdk_1.readFlows)({ limit: -1 }));
        const existingOperations = await client.request((0, sdk_1.readOperations)({ limit: -1 }));
        const flows = (0, readYamlFiles_js_1.default)(path_1.default.join(src));
        let operations = [];
        const flowsToCreate = [];
        const flowsToUpdate = [];
        const operationsToCreate = [];
        const operationsToUpdate = [];
        // create lookup tables for existing operations and flows
        const existingFlowsByName = {};
        const existingOperationsByKey = {};
        const existingOperationsById = {};
        existingFlows.forEach((flow) => {
            existingFlowsByName[flow.name] = flow;
        });
        existingOperations.forEach((operation) => {
            existingOperationsByKey[operation.key] = operation;
            existingOperationsById[operation.id] = operation;
        });
        flows.forEach((flow) => {
            const existingFlow = (0, find_js_1.default)(existingFlows, ['name', flow.name]);
            const flowOperations = flow.operations || [];
            operations = operations.concat(flowOperations);
            delete flow.operations;
            if (existingFlow) {
                flow.id = existingFlow.id;
                flowsToUpdate.push(flow);
            }
            else {
                flowsToCreate.push(flow);
            }
            flowOperations.forEach((operation) => {
                operation.flow_name = flow.name;
                if (existingOperationsByKey[operation.key]) {
                    operation.id = existingOperationsByKey[operation.key].id;
                    operationsToUpdate.push(operation);
                }
                else {
                    operationsToCreate.push(operation);
                }
            });
        });
        // Flows
        if (flowsToCreate.length) {
            if (options.verbose) {
                console.info(`Creating ${flowsToCreate.length} flows`);
            }
            const createdFlows = await client.request((0, sdk_1.createFlows)(flowsToCreate));
            createdFlows.forEach((createdFlow) => {
                const flow = (0, find_js_1.default)(flowsToCreate, ['name', createdFlow.name]);
                if (flow) {
                    (0, assign_js_1.default)(flow, createdFlow);
                    // add to lookup for later reference
                    existingFlowsByName[flow.name] = flow;
                }
            });
        }
        if (options.overwrite && flowsToUpdate.length) {
            if (options.verbose) {
                console.info(`Updating ${flowsToUpdate.length} flows`);
            }
            flowsToUpdate.forEach(async (flow) => {
                try {
                    const updatedFlow = await client.request((0, sdk_1.updateFlow)(flow.id, flow));
                    (0, assign_js_1.default)(flow, updatedFlow);
                }
                catch (err) {
                    console.error(err, flow);
                }
                // delete non existing operations in this flow
                const existingFlowOperations = existingOperations
                    .filter((operation) => {
                    return operation.flow === flow.id;
                });
                const flowOperationsToDelete = existingFlowOperations.filter((operation) => {
                    return !(0, find_js_1.default)(operations, { flow_name: flow.name, key: operation.key });
                });
                if (options.verbose && flowOperationsToDelete.length) {
                    console.info(`Removing ${flowOperationsToDelete.length} operations from flow ${flow.name}`);
                }
                try {
                    const operationsToDeleteIds = flowOperationsToDelete
                        .map((0, property_js_1.default)('id'))
                        .filter((id) => id && id !== '');
                    if (operationsToDeleteIds.length) {
                        await client.request((0, sdk_1.deleteOperations)(operationsToDeleteIds));
                    }
                }
                catch (err) {
                    console.error(err, flow);
                }
            });
        }
        // set flow ids to operations before creating or updating them
        operations.forEach((operation) => {
            const flow = (0, find_js_1.default)(flows, ['name', operation.flow_name]);
            if (flow && flow.id) {
                operation.flow = flow.id;
            }
            if (operation.type === 'trigger' && operation.options && operation.options.flow_name) {
                const triggerFlow = existingFlowsByName[operation.options.flow_name];
                if (triggerFlow) {
                    operation.options.flow = triggerFlow.id;
                }
                delete operation.options.flow_name;
            }
        });
        // Remove
        if (options.remove) {
            const flowsToDelete = existingFlows.filter((flow) => {
                return !(0, find_js_1.default)(flows, ['name', flow.name]);
            });
            const operationsToDelete = existingOperations.filter((operation) => {
                return !(0, find_js_1.default)(operations, ['key', operation.key]);
            });
            if (operationsToDelete.length) {
                if (options.verbose) {
                    console.info(`Removing ${operationsToDelete.length} operations`);
                }
                const operationsToDeleteIds = operationsToDelete
                    .map((0, property_js_1.default)('id'))
                    .filter((id) => id && id !== '');
                if (operationsToDeleteIds.length) {
                    await client.request((0, sdk_1.deleteOperations)(operationsToDeleteIds));
                }
            }
            if (flowsToDelete.length) {
                if (options.verbose) {
                    console.info(`Removing ${flowsToDelete.length} flows`);
                }
                const flowsToDeleteIds = flowsToDelete
                    .map((0, property_js_1.default)('id'))
                    .filter((id) => id && id !== '');
                if (flowsToDeleteIds.length) {
                    await client.request((0, sdk_1.deleteFlows)(flowsToDeleteIds));
                }
            }
        }
        // Operations
        if (operationsToCreate.length) {
            if (options.verbose) {
                console.info(`Creating ${operationsToCreate.length} operations`);
            }
            const createdOperations = await client.request((0, sdk_1.createOperations)(operationsToCreate));
            createdOperations.forEach((createdOperation) => {
                const operation = (0, find_js_1.default)(operationsToCreate, ['key', createdOperation.key]);
                if (operation) {
                    (0, assign_js_1.default)(operation, createdOperation);
                }
            });
        }
        if (operationsToUpdate.length) {
            if (options.verbose) {
                console.info(`Updating ${operationsToUpdate.length} operations`);
            }
            operationsToUpdate.forEach(async (operation) => {
                const updatedOperation = await client.request((0, sdk_1.updateOperation)(operation.id, operation));
                (0, assign_js_1.default)(operation, updatedOperation);
            });
        }
        // set flow operation ids and then update the flow
        flows.forEach(async (flow) => {
            if (flow.operation_key) {
                const operation = (0, find_js_1.default)(operations, ['key', flow.operation_key]);
                if (!operation) {
                    return;
                }
                flow.operation = operation.id;
                try {
                    const updatedFlow = await client.request((0, sdk_1.updateFlow)(flow.id, {
                        operation: flow.operation,
                    }));
                    (0, assign_js_1.default)(flow, updatedFlow);
                }
                catch (err) {
                    console.error(err, flow);
                }
            }
        });
        // set resolve and reject ids to operations and then update those
        operations.forEach(async (operation) => {
            if (operation.resolve_key) {
                const resolveOperation = (0, find_js_1.default)(operations, ['key', operation.resolve_key]);
                operation.resolve = resolveOperation ? resolveOperation.id : null;
            }
            if (operation.reject_key) {
                const rejectOperation = (0, find_js_1.default)(operations, ['key', operation.reject_key]);
                operation.reject = rejectOperation ? rejectOperation.id : null;
            }
            if (operation.resolve || operation.reject) {
                try {
                    // TODO: for some reason
                    const updatedOperation = await client.request((0, sdk_1.updateOperation)(operation.id, {
                        resolve: operation.resolve,
                        reject: operation.reject,
                    }));
                    (0, assign_js_1.default)(operation, updatedOperation);
                }
                catch (err) {
                    console.error(err, operation);
                }
            }
        });
        if (options.verbose) {
            console.info('Flows imported');
        }
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
}
exports.default = importFlows;
//# sourceMappingURL=importFlows.js.map