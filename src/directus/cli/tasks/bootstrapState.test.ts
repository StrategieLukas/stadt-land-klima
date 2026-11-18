import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertApplicationSchema,
  bootstrapAdministratorToken,
  needsBootstrapAdministrator,
} from "../bootstrapState.ts";

const tables = ["municipalities", "ratings_measures", "pages", "news_items", "blocks", "edit_states"];

test("startup requires imported application tables before custom migrations, including partial schemas", () => {
  for (const missing of tables) {
    assert.throws(
      () => assertApplicationSchema({ tables: tables.filter((table) => table !== missing), userCount: 1 }),
      /stack start --import/,
    );
  }
  assert.throws(
    () => assertApplicationSchema({ tables: ["directus_users", "spatial_ref_sys"], userCount: 0 }),
    /stack start --import/,
  );
  assert.doesNotThrow(() => assertApplicationSchema({ tables, userCount: 1 }));
});

test("initial administrator uses the explicit token or configured CLI token and rejects placeholders", () => {
  const token = "a".repeat(64);
  const explicit = "b".repeat(64);
  assert.equal(bootstrapAdministratorToken({ CLI_DIRECTUS_STATIC_TOKEN: token }), token);
  assert.equal(bootstrapAdministratorToken({ ADMIN_TOKEN: explicit, CLI_DIRECTUS_STATIC_TOKEN: token }), explicit);
  assert.equal(bootstrapAdministratorToken({}), undefined);
  assert.throws(() => bootstrapAdministratorToken({ CLI_DIRECTUS_STATIC_TOKEN: "replace-with-admin-token" }), /strong/);
  assert.throws(
    () => bootstrapAdministratorToken({ CLI_DIRECTUS_STATIC_TOKEN: "replace-with-" + "a".repeat(64) }),
    /strong/,
  );
});

test("administrator recovery is limited to an interrupted empty core bootstrap with configured credentials", () => {
  const empty = {
    tables: ["directus_users", "directus_roles", "directus_migrations", "spatial_ref_sys"],
    userCount: 0,
  };
  assert.equal(needsBootstrapAdministrator(empty, true), true);
  assert.equal(needsBootstrapAdministrator({ ...empty, userCount: 1 }, false), false);
  assert.equal(needsBootstrapAdministrator({ tables, userCount: 5 }, true), false);
  assert.throws(() => needsBootstrapAdministrator(empty, false), /credentials are required/);
  assert.throws(
    () => needsBootstrapAdministrator({ ...empty, tables: [...empty.tables, "municipalities"] }, true),
    /empty core-only database/,
  );
  for (const userCount of [-1, NaN, 0.5])
    assert.throws(() => needsBootstrapAdministrator({ ...empty, userCount }, true), /Invalid bootstrap user count/);
});
