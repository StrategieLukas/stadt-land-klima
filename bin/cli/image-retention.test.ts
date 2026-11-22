import assert from "node:assert/strict";
import { test } from "node:test";
import { imageRetentionPlan, imageRetentionLocks } from "./image-retention.ts";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

test("image retention distinguishes build-cache rows from active, successful previous and explicit recovery images", () => {
  const image = (n: number, Names: string[], Containers = 0) => ({
    Id: n.toString(16).padStart(64, "0"),
    Names,
    Created: n,
    Containers,
  });
  const rows = [
    image(1, ["localhost/slk-podman-frontend:release-11111111"], 1),
    image(2, ["localhost/slk-podman-directus:release-22222222"]),
    image(2, ["localhost/slk-podman-directus:release-222222223333"]),
    image(3, ["localhost/slk-podman-directus:release-33333333"]), // More recent failed build.
    image(4, []), // Build cache.
    image(5, ["docker.io/postgis/postgis:17"]),
    image(6, ["localhost/slk-podman-directus:rollback-20261028"]),
    image(7, [], 1), // An untagged image used by a container also survives.
  ];
  const plan = imageRetentionPlan(rows, ["release-11111111", "release-22222222"]);
  assert.equal(plan.imageCount, 7);
  assert.deepEqual(
    plan.preserve.map((i) => Number.parseInt(i.Id, 16)),
    [1, 2, 5, 6, 7],
  );
  assert.equal(plan.preserve[1]!.Names.length, 2);
  assert.throws(() => imageRetentionPlan(rows, []));
  assert.throws(() => imageRetentionPlan([{ ...rows[0]!, Id: "--all" }], ["release-11111111"]));
});

test(
  "image cleanup cannot prune staged images between automatic release phases",
  { skip: process.platform !== "linux" },
  async (t) => {
    const runtime = mkdtempSync(join(tmpdir(), "slk-image-lock-"));
    t.after(() => rmSync(runtime, { recursive: true, force: true }));
    const holder = spawn(
      "flock",
      [
        "--close",
        join(runtime, "fixture.update.lock"),
        process.execPath,
        "-e",
        "console.log('locked');process.stdin.resume()",
      ],
      { stdio: ["pipe", "pipe", "inherit"] },
    );
    const exited = once(holder, "close");
    try {
      await once(holder.stdout, "data");
      const probe = spawnSync(
        "flock",
        imageRetentionLocks(runtime, "fixture", process.execPath, ["-e", "process.stdout.write('pruned')"]),
        { encoding: "utf8" },
      );
      assert.equal(probe.status, 75);
      assert.equal(probe.stdout, "");
    } finally {
      holder.stdin.end();
      await exited;
    }
  },
);
