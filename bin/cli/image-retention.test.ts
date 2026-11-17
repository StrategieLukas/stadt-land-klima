import assert from "node:assert/strict";
import { test } from "node:test";
import { imageRetentionPlan } from "./image-retention.ts";

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
