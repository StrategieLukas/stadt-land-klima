import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEnvironment, databaseRoleFailures, isAllowedSensitiveAccessor } from "../security/startupChecks.js";

test("enabled startup checks reject missing/example signing and database secrets without disclosing values", () => {
  for (const env of [{}, { KEY: "some-random-key", SECRET: "secret", DB_PASSWORD: "password" }]) {
    const failures: string[] = [];
    const missing = checkEnvironment(env, failures);
    assert.ok(failures.length >= 2);
    if (!Object.keys(env).length) assert.equal(missing.size, 2);
  }
  const failures: string[] = [];
  checkEnvironment({ KEY: "a".repeat(64), SECRET: "b".repeat(64), DB_PASSWORD: "a-private-password" }, failures);
  assert.deepEqual(failures, []);
});

test("startup permission review accepts the private server identity but denies preview/public sensitive access", () => {
  for (const action of ["read", "create", "update", "delete"])
    assert.ok(isAllowedSensitiveAccessor("answers", action, "Frontend-Server"));
  assert.ok(isAllowedSensitiveAccessor("candidate", "read", "Frontend-Server"));
  for (const accessor of ["Frontend-Preview", "Frontend-Public", "Public", "User:unknown"])
    assert.equal(isAllowedSensitiveAccessor("candidate", "read", accessor), false);
  assert.equal(isAllowedSensitiveAccessor("directus_sessions", "read", "Frontend-Server"), false);
});

test("production database check rejects every elevated application role privilege", () => {
  const role = {
    rolsuper: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolreplication: false,
    rolbypassrls: false,
  };
  assert.deepEqual(databaseRoleFailures(role), []);
  for (const flag of Object.keys(role))
    assert.deepEqual(databaseRoleFailures({ ...role, [flag]: true }), [
      `Database application role has forbidden privilege: ${flag}`,
    ]);
});

test("legacy KEY is a retained identifier rather than a required signing credential", () => {
  for (const KEY of [undefined, "legacy-instance", "some-random-key"]) {
    const failures: string[] = [];
    checkEnvironment({ KEY, SECRET: "b".repeat(64), DB_PASSWORD: "a-private-password" }, failures);
    assert.deepEqual(failures, []);
  }
  const failures: string[] = [];
  checkEnvironment({ SECRET: "short", DB_PASSWORD: "a-private-password" }, failures);
  assert.ok(failures.some((failure) => failure.includes("SECRET")));
});

test("database role review rejects privileged membership even when direct attributes are unprivileged", () => {
  const role = {
    rolsuper: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolreplication: false,
    rolbypassrls: false,
  };
  assert.deepEqual(databaseRoleFailures({ ...role, privileged_memberships: [] }), []);
  for (const name of ["pg_read_server_files", "pg_execute_server_program", "privileged-parent"]) {
    assert.deepEqual(databaseRoleFailures({ ...role, privileged_memberships: [name] }), [
      `Database application role belongs to privileged role: ${name}`,
    ]);
  }
});

test("startup checks reject the documented replace-with credential placeholders without printing their values", () => {
  const env = {
    SECRET: "replace-with-a-production-signing-secret",
    DB_PASSWORD: "replace-with-secure-db-password",
    CLI_DIRECTUS_STATIC_TOKEN: "replace-with-admin-token",
  };
  const failures: string[] = [];
  checkEnvironment(env, failures);
  for (const name of Object.keys(env)) assert.ok(failures.some((failure) => failure.startsWith(name + " ")));
  for (const value of Object.values(env)) assert.ok(!failures.join("\n").includes(value));
});
