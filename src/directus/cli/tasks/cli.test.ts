import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import type { ZodType } from "zod";
import { provisionServiceUsers } from "./provisionServiceUsers.ts";
import {
  DashboardSchema,
  FlowSchema,
  PolicySchema,
  PresetSchema,
  RecordSchema,
  RoleSchema,
  TranslationSchema,
} from "./shared/models.ts";
import readYamlFiles from "./shared/readYamlFiles.ts";

type Call = {
  method: string;
  path: string;
  url: URL;
  body: Record<string, unknown>;
  rows: Record<string, unknown>[];
};
type Reply = {
  status?: number;
  data?: unknown;
  errors?: { message: string }[];
};
let requests: Call[] = [];
let handle: (call: Call) => Reply | Promise<Reply> = () => ({ data: [] });
const directory = mkdtempSync(join(tmpdir(), "slk-cli-regression-"));
const root = fileURLToPath(new URL("../", import.meta.url));
const server = createServer(async (request, response) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const text = Buffer.concat(chunks).toString();
    const url = new URL(request.url ?? "/", "http://fixture");
    const payload: unknown = text ? JSON.parse(text) : {};
    const call = {
      method: request.method ?? "GET",
      path: url.pathname,
      url,
      body: Array.isArray(payload) ? {} : RecordSchema.parse(payload),
      rows: Array.isArray(payload) ? RecordSchema.array().parse(payload) : [],
    };
    requests.push(call);
    const result = call.path === "/utils/cache/clear" ? { status: 204 } : await handle(call);
    response.writeHead(result.status ?? 200, result.status === 204 ? {} : { "content-type": "application/json" });
    response.end(result.status === 204 ? undefined : JSON.stringify(result));
  } catch (error) {
    response.writeHead(500);
    response.end(JSON.stringify({ errors: [{ message: String(error) }] }));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Missing test server");
const url = `http://127.0.0.1:${address.port}`;
const environment = {
  ...process.env,
  FRONTEND_DIRECTUS_URL: url,
  CLI_DIRECTUS_STATIC_TOKEN: "fixture-token",
  DIRECTUS_URL: url,
  DB_HOST: "",
  DB_DATABASE: "",
  DB_USER: "",
  DB_PASSWORD: "",
  SLK_ENV: "test",
  DIRECTUS_SCHEMA_IMPORT_MAX_ATTEMPTS: "2",
  DIRECTUS_SCHEMA_IMPORT_APPLY_DELAY_MS: "0",
  DIRECTUS_SCHEMA_IMPORT_RETRY_DELAY_MS: "1",
  DIRECTUS_SCHEMA_IMPORT_MAX_RETRY_DELAY_MS: "1",
};
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
});

async function command(...args: string[]) {
  const child = spawn(process.execPath, [join(root, "index.mjs"), ...args], {
    cwd: directory,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
}
function yaml(name: string, data: unknown) {
  const file = join(directory, name);
  writeFileSync(file, stringify(data));
  return file;
}
function folder(name: string) {
  const path = join(directory, name);
  mkdirSync(path, { recursive: true });
  return path;
}
function reset(handler: typeof handle) {
  requests = [];
  handle = handler;
}

test("historical executable supports help, completion, authentication and nonzero command failures", async () => {
  reset(() => ({ data: { id: "fixture-user" } }));
  const help = await command("--help");
  assert.equal(help.code, 0, help.output);
  for (const name of ["import:all", "export:all", "auth:test", "migrate", "completion"])
    assert.ok(help.output.includes(name));
  assert.equal(requests.length, 0);
  const completion = await command("completion");
  assert.equal(completion.code, 0, completion.output);
  assert.doesNotMatch(completion.output, /injected env/);
  const auth = await command("auth:test");
  assert.equal(auth.code, 0, auth.output);
  assert.ok(requests.some((call) => call.path === "/users/me"));
  assert.notEqual((await command("unknown-command")).code, 0);
});

test("item import reads all existing records, awaits updates, preserves fields and removes only orphans", async () => {
  let updated = false;
  reset(async (call) => {
    if (call.method === "GET") {
      assert.equal(call.url.searchParams.get("limit"), "-1");
      return {
        data: Array.from({ length: 151 }, (_, id) => ({
          id,
          title: `Old ${id}`,
        })),
      };
    }
    if (call.method === "PATCH") {
      await new Promise((resolve) => setTimeout(resolve, 25));
      updated = true;
      assert.equal(call.body.title, "Updated last record");
    }
    if (call.method === "DELETE") {
      assert.ok(updated, "deletion must wait for updates");
      const query = RecordSchema.parse(call.body.query);
      const ids = RecordSchema.parse(RecordSchema.parse(query.filter).id)._in;
      assert.ok(Array.isArray(ids));
      assert.ok(ids.includes(0), "zero is a valid primary key");
      assert.ok(!ids.includes(150), "retain the updated record");
    }
    return { data: { id: 150 } };
  });
  const result = await command(
    "import:items",
    "fixture_items",
    yaml("items.yaml", [{ id: 150, title: "Updated last record" }]),
    "--force",
    "--remove-orphans",
  );
  assert.equal(result.code, 0, result.output);
  assert.ok(updated);
  assert.equal(requests.filter((call) => call.path === "/items/fixture_items" && call.method === "POST").length, 0);
});

test("malformed item YAML and failed writes stop imports before any orphan deletion", async () => {
  reset((call) =>
    call.method === "PATCH" ? { status: 500, errors: [{ message: "fixture update failed" }] } : { data: [{ id: 1 }] },
  );
  const bad = await command(
    "import:items",
    "fixture_items",
    yaml("malformed.yaml", { id: 1 }),
    "--force",
    "--remove-orphans",
  );
  assert.notEqual(bad.code, 0);
  assert.equal(
    requests.filter((call) => ["POST", "PATCH", "DELETE"].includes(call.method) && call.path.startsWith("/items/"))
      .length,
    0,
  );
  const failed = await command(
    "import:items",
    "fixture_items",
    yaml("failed.yaml", [{ id: 1, title: "Changed" }]),
    "--force",
    "--remove-orphans",
  );
  assert.notEqual(failed.code, 0);
  assert.equal(requests.filter((call) => call.method === "DELETE").length, 0);
  assert.notEqual((await command("import:flows", join(directory, "missing-folder"), "--remove-orphans")).code, 0);
  assert.equal(requests.filter((call) => call.method === "DELETE").length, 0);
});

test("flow import scopes duplicate operation keys to their flow and awaits writes before linking edges", async () => {
  const source = folder("flows");
  for (const name of ["A", "B"])
    writeFileSync(
      join(source, name + ".yaml"),
      stringify({
        name,
        operation_key: "start",
        operations: [
          {
            key: "start",
            type: "exec",
            position_x: 0,
            position_y: 0,
            resolve_key: "end",
          },
          { key: "end", type: "exec", position_x: 0, position_y: 0 },
        ],
      }),
    );
  const creations = new Map<string, string>();
  let sequence = 0;
  reset(async (call) => {
    if (call.method === "GET") return { data: [] };
    if (call.path === "/flows") {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { data: { id: `flow-${call.body.name}` } };
    }
    if (call.path === "/operations") {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id = `op-${++sequence}`;
      creations.set(`${call.body.flow}:${call.body.key}`, id);
      return { data: { id } };
    }
    if (call.path.startsWith("/operations/")) {
      const ownFlow = [...creations].find(([, id]) => call.path.endsWith(id))?.[0].split(":")[0];
      assert.ok(ownFlow);
      if (call.body.resolve) assert.equal(call.body.resolve, creations.get(`${ownFlow}:end`));
    }
    if (call.path.startsWith("/flows/"))
      assert.equal(call.body.operation, creations.get(`${call.path.split("/").pop()}:start`));
    return { data: { id: call.path.split("/").pop() } };
  });
  const result = await command("import:flows", source, "--force");
  assert.equal(result.code, 0, result.output);
  assert.equal(creations.size, 4);
});

test("flow overwrite clears stale edges; malformed references and failed updates are never successful imports", async () => {
  const source = folder("updated-flow");
  writeFileSync(
    join(source, "flow.yaml"),
    stringify({
      name: "A",
      operation_key: "start",
      operations: [{ key: "start", type: "exec", position_x: 0, position_y: 0 }],
    }),
  );
  reset((call) => {
    if (call.method === "GET")
      return {
        data:
          call.path === "/flows"
            ? [{ id: "flow-A", name: "A", operations: ["op-1"] }]
            : [
                {
                  id: "op-1",
                  key: "start",
                  type: "exec",
                  position_x: 0,
                  position_y: 0,
                  flow: "flow-A",
                  resolve: "old",
                },
              ],
      };
    return { data: { id: call.path === "/flows/flow-A" ? "flow-A" : "op-1" } };
  });
  const success = await command("import:flows", source, "--force");
  assert.equal(success.code, 0, success.output);
  assert.ok(
    requests.some(
      (call) => call.path === "/operations/op-1" && call.body.resolve === null && call.body.reject === null,
    ),
  );
  writeFileSync(join(source, "flow.yaml"), stringify({ name: "A", operation_key: "missing", operations: [] }));
  requests = [];
  const malformed = await command("import:flows", source, "--force");
  assert.notEqual(malformed.code, 0);
  assert.equal(requests.filter((call) => call.path !== "/utils/cache/clear" && call.method !== "GET").length, 0);
  writeFileSync(join(source, "flow.yaml"), stringify({ name: "A", operations: [] }));
  writeFileSync(join(source, "flow.yaml"), stringify({ name: "A", operations: [{ key: "start", type: "exec" }] }));
  requests = [];
  assert.notEqual((await command("import:flows", source, "--force")).code, 0);
  assert.equal(requests.filter((call) => call.path !== "/utils/cache/clear" && call.method !== "GET").length, 0);
  writeFileSync(join(source, "flow.yaml"), stringify({ name: "A", operations: [] }));
  reset((call) =>
    call.method === "GET"
      ? {
          data: call.path === "/flows" ? [{ id: "flow-A", name: "A", operations: ["op-1"] }] : [],
        }
      : { status: 500, errors: [{ message: "fixture failure" }] },
  );
  assert.notEqual((await command("import:flows", source, "--force")).code, 0);
});

test("complete export preserves portable configuration while stripping settings secrets and access IDs", async () => {
  const dest = folder("export");
  const data: Record<string, unknown> = {
    "/schema/snapshot": {
      version: 1,
      directus: "11.17.4",
      vendor: "postgres",
      collections: [],
      fields: [],
      relations: [],
    },
    "/policies": [
      {
        id: "policy-1",
        name: "Editor",
        permissions: [],
        admin_access: false,
        app_access: true,
      },
    ],
    "/permissions": [
      {
        id: 1,
        policy: "policy-1",
        collection: "articles",
        action: "read",
        fields: ["*"],
      },
    ],
    "/roles": [
      { id: "role-1", name: "Contributor", parent: null },
      { id: "role-2", name: "Editor", parent: "role-1" },
    ],
    "/access": [{ role: "role-1", policy: "policy-1" }],
    "/flows": [{ id: "flow-1", name: "Flow", operation: "op-1", operations: ["op-1"] }],
    "/operations": [
      {
        id: "op-1",
        key: "start",
        type: "exec",
        position_x: 0,
        position_y: 0,
        flow: "flow-1",
        options: {},
      },
    ],
    "/presets": [{ id: 1, user: null, role: null, collection: "articles" }],
    "/translations": [{ id: "translation-1", language: "de-DE", key: "demo", value: "Example" }],
    "/settings": {
      project_name: "Example",
      mapbox_key: "fixture-private-one",
      future_api_key: "fixture-private-two",
    },
    "/dashboards": [{ id: "dashboard-1", name: "Dashboard", panels: ["panel-1"] }],
    "/panels": [
      {
        id: "panel-1",
        dashboard: "dashboard-1",
        type: "text",
        position_x: 0,
        position_y: 0,
        width: 12,
        height: 8,
        name: "Text",
      },
    ],
  };
  reset((call) => ({ data: data[call.path] ?? [] }));
  const result = await command("export:all", dest, "--force", "--clear");
  assert.equal(result.code, 0, result.output);
  const repeated = await command("export:all", dest, "--force", "--clear");
  assert.equal(
    repeated.code,
    0,
    "repeated exports must work with existing destination directories: " + repeated.output,
  );
  const roles = join(dest, "roles");
  const contributor = RecordSchema.parse(parse(readFileSync(join(roles, "Contributor.yaml"), "utf8")));
  assert.deepEqual(contributor.policies, ["Editor"]);
  assert.deepEqual(contributor.children, ["Editor"]);
  const editor = RecordSchema.parse(parse(readFileSync(join(roles, "Editor.yaml"), "utf8")));
  assert.equal(editor.policies, undefined, "a similar policy name must never invent an assignment");
  assert.equal(editor.parent, "Contributor");
  const settings = readFileSync(join(dest, "settings/settings.yaml"), "utf8");
  assert.ok(!settings.includes("fixture-private"));
  const flow = RecordSchema.parse(parse(readFileSync(join(dest, "flows/Flow.yaml"), "utf8")));
  assert.equal(flow.operation_key, "start");
  for (const name of ["schema", "policies", "roles", "flows", "presets", "translations", "settings", "dashboards"])
    assert.ok(readdirSync(join(dest, name)).length > 0, name);
});

test("role imports reject unresolved policies and HTTP failures instead of losing existing assignments", async () => {
  const source = folder("roles");
  writeFileSync(join(source, "role.yaml"), stringify({ name: "Contributor", policies: ["Editor"] }));
  reset((call) => ({
    data: call.path === "/roles" ? [{ id: "role-1", name: "Contributor" }] : [],
  }));
  assert.notEqual((await command("import:roles", source, "--force")).code, 0);
  assert.equal(requests.filter((call) => call.path === "/access" || call.path.startsWith("/access/")).length, 0);
  reset((call) => {
    if (call.path === "/roles") return { data: [{ id: "role-1", name: "Contributor" }] };
    if (call.path === "/policies") return { data: [{ id: "policy-1", name: "Editor" }] };
    if (call.method === "GET" && call.path === "/access") return { data: [{ id: "old", policy: "old-policy" }] };
    return { status: 500, errors: [{ message: "fixture attachment failed" }] };
  });
  assert.notEqual((await command("import:roles", source, "--force")).code, 0);
  assert.equal(requests.filter((call) => call.method === "DELETE").length, 0);
});

test("schema imports retry transient failures and skip apply for an unchanged snapshot", async () => {
  const source = folder("schema");
  yaml("schema/header.yaml", {
    version: 1,
    directus: "11.17.4",
    vendor: "postgres",
  });
  for (const name of ["collections", "fields", "relations"]) mkdirSync(join(source, name));
  let diffCalls = 0;
  reset((call) =>
    call.path === "/schema/diff" && ++diffCalls === 1
      ? { status: 503, errors: [{ message: "retry fixture" }] }
      : { status: 204 },
  );
  const result = await command("import:schema", source);
  assert.equal(result.code, 0, result.output);
  assert.equal(diffCalls, 2);
  assert.equal(requests.filter((call) => call.path === "/schema/apply").length, 0);
});

test("policy creation precedes permission writes and import-all stops on a policy failure", async () => {
  const source = folder("policy-config");
  for (const name of [
    "schema/collections",
    "schema/fields",
    "schema/relations",
    "policies",
    "roles",
    "flows",
    "presets",
    "translations",
    "settings",
    "dashboards",
  ])
    mkdirSync(join(source, name), { recursive: true });
  writeFileSync(join(source, "schema/header.yaml"), stringify({ version: 1, directus: "11.17.4", vendor: "postgres" }));
  writeFileSync(
    join(source, "policies/editor.yaml"),
    stringify({
      name: "Editor",
      permissions: [{ collection: "articles", action: "read", fields: ["*"] }],
    }),
  );
  let created = false;
  let permissionWrites = 0;
  reset((call) => {
    if (call.path === "/policies" && call.method === "GET")
      return { data: created ? [{ id: "policy-1", name: "Editor" }] : [] };
    if (call.path === "/policies" && call.method === "POST") {
      assert.equal(call.rows[0]?.name, "Editor");
      created = true;
      return { data: [{ id: "policy-1", name: "Editor" }] };
    }
    if (call.path === "/permissions" && call.method === "POST") {
      assert.ok(created);
      assert.equal(call.rows[0]?.policy, "policy-1");
      permissionWrites++;
    }
    return { data: [] };
  });
  const result = await command("import:policies", join(source, "policies"), "--force");
  assert.equal(result.code, 0, result.output);
  assert.equal(permissionWrites, 1);
  reset((call) =>
    call.path === "/schema/diff"
      ? { status: 204 }
      : call.path === "/policies" && call.method === "POST"
        ? { status: 500, errors: [{ message: "fixture policy failure" }] }
        : { data: [] },
  );
  assert.notEqual((await command("import:all", source, "--force")).code, 0);
  assert.equal(
    requests.filter((call) => ["/roles", "/flows", "/settings", "/dashboards"].includes(call.path)).length,
    0,
  );
});

test("role attachment synchronization persists exact policies and never updates user assignments", async () => {
  const source = folder("successful-roles");
  writeFileSync(join(source, "role.yaml"), stringify({ name: "Contributor", policies: ["Editor"] }));
  reset((call) => {
    if (call.path === "/roles") return { data: [{ id: "role-1", name: "Contributor" }] };
    if (call.path === "/policies") return { data: [{ id: "policy-1", name: "Editor" }] };
    if (call.method === "GET" && call.path === "/access") return { data: [{ id: "old", policy: "old-policy" }] };
    if (call.method === "POST" && call.path === "/access") {
      assert.deepEqual(call.body, { role: "role-1", policy: "policy-1" });
      return { data: { id: "new" } };
    }
    if (call.method === "DELETE") return { status: 204 };
    return { data: [] };
  });
  const result = await command("import:roles", source, "--force");
  assert.equal(result.code, 0, result.output);
  const additions = requests.findIndex((call) => call.path === "/access" && call.method === "POST");
  const removals = requests.findIndex((call) => call.path === "/access/old" && call.method === "DELETE");
  assert.ok(additions >= 0 && removals > additions);
  assert.equal(requests.filter((call) => call.path.startsWith("/users")).length, 0);
});

test("service-user provisioning uses supported SDK requests and strong tokens only for uniquely resolved roles", async () => {
  reset((call) => {
    if (call.method === "GET" && call.path === "/roles") {
      const filter = RecordSchema.parse(JSON.parse(call.url.searchParams.get("filter") ?? "{}"));
      const name = RecordSchema.parse(filter.name)._eq;
      assert.ok(name === "Frontend-Server" || name === "Frontend-Public");
      return { data: [{ id: `role-${name}` }] };
    }
    assert.equal(call.path, "/users");
    assert.equal(call.method, "POST");
    assert.match(String(call.body.token), /^[a-f0-9]{64}$/);
    assert.ok(["role-Frontend-Server", "role-Frontend-Public"].includes(String(call.body.role)));
    return { data: { id: "fixture-user" } };
  });
  const result = await provisionServiceUsers(url, "fixture-token");
  assert.equal(Object.keys(result).length, 2);
  assert.equal(requests.filter((call) => call.path === "/users").length, 2);
  reset(() => ({ data: [{ id: "ambiguous-one" }, { id: "ambiguous-two" }] }));
  await assert.rejects(provisionServiceUsers(url, "fixture-token"), /not uniquely found/);
  assert.equal(requests.filter((call) => call.method !== "GET").length, 0);
});

test("checked-in administrative YAML matches the maintained import contracts", () => {
  const source = fileURLToPath(new URL("../../", import.meta.url));
  const schemas: Record<string, ZodType> = {
    policies: PolicySchema,
    roles: RoleSchema,
    flows: FlowSchema,
    dashboards: DashboardSchema,
    presets: PresetSchema,
    translations: TranslationSchema,
  };
  for (const [directory, schema] of Object.entries(schemas))
    assert.ok(readYamlFiles(join(source, directory), schema).length > 0, directory);
});

test("translation export rejects unsafe language path segments before creating files", async () => {
  reset(() => ({ data: [{ id: "fixture", language: "../outside", key: "example", value: "Example" }] }));
  const result = await command("export:translations", join(directory, "safe-translation-export"), "--force");
  assert.notEqual(result.code, 0);
  assert.match(result.output, /safe path segment/);
});
