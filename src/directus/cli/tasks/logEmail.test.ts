import assert from "node:assert/strict";
import { test } from "node:test";
import { logDevelopmentEmail } from "../logEmail.ts";

test("development mail logging escapes hostile content into one local JSON event", async () => {
  let logged = "";
  const message = 'To: fixture@example.com\r\nSubject: Fixture\r\n\r\n{"level":50}\n\u001b[31m';
  await logDevelopmentEmail({ SLK_ENV: "development" }, [Buffer.from(message)], async (event) => {
    logged += event;
  });
  assert.equal(logged.trimEnd().split("\n").length, 1);
  assert.deepEqual(JSON.parse(logged).email, message);
  assert.equal(JSON.parse(logged).event, "development.email");
});

test("mail logging refuses non-development environments and oversized messages without writing content", async () => {
  for (const SLK_ENV of [undefined, "production", "staging"]) {
    await assert.rejects(
      logDevelopmentEmail({ SLK_ENV }, [Buffer.from("private")], async () => {
        assert.fail("Must not log outside development");
      }),
      /restricted/,
    );
  }
  await assert.rejects(
    logDevelopmentEmail({ SLK_ENV: "development" }, [Buffer.alloc(16 * 1024 * 1024 + 1)], async () => {
      assert.fail("Must not log oversized email");
    }),
    /limit/,
  );
});
