import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const frontend = createRequire(new URL("../../../src/frontend/package.json", import.meta.url));
const { createClient } = frontend("redis") as typeof import("../../../src/frontend/node_modules/redis/dist/index.js");
if (!process.env.TEST_REDIS_URL)
  throw new Error("Set TEST_REDIS_URL to an isolated/local Redis service; no production credentials");
const source = readFileSync(new URL("../../../src/frontend/server/utils/rateLimit.ts", import.meta.url), "utf8");
const script = /export const RATE_LIMIT_SCRIPT = `([\s\S]*?)`/.exec(source)?.[1];
assert.ok(script);
const clients = [createClient({ url: process.env.TEST_REDIS_URL }), createClient({ url: process.env.TEST_REDIS_URL })];
const key = "test:slk-request-protection:" + randomUUID();
const deliveryKeys = [key + ":global", key + ":form", key + ":copy"];
try {
  await Promise.all(clients.map((client) => client.connect()));
  const results = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      clients[i % 2]!.eval(script, { keys: [key], arguments: ["60000", "3", randomUUID()] }),
    ),
  );
  assert.equal(results.filter((result) => result === 1).length, 3);
  assert.equal(await clients[0]!.zCard(key), 3);
  assert.ok((await clients[0]!.pTTL(key)) > 0);
  const delivery = /const script = `([\s\S]*?)`/.exec(
    readFileSync(new URL("../../../src/frontend/server/utils/formDeliveryQuota.ts", import.meta.url), "utf8"),
  )?.[1];
  assert.ok(delivery);
  const deliveries = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      clients[i % 2]!.eval(delivery, { keys: deliveryKeys, arguments: ["200", "50", "5"] }),
    ),
  );
  assert.equal(deliveries.filter((result) => result === 1).length, 5);
  for (const deliveryKey of deliveryKeys)
    assert.equal(
      await clients[0]!.get(deliveryKey),
      "5",
      "Denied deliveries must not partially consume another budget",
    );
  console.log(
    "Real Redis: delivery quotas permit exactly 5 concurrent copies with consistent global/form/copy budgets.",
  );
  console.log(
    "Real Redis: 100 concurrent requests across two clients permit exactly 3; unique members and expiry verified.",
  );
} finally {
  if (clients[0]!.isReady) await clients[0]!.del([key, ...deliveryKeys]);
  await Promise.all(clients.map((client) => (client.isOpen ? client.quit() : undefined)));
}
