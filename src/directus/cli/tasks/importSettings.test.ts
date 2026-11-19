import { test } from "node:test";
import assert from "node:assert/strict";
import { applySettings } from "./import/importSettings.ts";
import { createServer } from "node:http";
import { once } from "node:events";

test("a real dropped TCP response is recovered by readback after exactly one settings write", async () => {
  let writes = 0;
  let persisted: unknown;
  const server = createServer(async (request, response) => {
    assert.equal(request.headers.authorization, "Bearer fixture");
    if (request.method === "PATCH") {
      let body = "";
      for await (const chunk of request) body += chunk.toString();
      persisted = JSON.parse(body);
      writes++;
      request.socket.destroy();
      return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ data: persisted }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    assert.equal(await applySettings(`http://127.0.0.1:${address.port}`, "fixture", { project_name: "Fixture" }), true);
    assert.equal(writes, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("settings import verifies an ambiguous response without replaying writes or exposing private values", async () => {
  const settings = { project_name: "Fixture", ai_openai_api_key: "private-fixture", config: { b: 2, a: [1] } };
  const calls: string[] = [];
  let reads = 0;
  const recovered = await applySettings(
    "http://cms/",
    "private-token",
    settings,
    async (url, options) => {
      calls.push(options?.method ?? "GET");
      assert.equal(url, "http://cms/settings");
      assert.equal(options?.redirect, "error");
      assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer private-token");
      if (options?.method === "PATCH") throw new TypeError("socket closed private-fixture");
      if (reads++ === 0) return new Response(null, { status: 503 });
      return Response.json({ data: { ...settings, config: { a: [1], b: 2 } } });
    },
    async () => {},
  );
  assert.equal(recovered, true);
  assert.deepEqual(calls, ["PATCH", "GET", "GET"]);
  for (const actual of [
    { ...settings, project_name: "Different" },
    { ...settings, ai_openai_api_key: "********" },
    {},
  ]) {
    let writes = 0;
    await assert.rejects(
      applySettings(
        "http://cms",
        "private-token",
        settings,
        async (_url, options) => {
          if (options?.method === "PATCH") {
            writes++;
            throw Error("private-fixture");
          }
          return Response.json({ data: actual });
        },
        async () => {},
      ),
      (error) =>
        error instanceof Error &&
        !error.message.includes("private-fixture") &&
        /could not be verified/.test(error.message),
    );
    assert.equal(writes, 1);
  }
});

test("acknowledged settings writes need no readback and definitive authorization failures are not retried", async () => {
  for (const status of [200, 403]) {
    const methods: string[] = [];
    const run = applySettings("http://cms", "token", { project_name: "Fixture" }, async (_url, options) => {
      methods.push(options?.method ?? "GET");
      return new Response(null, { status });
    });
    if (status === 200) assert.equal(await run, false);
    else await assert.rejects(run, /HTTP 403/);
    assert.deepEqual(methods, ["PATCH"]);
  }
});
