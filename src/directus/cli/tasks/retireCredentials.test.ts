import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import assert from "node:assert/strict";
import {
  planRetirement,
  applyRetirement,
  replacementLinks,
  type RetirementRequest,
  retirementScopeFromPolicy,
  readRetirementScope,
  createRetirementRequest,
} from "./retireCredentials.ts";
const allScope = { legacyFrontend: true, candidates: true, previews: true };
test("retirement accepts empty successful cache responses but rejects HTTP errors and malformed JSON", async () => {
  for (const status of [200, 204]) {
    const request = createRetirementRequest("http://cms/", "private-token", async (url, options) => {
      assert.equal(url, "http://cms/utils/cache/clear");
      assert.equal(options?.method, "POST");
      assert.equal(options?.redirect, "error");
      return new Response(null, { status });
    });
    assert.equal(await request("/utils/cache/clear", "POST"), null);
  }
  const valid = createRetirementRequest("http://cms", "private-token", async () => Response.json({ data: [] }));
  assert.deepEqual(await valid("/users"), { data: [] });
  const denied = createRetirementRequest(
    "http://cms",
    "private-token",
    async () => new Response("secret", { status: 403 }),
  );
  await assert.rejects(denied("/users"), /^Error: Retirement request failed: HTTP 403$/);
  const malformed = createRetirementRequest("http://cms", "private-token", async () => new Response("broken JSON"));
  await assert.rejects(malformed("/users"), SyntaxError);
});
function fixture() {
  const candidates = [{ id: 1, access_token: "previous-candidate" }];
  const municipalities = [{ id: "city", preview_token: "previous-preview", slug: "test-city" }];
  const users = [{ id: "legacy", role: "old", status: "active", token: "old-shared" }];
  const writes: string[] = [];
  const request: RetirementRequest = async (path, method = "GET", body) => {
    if (method === "GET")
      return {
        data: path.startsWith("/roles?")
          ? [
              { id: "old", name: "Frontend" },
              { id: "server", name: "Frontend-Server" },
              { id: "public", name: "Frontend-Public" },
            ]
          : path.startsWith("/users?")
            ? users
            : path.startsWith("/items/candidate?")
              ? candidates
              : municipalities,
      };
    writes.push(path);
    if (path === "/utils/cache/clear") return null;
    const record = path.includes("/candidate/")
      ? candidates[0]
      : path.includes("/municipalities/")
        ? municipalities[0]
        : users[0];
    Object.assign(record!, body);
    return { data: record };
  };
  return { request, candidates, municipalities, users, writes };
}
test("retirement planning makes no writes, isolates the legacy role and prepares private fragment invitations", async () => {
  const f = fixture();
  const plan = await planRetirement(f.request, "https://cms.example.org", "https://example.org/", allScope);
  assert.deepEqual(f.writes, []);
  assert.equal(plan.credentials.length, 3);
  assert.doesNotMatch(JSON.stringify(plan), /previous-candidate|previous-preview|old-shared/);
  assert.match(replacementLinks(plan)[0]!.url!, /\/elections\/thesen#token=[a-f0-9-]{36}$/);
  const schema = parse(
    readFileSync(new URL("../../schema/fields/candidate/access_token.yaml", import.meta.url), "utf8"),
  );
  assert.equal(schema.schema.data_type, "uuid");
  assert.ok(
    z.uuid().safeParse(plan.credentials.find((row) => row.collection === "candidate")!.replacement).success,
    "Replacement must fit the real UUID column",
  );
  assert.equal(plan.credentials.find((row) => row.collection === "municipalities")!.replacement!.length, 64);
  const result = await applyRetirement(f.request, plan, "https://cms.example.org", "https://example.org", allScope);
  assert.equal(result.updated, 3);
  assert.equal(f.users[0]!.status, "suspended");
  assert.equal(f.users[0]!.token, null);
  assert.equal(
    (await applyRetirement(f.request, plan, "https://cms.example.org", "https://example.org", allScope)).alreadyApplied,
    3,
  );
  assert.ok(!f.writes.some((path) => /server|public/.test(path)));
});
test("retirement validates all preconditions before mutation and rejects instance, role, inventory and token drift", async () => {
  for (const drift of ["token", "role", "inventory", "instance", "website"]) {
    const f = fixture();
    const plan = await planRetirement(f.request, "https://cms.example.org", "https://example.org", allScope);
    if (drift === "token") f.users[0]!.token = "changed";
    if (drift === "role") f.users[0]!.role = "server";
    if (drift === "inventory") f.candidates.push({ id: 2, access_token: "new" });
    await assert.rejects(
      applyRetirement(
        f.request,
        plan,
        drift === "instance" ? "https://other.example.org" : "https://cms.example.org",
        drift === "website" ? "https://other.example.org" : "https://example.org",
        allScope,
      ),
    );
    assert.deepEqual(f.writes, [], drift);
  }
});
test("concealed API tokens require private recovery and real token drift rejects retirement before writes", async () => {
  const f = fixture();
  const scope = { legacyFrontend: true, candidates: false, previews: false };
  let storedToken = "old-shared";
  const request: RetirementRequest = async (path, method, body) => {
    const response = await f.request(path, method, body);
    if ((!method || method === "GET") && path.startsWith("/users?")) {
      return { data: f.users.map((user) => ({ ...user, token: user.token === null ? null : "**********" })) };
    }
    return response;
  };
  await assert.rejects(planRetirement(request, "https://cms", "https://site", scope), /private stored-token reader/);
  const read = async (identity: { id: string; role: string; email: string | null; status: string }) => {
    assert.deepEqual(identity, { id: "legacy", role: "old", email: null, status: "active" });
    return storedToken;
  };
  const plan = await planRetirement(request, "https://cms", "https://site", scope, read);
  const raw = await planRetirement(f.request, "https://cms", "https://site", scope);
  assert.equal(plan.credentials[0]!.previousHash, raw.credentials[0]!.previousHash);
  storedToken = "changed-behind-concealed-response";
  await assert.rejects(
    applyRetirement(request, plan, "https://cms", "https://site", scope, read),
    /changed since planning/,
  );
  assert.deepEqual(f.writes, []);
  storedToken = "old-shared";
  assert.equal((await applyRetirement(request, plan, "https://cms", "https://site", scope, read)).updated, 1);
  assert.equal((await applyRetirement(request, plan, "https://cms", "https://site", scope, read)).alreadyApplied, 1);
});
test("retirement can resume after a partial upstream failure without rotating completed credentials again", async () => {
  const f = fixture();
  const plan = await planRetirement(f.request, "http://cms", "https://example.org", allScope);
  let writes = 0;
  await assert.rejects(
    applyRetirement(
      async (path, method, body) => {
        if (method === "PATCH" && ++writes === 2) throw Error("CMS offline");
        return f.request(path, method, body);
      },
      plan,
      "http://cms",
      "https://example.org",
      allScope,
    ),
  );
  const token = f.candidates[0]!.access_token;
  const result = await applyRetirement(f.request, plan, "http://cms", "https://example.org", allScope);
  assert.equal(result.alreadyApplied, 1);
  assert.equal(result.updated, 2);
  assert.equal(f.candidates[0]!.access_token, token);
});

test("owner policy retains candidate access tokens and municipality previews while retiring the shared identity", async () => {
  const scope = readRetirementScope(fileURLToPath(new URL("../credential-rotation.yaml", import.meta.url)));
  assert.deepEqual(scope, { legacyFrontend: true, candidates: false, previews: false });
  const f = fixture();
  const reads: string[] = [];
  const request: RetirementRequest = (path, method, body) => {
    if (!method || method === "GET") reads.push(path);
    return f.request(path, method, body);
  };
  const plan = await planRetirement(request, "https://cms", "https://website", scope);
  assert.deepEqual(
    plan.credentials.map((row) => row.collection),
    ["users"],
  );
  assert.ok(
    reads.every((path) => !path.startsWith("/items/")),
    "Do not retrieve unselected bearer tokens",
  );
  f.candidates.push({ id: 2, access_token: "new-unselected-candidate" });
  f.municipalities[0]!.preview_token = "independently-changed-preview";
  await applyRetirement(request, plan, "https://cms", "https://website", scope);
  assert.equal(f.candidates[0]!.access_token, "previous-candidate");
  assert.equal(f.municipalities[0]!.preview_token, "independently-changed-preview");
  assert.equal(f.users[0]!.status, "suspended");
});

test("scope changes, legacy plans and malformed policy cannot authorize writes", async () => {
  const f = fixture();
  const plan = await planRetirement(f.request, "https://cms", "https://website", allScope);
  await assert.rejects(
    applyRetirement(f.request, plan, "https://cms", "https://website", { ...allScope, previews: false }),
    /policy changed/,
  );
  await assert.rejects(
    applyRetirement(f.request, { ...plan, version: 1 }, "https://cms", "https://website", allScope),
    /Legacy retirement/,
  );
  assert.deepEqual(f.writes, []);
  const example = parse(readFileSync(new URL("../credential-rotation.yaml", import.meta.url), "utf8"));
  assert.throws(
    () =>
      retirementScopeFromPolicy({
        ...example,
        credentials: {
          ...example.credentials,
          candidate_links: { ...example.credentials.candidate_links, action: "revoke" },
        },
      }),
    /Unsupported/,
  );
  assert.throws(() =>
    retirementScopeFromPolicy({
      ...example,
      credentials: {
        ...example.credentials,
        municipality_previews: { ...example.credentials.municipality_previews, action: "rotatte" },
      },
    }),
  );
  assert.throws(() => retirementScopeFromPolicy({ ...example, credentials: {} }), /Missing/);
});

test("an empty selection performs no inventory reads or cache writes", async () => {
  const request: RetirementRequest = async () => {
    throw Error("No request expected");
  };
  const scope = { legacyFrontend: false, candidates: false, previews: false };
  const plan = await planRetirement(request, "https://cms", "https://website", scope);
  assert.deepEqual(await applyRetirement(request, plan, "https://cms", "https://website", scope), {
    updated: 0,
    alreadyApplied: 0,
  });
});

test("candidate-only selection does not depend on legacy roles or retrieve preview credentials", async () => {
  const f = fixture();
  const request: RetirementRequest = (path, method, body) => {
    assert.ok(!path.startsWith("/roles") && !path.startsWith("/users") && !path.startsWith("/items/municipalities"));
    return f.request(path, method, body);
  };
  const scope = { legacyFrontend: false, candidates: true, previews: false };
  const plan = await planRetirement(request, "https://cms", "https://website", scope);
  assert.deepEqual(
    plan.credentials.map((row) => row.collection),
    ["candidate"],
  );
  await applyRetirement(request, plan, "https://cms", "https://website", scope);
  assert.notEqual(f.candidates[0]!.access_token, "previous-candidate");
  assert.equal(f.users[0]!.status, "active");
  assert.equal(f.municipalities[0]!.preview_token, "previous-preview");
});

test("the executable refuses implicit bulk planning without an explicit policy", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", fileURLToPath(new URL("./retireCredentials.ts", import.meta.url)), "plan", "unused-plan.json"],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:.*--policy/);
});
