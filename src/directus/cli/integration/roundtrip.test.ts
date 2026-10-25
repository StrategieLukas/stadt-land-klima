import {
  deleteDashboard,
  deleteFlow,
  deletePanels,
  readDashboards,
  readFlows,
  readOperations,
  readPanels,
} from "@directus/sdk";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";
import createDirectusClient from "../tasks/shared/createDirectusClient.ts";
import { RecordSchema, relationId, requiredId } from "../tasks/shared/models.ts";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../index.mjs", import.meta.url));
const sorted = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
async function command(...args: string[]) {
  await execute(process.execPath, [cli, ...args], { env: process.env });
}

test("live inactive flow imports preserve operation IDs, wire edges and overwrite roots without changing other flows", async () => {
  const client = createDirectusClient();
  const previousFlows = await client.request(readFlows({ limit: -1 }));
  const previousOperations = await client.request(readOperations({ limit: -1 }));
  const name = `cli-types-${randomUUID()}`;
  const source = mkdtempSync(join(tmpdir(), "slk-flow-roundtrip-"));
  const initial = {
    name,
    status: "inactive",
    trigger: "manual",
    operation_key: "start",
    operations: [
      {
        key: "start",
        type: "log",
        position_x: 0,
        position_y: 0,
        resolve_key: "end",
        options: { message: "CLI fixture" },
      },
      {
        key: "end",
        type: "log",
        position_x: 0,
        position_y: 0,
        options: { message: "CLI fixture" },
      },
    ],
  };
  try {
    writeFileSync(join(source, "fixture.yaml"), stringify(initial));
    await command("import:flows", source, "--force");
    const flows = await client.request(readFlows({ filter: { name: { _eq: name } }, limit: -1 }));
    assert.equal(flows.length, 1);
    const id = requiredId(flows[0]?.id);
    const operations = await client.request(readOperations({ filter: { flow: { _eq: id } }, limit: -1 }));
    assert.equal(operations.length, 2);
    const start = operations.find((op) => op.key === "start");
    const end = operations.find((op) => op.key === "end");
    assert.ok(start && end);
    assert.equal(relationId(flows[0]?.operation), start.id);
    assert.equal(relationId(start.resolve), end.id);
    writeFileSync(
      join(source, "fixture.yaml"),
      stringify({
        ...initial,
        operation_key: "end",
        operations: [
          {
            key: "end",
            type: "log",
            position_x: 0,
            position_y: 0,
            options: { message: "Updated fixture" },
          },
        ],
      }),
    );
    await command("import:flows", source);
    assert.equal(
      (await client.request(readOperations({ filter: { flow: { _eq: id } }, limit: -1 }))).length,
      2,
      "without force, preserve the existing flow",
    );
    await command("import:flows", source, "--force");
    const updated = await client.request(readOperations({ filter: { flow: { _eq: id } }, limit: -1 }));
    assert.equal(updated.length, 1);
    assert.equal(updated[0]?.id, end.id);
    assert.equal(relationId(updated[0]?.resolve), null);
    assert.equal(relationId(updated[0]?.reject), null);
    const saved = await client.request(readFlows({ filter: { id: { _eq: id } } }));
    assert.equal(relationId(saved[0]?.operation), end.id);
  } finally {
    const owned = await client.request(readFlows({ filter: { name: { _eq: name } }, limit: -1 }));
    for (const flow of owned) await client.request(deleteFlow(flow.id));
    rmSync(source, { recursive: true, force: true });
    assert.deepEqual(sorted(await client.request(readFlows({ limit: -1 }))), sorted(previousFlows));
    assert.deepEqual(sorted(await client.request(readOperations({ limit: -1 }))), sorted(previousOperations));
  }
});

test("live dashboard YAML imports replace panels and exported API ID arrays become portable nested YAML", async () => {
  const client = createDirectusClient();
  const previousDashboards = await client.request(readDashboards({ limit: -1 }));
  const previousPanels = await client.request(readPanels({ limit: -1 }));
  const name = `cli-types-${randomUUID()}`;
  const source = mkdtempSync(join(tmpdir(), "slk-dashboard-roundtrip-"));
  const output = mkdtempSync(join(tmpdir(), "slk-dashboard-export-"));
  const data = {
    name,
    panels: [
      {
        name: "CLI fixture",
        type: "text",
        position_x: 0,
        position_y: 0,
        width: 12,
        height: 8,
        options: { text: "CLI fixture" },
      },
    ],
  };
  try {
    writeFileSync(join(source, "fixture.yaml"), stringify(data));
    await command("import:dashboards", source, "--force");
    await command("import:dashboards", source, "--force");
    const dashboards = await client.request(readDashboards({ filter: { name: { _eq: name } }, limit: -1 }));
    assert.equal(dashboards.length, 1);
    const id = requiredId(dashboards[0]?.id);
    const panels = await client.request(readPanels({ filter: { dashboard: { _eq: id } }, limit: -1 }));
    assert.equal(panels.length, 1);
    assert.equal(panels[0]?.name, "CLI fixture");
    await command("export:dashboards", output, "--force");
    const exported = RecordSchema.parse(parse(readFileSync(join(output, `${name}.yaml`), "utf8")));
    assert.equal(exported.id, undefined);
    assert.ok(Array.isArray(exported.panels));
    const panel = RecordSchema.parse(exported.panels[0]);
    assert.equal(panel.name, "CLI fixture");
    assert.equal(panel.id, undefined);
    assert.equal(panel.dashboard, undefined);
  } finally {
    const owned = await client.request(readDashboards({ filter: { name: { _eq: name } }, limit: -1 }));
    for (const dashboard of owned) {
      const panels = await client.request(readPanels({ filter: { dashboard: { _eq: dashboard.id } }, limit: -1 }));
      if (panels.length) await client.request(deletePanels(panels.map((panel) => panel.id)));
      await client.request(deleteDashboard(dashboard.id));
    }
    rmSync(source, { recursive: true, force: true });
    rmSync(output, { recursive: true, force: true });
    assert.deepEqual(sorted(await client.request(readDashboards({ limit: -1 }))), sorted(previousDashboards));
    assert.deepEqual(sorted(await client.request(readPanels({ limit: -1 }))), sorted(previousPanels));
  }
});
