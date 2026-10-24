import {
  createFlow,
  createOperation,
  deleteFlows,
  deleteOperations,
  readFlows,
  readOperations,
  updateFlow,
  updateOperation,
} from "@directus/sdk";
import createDirectusClient from "../shared/createDirectusClient.ts";
import type { Flow, TaskOptions } from "../shared/models.ts";
import { ApiFlowSchema, FlowSchema, OperationSchema, requiredId } from "../shared/models.ts";
import readYamlFiles from "../shared/readYamlFiles.ts";

export default async function importFlows(src: string, options: TaskOptions = {}) {
  // Validate every document/reference before making the first write.
  const flows = readYamlFiles(src, FlowSchema);
  const names = new Set<string>();
  for (const flow of flows) {
    if (names.has(flow.name)) throw new Error(`Duplicate flow name: ${flow.name}`);
    names.add(flow.name);
    const keys = new Set<string>();
    for (const operation of flow.operations ?? []) {
      if (keys.has(operation.key)) throw new Error(`Duplicate operation key in ${flow.name}: ${operation.key}`);
      keys.add(operation.key);
    }
    for (const key of [
      flow.operation_key,
      ...(flow.operations ?? []).flatMap((op) => [op.resolve_key, op.reject_key]),
    ]) {
      if (key && !keys.has(key)) throw new Error(`Unknown operation reference in ${flow.name}: ${key}`);
    }
  }
  const client = createDirectusClient();
  const existingFlows = ApiFlowSchema.array().parse(await client.request(readFlows({ limit: -1 })));
  const existingOperations = OperationSchema.array().parse(await client.request(readOperations({ limit: -1 })));
  const flowIds = new Map(existingFlows.map((flow) => [flow.name, requiredId(flow.id)]));
  for (const flow of flows) {
    for (const op of flow.operations ?? []) {
      const name = op.options?.flow_name;
      if (name !== undefined && (typeof name !== "string" || (!names.has(name) && !flowIds.has(name)))) {
        throw new Error(`Unknown trigger flow reference in ${flow.name}`);
      }
    }
  }
  const managed: Flow[] = [];
  // Persist flow IDs before operations can refer to another newly created flow.
  for (const flow of flows) {
    const existingId = flowIds.get(flow.name);
    if (existingId && !options.overwrite) continue;
    const { id, operations, operation_key, operation, ...payload } = flow;
    const saved = existingId
      ? await client.request(updateFlow(existingId, payload))
      : await client.request(createFlow(payload));
    flow.id = requiredId(saved.id);
    flowIds.set(flow.name, flow.id);
    managed.push(flow);
  }
  for (const flow of managed) {
    const flowId = requiredId(flow.id);
    const current = existingOperations.filter((op) => op.flow === flowId);
    const currentByKey = new Map(current.map((op) => [op.key, op]));
    const operationIds = new Map<string, string>();
    const operations = flow.operations ?? [];
    for (const op of operations) {
      const { id, flow_name, resolve_key, reject_key, resolve, reject, ...payload } = op;
      payload.flow = flowId;
      if (op.type === "trigger" && payload.options?.flow_name) {
        const targetName = payload.options.flow_name;
        if (typeof targetName !== "string") throw new Error("Invalid trigger flow name");
        const { flow_name: omitted, ...triggerOptions } = payload.options;
        payload.options = {
          ...triggerOptions,
          flow: requiredId(flowIds.get(targetName)),
        };
      }
      const currentOp = currentByKey.get(op.key);
      const saved = currentOp
        ? await client.request(updateOperation(requiredId(currentOp.id), payload))
        : await client.request(createOperation(payload));
      operationIds.set(op.key, requiredId(saved.id));
    }
    // All writes above are awaited before wiring roots/edges. Omitted edges clear old links.
    for (const op of operations) {
      await client.request(
        updateOperation(requiredId(operationIds.get(op.key)), {
          resolve: op.resolve_key ? requiredId(operationIds.get(op.resolve_key)) : null,
          reject: op.reject_key ? requiredId(operationIds.get(op.reject_key)) : null,
        }),
      );
    }
    await client.request(
      updateFlow(flowId, {
        operation: flow.operation_key ? requiredId(operationIds.get(flow.operation_key)) : null,
      }),
    );
    const obsolete = current.filter((op) => !operationIds.has(op.key)).map((op) => requiredId(op.id));
    if (obsolete.length) await client.request(deleteOperations(obsolete));
  }
  if (options.remove) {
    const obsolete = existingFlows.filter((flow) => !names.has(flow.name)).map((flow) => requiredId(flow.id));
    const obsoleteOperations = existingOperations
      .filter((op) => op.flow && obsolete.includes(op.flow))
      .map((op) => requiredId(op.id));
    if (obsoleteOperations.length) await client.request(deleteOperations(obsoleteOperations));
    if (obsolete.length) await client.request(deleteFlows(obsolete));
  }
  if (options.verbose) console.info("Flows imported");
}
