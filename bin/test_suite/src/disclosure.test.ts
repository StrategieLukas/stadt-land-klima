import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { Page } from "playwright";
import { assertNoCredentialFields, assertNoDisclosure, captureBrowserBodies } from "./lib/disclosure.js";

test("secret detection covers raw, escaped and encoded values without logging them", () => {
  const value = "Synthetic-private-key-18/abc";
  const marker = [{ label: "private service key", value }];
  for (const body of [
    `<script>${value}</script>`,
    JSON.stringify({ nested: [value] }),
    encodeURIComponent(value),
    Buffer.from(value).toString("base64"),
    value.replace(/./g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`),
  ]) {
    assert.throws(
      () => assertNoDisclosure(body, marker, "test response"),
      (error) => {
        assert(error instanceof Error);
        assert.match(error.message, /private service key/);
        assert(!error.message.includes(value));
        return true;
      },
    );
  }
});

test("nested arrays and relation fields cannot conceal credential properties", () => {
  assert.throws(
    () => assertNoCredentialFields({ candidates: [{ name: "Safe", relation: { access_token: null } }] }, "response"),
    /forbidden response field/,
  );
  assert.doesNotThrow(() => assertNoCredentialFields({ candidates: [{ name: "Safe", party: "Example" }] }, "response"));
});

test("empty or weak canaries cannot silently pass a disclosure assertion", () => {
  assert.throws(
    () => assertNoDisclosure("{}", [{ label: "missing setup", value: "" }], "response"),
    /must be distinctive/,
  );
  assert.doesNotThrow(() =>
    assertNoDisclosure('{"name":"Public name"}', [{ label: "private", value: "Distinct-private-canary" }], "response"),
  );
});

test("browser disclosure capture drains delayed API bodies while ignoring unfinished image traffic", async () => {
  for (const scenario of ["public", "leak", "unreadable"]) {
    const page = Object.assign(new EventEmitter(), { waitForFunction: async () => undefined });
    const finish = captureBrowserBodies(page as unknown as Page, [
      { label: "private marker", value: "Distinct-private-canary" },
    ]);
    const respond = (resourceType: string, body: string, unreadable = false) => {
      const request = { resourceType: () => resourceType };
      page.emit("request", request);
      page.emit("response", {
        request: () => request,
        status: () => 200,
        headers: () => ({ "content-type": "application/json" }),
        text: async () => {
          if (unreadable) throw new Error("Synthetic network failure");
          return body;
        },
      });
      page.emit("requestfinished", request);
    };
    respond("document", '{"name":"Public"}');
    page.emit("request", { resourceType: () => "image" }); // A hanging tile must not block the check.
    const result = finish();
    setTimeout(
      () =>
        respond(
          "fetch",
          scenario === "leak" ? '{"key":"Distinct-private-canary"}' : '{"name":"Public API"}',
          scenario === "unreadable",
        ),
      10,
    );
    if (scenario === "leak")
      await assert.rejects(result, /forbidden value detected \(private marker; value redacted\)/);
    else if (scenario === "unreadable") await assert.rejects(result, /body could not be inspected/);
    else assert.equal(await result, 2, "Both document and post-hydration API body must be scanned");
    assert.equal(page.listenerCount("response"), 0, "Capture listeners must be removed after success or failure");
    assert.equal(page.listenerCount("request"), 0);
  }
});
