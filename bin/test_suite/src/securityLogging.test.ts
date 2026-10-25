import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  securityRecord,
  statusLevel,
  errorStatus,
  userAgentInfo,
  configureServerDiagnostics,
  clientDiagnostic,
} from "../../../src/frontend/shared/securityLog.ts";
import {
  withLogContext,
  extensionLog,
  extensionError,
  setExtensionLogActor,
} from "../../../src/directus/extensions/shared/securityLogger.ts";
import { safeRequestRoute } from "../../../src/frontend/server/utils/securityLogging.ts";
import { loggingPatches } from "../../../docker/directus/security-patches/logging-patches.ts";
const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const secret = "PRIVATE-CREDENTIAL-DO-NOT-LOG";
const ua = `Mozilla/5.0 (Linux) Chrome/140.0 HeadlessChrome/140.0 email=private@example.org ip=203.0.113.42 token=${secret}\r\nforged`;
function sink() {
  const rows: { level: string; record: Record<string, unknown> }[] = [];
  const logger = Object.fromEntries(
    ["info", "warn", "error"].map((level) => [
      level,
      (record: Record<string, unknown>) => rows.push({ level, record }),
    ]),
  );
  return { rows, logger };
}
test("allowlisted log records never serialize payloads, errors, addresses or raw user-agent text", () => {
  const record = securityRecord("test.state_changed", {
    userId: userA,
    resourceId: userB,
    requestId: userB,
    route: "/api/candidate/:token",
    userAgent: ua,
    ...{
      error: new Error(secret),
      body: { password: secret },
      ip: "203.0.113.42",
      email: "private@example.org",
      headers: { authorization: secret },
      query: secret,
    },
  });
  assert.equal(record.userId, userA);
  assert.equal(record.route, "/api/candidate/:token");
  assert.doesNotMatch(
    JSON.stringify(record),
    /PRIVATE-CREDENTIAL|203\.0\.113|private@example|authorization|password|stack|forged/,
  );
  assert.equal(userAgentInfo(ua).bot, "other");
  assert.equal(userAgentInfo(ua).family, "chrome");
  assert.equal(userAgentInfo(ua).major, 140);
  assert.equal(userAgentInfo(ua).suspicious, true);
  assert.equal(securityRecord("test", { route: `/api/candidate/${secret}?token=${secret}` }).route, undefined);
});
test("expected rejections do not create error alarms and exception getters cannot break logging", () => {
  for (const status of [400, 404, 405, 422]) assert.equal(statusLevel(status), "info");
  for (const status of [401, 403, 409, 429]) assert.equal(statusLevel(status), "warn");
  for (const status of [500, 502, 503]) assert.equal(statusLevel(status), "error");
  assert.equal(
    errorStatus(
      new Proxy(
        {},
        {
          get() {
            throw new Error(secret);
          },
        },
      ),
    ),
    500,
  );
  const f = sink();
  extensionError(f.logger, "extension.rejected", { status: 403, message: secret, stack: secret });
  extensionError(f.logger, "extension.failed", { response: { status: 502, body: secret } });
  assert.deepEqual(
    f.rows.map((row) => row.level),
    ["warn", "error"],
  );
  assert.doesNotMatch(JSON.stringify(f.rows), new RegExp(secret));
});
test("concurrent extension work retains originating users and never leaks identity into scheduled work", async () => {
  const f = sink();
  await Promise.all(
    [userA, userB].map((userId, index) =>
      withLogContext({ user: () => userId, requestId: userId, userAgent: ua }, async () => {
        await new Promise((resolve) => setTimeout(resolve, index ? 1 : 5));
        extensionLog(f.logger, "info", "extension.state_changed", { userId: null });
      }),
    ),
  );
  assert.deepEqual(new Set(f.rows.map((row) => row.record.userId)), new Set([userA, userB]));
  for (const row of f.rows) assert.equal(row.record.userId, row.record.requestId);
  extensionLog(f.logger, "info", "extension.scheduled");
  assert.equal(f.rows.at(-1)!.record.userId, null);
  assert.equal(f.rows.at(-1)!.record.actorType, "system");
  withLogContext({ user: () => null, requestId: userA, userAgent: ua }, () => {
    setExtensionLogActor(userB);
    extensionLog(f.logger, "info", "extension.auth_refreshed");
  });
  assert.equal(f.rows.at(-1)!.record.userId, userB);
  assert.doesNotThrow(() =>
    extensionLog(
      {
        error() {
          throw new Error(secret);
        },
      },
      "error",
      "extension.failed",
    ),
  );
});
test("Nuxt route labels never contain credentials, editor targets, slugs or query values", () => {
  assert.equal(safeRequestRoute(`/api/candidate/${secret}?access_token=${secret}`), "/api/candidate/:token");
  assert.equal(safeRequestRoute(`/api/candidate/${secret}/answers`), "/api/candidate/:token/answers");
  assert.equal(safeRequestRoute(`/api/editor/cms/items/candidate/${secret}`), "/api/editor/cms/:path*");
  assert.equal(safeRequestRoute(`/api/unknown/${secret}`), "/api/unmatched");
  assert.equal(safeRequestRoute(`/elections/thesen/${secret}`), "/page");
});
function loadHook() {
  const file = new URL(
    "../../../src/directus/extensions/custom-slk-interfaces/src/security-audit/index.ts",
    import.meta.url,
  );
  const module = { exports: {} as { default?: (hooks: unknown, context: unknown) => void } };
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: createRequire(file),
      performance,
    },
  );
  return module.exports.default!;
}
test("Directus mutation/login/logout hooks exclude payloads and preserve HTTP actor identity", () => {
  const f = sink();
  const actions = new Map<string, (...args: any[]) => void>();
  let middleware: ((req: any, res: any, next: () => void) => void) | undefined;
  loadHook()(
    {
      action: (name: string, callback: (...args: any[]) => void) => actions.set(name, callback),
      filter() {},
      init: (_name: string, callback: (context: unknown) => void) =>
        callback({
          app: {
            use: (fn: typeof middleware) => {
              middleware = fn;
            },
          },
        }),
    },
    { logger: f.logger },
  );
  const req = {
    originalUrl: `/items/candidate?filter=${secret}`,
    method: "PATCH",
    headers: { "user-agent": ua },
    accountability: { user: userA },
  };
  const res = Object.assign(new EventEmitter(), { statusCode: 403, setHeader() {} });
  middleware!(req, res, () => {
    actions.get("items.update")!(
      { collection: "candidate", keys: [userB], payload: { access_token: secret, email: "private@example.org" } },
      { accountability: { user: userA } },
    );
  });
  res.emit("finish");
  actions.get("auth.login")!({ status: "fail", user: userB, payload: { password: secret }, error: new Error(secret) });
  actions.get("auth.login")!({ status: "success", user: userA, payload: { password: secret } });
  actions.get("activity.create")!({ payload: { action: "logout", user: userA, ip: "203.0.113.42" } });
  const http = f.rows.find((row) => row.record.event === "directus.request.completed")!;
  assert.equal(http.record.userId, userA);
  assert.equal(http.level, "warn");
  assert.equal(http.record.route, "/items/:collection/:id");
  assert.ok(http.record.userAgent);
  assert.equal(f.rows.filter((row) => row.record.event === "directus.auth.login").length, 2);
  assert.ok(f.rows.some((row) => row.record.event === "directus.auth.logout"));
  assert.doesNotMatch(JSON.stringify(f.rows), /PRIVATE-CREDENTIAL|private@example|203\.0\.113|password|forged/);
});
test("pinned native error patches remove exception serialization while retaining user identity", () => {
  const rows: unknown[] = [];
  const logger = { error: (...args: unknown[]) => rows.push(args) };
  for (const [original, replacement] of loggingPatches[0]!.replacements.filter(([original]) =>
    original.includes(".error("),
  )) {
    new Function("logger", "useLogger", "error", "req", replacement)(
      logger,
      () => logger,
      { message: secret, stack: secret },
      { accountability: { user: userA } },
    );
  }
  assert.equal(rows.length, 2);
  assert.doesNotMatch(JSON.stringify(rows), new RegExp(secret));
  assert.match(JSON.stringify(rows), new RegExp(userA));
});
function maintained(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "dist", ".nuxt", ".output", "public", "scripts"].includes(entry.name)) return [];
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    return entry.isDirectory() ? maintained(path) : /\.(?:ts|vue)$/.test(entry.name) ? [path] : [];
  });
}
test("maintained runtime sources cannot reintroduce raw console or native logger calls", () => {
  for (const file of [
    ...maintained(new URL("../../../src/frontend/", import.meta.url)),
    ...maintained(new URL("../../../src/directus/extensions/", import.meta.url)),
  ]) {
    if (/\/(securityLog|securityLogging|securityLogger)\.ts$/.test(file.pathname)) continue;
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /\bconsole\.(?:log|debug|trace|warn|error|info|dir|table)\s*\(/, file.pathname);
    assert.doesNotMatch(text, /\blogger\.(?:warn|error|info|debug)\s*\(/, file.pathname);
  }
});

test("client diagnostics only accept fixed codes, reject extra metadata and honor the strict write budget", async () => {
  const file = new URL("../../../src/frontend/server/api/security/client-event.post.ts", import.meta.url);
  const require = createRequire(file);
  const module = { exports: {} as { default?: (event: Record<string, unknown>) => Promise<unknown> } };
  const logged: unknown[] = [];
  let allowed = true;
  const dependencies: Record<string, unknown> = {
    h3: {
      defineEventHandler: (fn: unknown) => fn,
      createError: (input: object) => Object.assign(new Error("Rejected"), input),
      setResponseStatus() {},
    },
    "../../utils/rateLimit": {
      rateLimit: async (_event: unknown, key: string) => {
        assert.equal(key, "client-event");
        return allowed;
      },
    },
    "../../utils/readRequestBody": {
      readRequestBody: async (event: { body: unknown }, max: number) => {
        assert.equal(max, 2048);
        return event.body;
      },
    },
    "../../utils/securityLogging": {
      requestLog: (_event: unknown, level: string, code: string) => logged.push({ level, code }),
    },
  };
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id: string) => (id in dependencies ? dependencies[id] : require(id)),
    },
  );
  const handler = module.exports.default!;
  await handler({ body: { event: "client.runtime_failed" } });
  assert.deepEqual(logged, [{ level: "warn", code: "client.runtime_failed" }]);
  for (const body of [
    { event: secret },
    { event: "client.runtime_failed", userId: userA },
    { event: "client.runtime_failed", stack: secret },
  ]) {
    await assert.rejects(handler({ body }), { statusCode: 400 });
  }
  allowed = false;
  await assert.rejects(handler({ body: { event: "client.runtime_failed" } }), { statusCode: 429 });
  assert.equal(logged.length, 1);
});

test("malformed candidate credentials are rejected before reaching UUID database queries", async () => {
  const file = new URL("../../../src/frontend/server/utils/candidateAuth.ts", import.meta.url);
  const require = createRequire(file);
  const module = { exports: {} as { verifyCandidateAccessToken?: (token: string) => Promise<unknown> } };
  let queries = 0;
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id: string) =>
        id === "zod"
          ? require(id)
          : id === "./directusServerClient"
            ? {
                createDirectusServerClient() {
                  queries++;
                  throw new Error("Query attempted");
                },
              }
            : {},
    },
  );
  for (const token of ["invalid", secret, "", "1' OR true--"])
    assert.equal(await module.exports.verifyCandidateAccessToken!(token), null);
  assert.equal(queries, 0);
});

test("SSR diagnostics resolve each active request instead of logging browser identities or capturing a user", () => {
  let activeUser: string | null = userA;
  const rows: unknown[] = [];
  configureServerDiagnostics((code, level) => {
    rows.push({
      ...securityRecord(code, { userId: activeUser, actorType: activeUser ? "user" : "system" }),
      severity: level,
    });
  });
  clientDiagnostic("test.ssr_failed", "error");
  activeUser = userB;
  clientDiagnostic("test.ssr_rejected", "warn");
  activeUser = null;
  clientDiagnostic("test.background", "info");
  assert.deepEqual(
    rows.map((row: any) => row.userId),
    [userA, userB, null],
  );
  assert.deepEqual(
    rows.map((row: any) => row.severity),
    ["error", "warn", "info"],
  );
});

test("editorial preconditions produce 422/info while unexpected election failures remain 500/error", async () => {
  const file = new URL("../../../src/directus/extensions/election-check/src/endpoint/index.ts", import.meta.url);
  const require = createRequire(file);
  const module = { exports: {} as { default?: { handler: (router: unknown, context: unknown) => void } } };
  const f = sink();
  let fail = false;
  const routes = new Map<string, (req: unknown, res: unknown) => Promise<unknown>>();
  class ItemsService {
    async readOne() {
      if (fail) throw new Error(secret);
      return { already_generated_questions: false };
    }
  }
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (id: string) => (id.endsWith("/api.js") ? { default: {} } : require(id)),
    },
  );
  module.exports.default!.handler(
    { post: (name: string, handler: (req: unknown, res: unknown) => Promise<unknown>) => routes.set(name, handler) },
    {
      getSchema: async () => ({}),
      services: { ItemsService, MailService: class {} },
      logger: f.logger,
    },
  );
  const reply = {
    code: 200,
    status(code: number) {
      this.code = code;
      return this;
    },
    json() {},
  };
  await routes.get("/request-review")!({ body: { election_id: userB }, accountability: { user: userA } }, reply);
  assert.equal(reply.code, 422);
  assert.equal(f.rows.at(-1)!.level, "info");
  fail = true;
  await routes.get("/request-review")!({ body: { election_id: userB }, accountability: { user: userA } }, reply);
  assert.equal(reply.code, 500);
  assert.equal(f.rows.at(-1)!.level, "error");
  assert.doesNotMatch(JSON.stringify(f.rows), new RegExp(secret));
});

test("safe Nuxt errors preserve API validation data and the HTML error page without leaking exceptions", async () => {
  const file = new URL("../../../src/frontend/server/errorHandler.ts", import.meta.url);
  const module = { exports: {} as { default?: (error: unknown, event: any) => Promise<string> } };
  const rendered: string[] = [];
  runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      module,
      exports: module.exports,
      URLSearchParams,
      require: (id: string) => {
        if (id === "./utils/securityLogging") return { requestFailure() {} };
        if (id === "h3")
          return {
            getHeader: (event: any, key: string) => event.headers[key],
            setResponseHeader: (event: any, key: string, value: string) => {
              event.responseHeaders[key] = value;
            },
            setResponseStatus: (event: any, status: number) => {
              event.status = status;
            },
            send: (_event: unknown, body: string) => body,
          };
        if (id === "nitropack/runtime")
          return {
            defineNitroErrorHandler: (fn: unknown) => fn,
            useNitroApp: () => ({
              localFetch: async (url: string) => {
                rendered.push(url);
                return {
                  headers: new Map([["content-type", "text/html"]]),
                  text: async () => "<html>Existing Nuxt error page</html>",
                };
              },
            }),
          };
        throw new Error("Unexpected dependency");
      },
    },
  );
  const event = (path: string, html = false) => ({
    path,
    context: {},
    headers: { accept: html ? "text/html" : "application/json" },
    responseHeaders: {} as Record<string, string>,
    status: 0,
  });
  const api = event("/api/candidate/" + secret);
  const rejected = JSON.parse(
    await module.exports.default!({ statusCode: 422, message: "Validation failed", data: { field: "answer" } }, api),
  );
  assert.equal(api.status, 422);
  assert.deepEqual(rejected.data, { field: "answer" });
  const failed = await module.exports.default!({ statusCode: 500, message: secret, stack: secret, data: secret }, api);
  assert.doesNotMatch(failed, new RegExp(secret));
  const page = event("/private/" + secret, true);
  const html = await module.exports.default!({ statusCode: 500, message: secret, stack: secret }, page);
  assert.match(html, /<html>/);
  assert.equal(page.status, 500);
  assert.equal(page.responseHeaders["content-type"], "text/html");
  assert.equal(rendered.length, 1);
  assert.doesNotMatch(rendered[0]!, new RegExp(secret));
});

test("native action, initialization, scheduled-flow and SMTP catches cannot dump extension or provider errors", () => {
  const f = sink();
  for (const patch of loggingPatches.slice(1)) {
    for (const [, replacement] of patch.replacements) {
      for (const status of [422, 403, 500]) {
        const error = { status, message: secret, stack: secret, response: { password: secret } };
        new Function("logger", "error", "err", "context", "flow", replacement).call(
          { accountability: { user: userA } },
          f.logger,
          error,
          error,
          { accountability: { user: userA } },
          { id: userB },
        );
      }
    }
  }
  assert.ok(f.rows.length >= 12);
  assert.doesNotMatch(JSON.stringify(f.rows), new RegExp(secret));
  const actions = f.rows.filter((row) => row.record.event === "directus.action.failed");
  assert.deepEqual(
    actions.map((row) => row.level),
    ["info", "warn", "error"],
  );
  assert.ok(actions.every((row) => row.record.userId === userA));
  assert.ok(f.rows.every((row) => "userId" in row.record && "actorType" in row.record));
});
