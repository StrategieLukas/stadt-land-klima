import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";
import { promisify } from "node:util";
import pg from "pg";
import { parse } from "yaml";
import { z } from "zod";
import { checkDatabaseRole } from "../security/startupChecks.js";
import { applyDatabaseRole, planDatabaseRole } from "../tasks/hardenDatabaseRole.ts";

const execute = promisify(execFile);

test(
  "isolated PostgreSQL cutover preserves spatial data/operator, rejects drift and rolls back failures",
  {
    skip: process.env.SLK_DATABASE_ROLE_TEST !== "1",
    timeout: 90_000,
  },
  async () => {
    const image = z
      .object({ services: z.object({ db: z.object({ image: z.string() }) }) })
      .parse(parse(readFileSync(new URL("../../../../docker-compose.yaml", import.meta.url), "utf8"))).services
      .db.image;
    const name = `slk-role-test-${randomUUID()}`;
    const password = randomBytes(32).toString("hex");
    let pool: pg.Pool | undefined;
    try {
      await execute(
        "docker",
        [
          "run",
          "-d",
          "--name",
          name,
          "--env",
          "POSTGRES_PASSWORD",
          "--env",
          "POSTGRES_DB=slk_role_test",
          "--env",
          "POSTGRES_USER=postgres",
          "--publish",
          "127.0.0.1::5432",
          "--tmpfs",
          "/var/lib/postgresql/data:rw,nosuid,size=256m",
          image,
        ],
        { env: { ...process.env, POSTGRES_PASSWORD: password } },
      );
      const port = Number((await execute("docker", ["port", name, "5432/tcp"])).stdout.trim().split(":").at(-1));
      const config = {
        host: "127.0.0.1",
        port,
        database: "slk_role_test",
        user: "postgres",
        password,
        connectionTimeoutMillis: 1000,
      };
      pool = new pg.Pool(config);
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          await pool.query("SELECT 1");
          ready = true;
          break;
        } catch {
          await setTimeout(500);
        }
      }
      assert.ok(ready, "disposable database did not become ready");
      const client = await pool.connect();
      try {
        await client.query(`CREATE EXTENSION IF NOT EXISTS postgis;
        CREATE TABLE directus_users(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name text);
        INSERT INTO directus_users(name) VALUES ('existing');
        CREATE TYPE publication_state AS ENUM ('draft','published');
        CREATE TABLE places(id serial PRIMARY KEY, state publication_state, location geometry(Point,4326));
        INSERT INTO places(state,location) VALUES ('published',ST_SetSRID(ST_MakePoint(13,52),4326));
        CREATE VIEW published_places AS SELECT * FROM places WHERE state='published';
        CREATE FUNCTION public.app_double(n integer) RETURNS integer LANGUAGE SQL IMMUTABLE AS 'SELECT n*2';`);
        const operator = (await client.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0];
        const extensionOwner = (
          await client.query("SELECT relowner FROM pg_class WHERE oid='spatial_ref_sys'::regclass")
        ).rows[0];
        const plan = await planDatabaseRole(client, "slk_app");
        assert.equal((await client.query("SELECT count(*) FROM pg_roles WHERE rolname='slk_app'")).rows[0]?.count, "0");
        await client.query("ALTER TABLE places ADD COLUMN drift text");
        await assert.rejects(applyDatabaseRole(client, plan), /inventory changed/);
        assert.equal((await client.query("SELECT count(*) FROM pg_roles WHERE rolname='slk_app'")).rows[0]?.count, "0");
        const fresh = await planDatabaseRole(client, "slk_app");
        await assert.rejects(
          applyDatabaseRole(client, { ...fresh, snapshot: { ...fresh.snapshot, system: "wrong-server" } }),
          /inventory changed/,
        );
        await assert.rejects(applyDatabaseRole(client, { ...fresh, role: "app; GRANT SUPERUSER" }));
        const other = new pg.Pool(config);
        try {
          await other.query("SELECT 1");
          await assert.rejects(applyDatabaseRole(client, fresh), /Other database sessions remain/);
        } finally {
          await other.end();
        }
        const failing = new Proxy(client, {
          get(target, property) {
            const value: unknown = Reflect.get(target, property);
            if (property !== "query" || typeof value !== "function") return value;
            return (query: unknown, ...parameters: unknown[]) => {
              if (typeof query === "string" && query.startsWith("ALTER VIEW"))
                throw new Error("fixture ownership failure");
              return Reflect.apply(value, target, [query, ...parameters]);
            };
          },
        });
        await assert.rejects(applyDatabaseRole(failing, fresh), /fixture ownership failure/);
        assert.equal(
          (await client.query("SELECT count(*) FROM pg_roles WHERE rolname='slk_app'")).rows[0]?.count,
          "0",
          "role creation rolled back",
        );
        assert.equal(
          (await client.query("SELECT pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid='places'::regclass"))
            .rows[0]?.owner,
          "postgres",
        );
        await applyDatabaseRole(client, fresh);
        assert.deepEqual(
          (await client.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0],
          operator,
        );
        assert.deepEqual(
          (await client.query("SELECT relowner FROM pg_class WHERE oid='spatial_ref_sys'::regclass")).rows[0],
          extensionOwner,
        );
        const app = new pg.Pool({ ...config, user: fresh.role, password: fresh.password });
        try {
          const attributes = (
            await app.query(`SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls
          FROM pg_roles WHERE rolname=current_user`)
          ).rows[0];
          assert.deepEqual(attributes, {
            rolsuper: false,
            rolcreatedb: false,
            rolcreaterole: false,
            rolreplication: false,
            rolbypassrls: false,
          });
          assert.equal(
            (
              await app.query(
                "SELECT count(*) FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)",
              )
            ).rows[0]?.count,
            "0",
          );
          assert.equal(
            (await app.query("SELECT ST_X(location) AS x, app_double(3) AS value FROM published_places")).rows[0]?.x,
            13,
          );
          await app.query(
            "INSERT INTO directus_users(name) VALUES ('new'); INSERT INTO places(state) VALUES ('draft'); ALTER TABLE places ADD COLUMN migrated boolean; CREATE TABLE migration_fixture(id integer); DROP TABLE migration_fixture",
          );
          await assert.rejects(app.query("CREATE ROLE escalation SUPERUSER"), /permission denied/);
          await assert.rejects(app.query("SELECT * FROM pg_authid"), /permission denied/);
          await assert.rejects(app.query("DROP EXTENSION postgis"), /must be owner/);
          await client.query("ALTER DATABASE slk_role_test OWNER TO slk_app");
          try {
            const failures: string[] = [];
            await checkDatabaseRole(app, failures);
            assert.ok(
              failures.some((failure) => failure.endsWith(": pg_database_owner")),
              "the runtime identity must not silently become the database owner",
            );
          } finally {
            await client.query("ALTER DATABASE slk_role_test OWNER TO postgres");
          }
          const cleanFailures: string[] = [];
          await checkDatabaseRole(app, cleanFailures);
          assert.deepEqual(cleanFailures, []);
          await client.query(
            "CREATE ROLE privileged_parent; GRANT pg_read_server_files TO privileged_parent; GRANT privileged_parent TO slk_app",
          );
          try {
            const failures: string[] = [];
            await checkDatabaseRole(app, failures);
            assert.ok(
              failures.some((failure) => failure.endsWith(": pg_read_server_files")),
              "nested server-file access must block production startup",
            );
          } finally {
            await client.query("REVOKE privileged_parent FROM slk_app; DROP ROLE privileged_parent");
          }
          await client.query("CREATE ROLE privileged_creator CREATEROLE; GRANT privileged_creator TO slk_app");
          try {
            const failures: string[] = [];
            await checkDatabaseRole(app, failures);
            assert.ok(
              failures.some((failure) => failure.endsWith(": privileged_creator")),
              "membership of a role with elevated attributes must be rejected",
            );
          } finally {
            await client.query("REVOKE privileged_creator FROM slk_app; DROP ROLE privileged_creator");
          }
        } finally {
          await app.end();
        }
        const dump = await execute(
          "docker",
          ["exec", name, "sh", "-ec", 'exec pg_dump --clean -U "$POSTGRES_USER" -d slk_role_test'],
          { maxBuffer: 8 * 1024 * 1024 },
        );
        assert.match(dump.stdout, /COPY public.directus_users/);
        assert.match(dump.stdout, /existing/);
        await assert.rejects(applyDatabaseRole(client, fresh), /already exists/);
      } finally {
        client.release();
      }
    } finally {
      await pool?.end();
      await execute("docker", ["rm", "-f", name]).catch(() => undefined);
    }
  },
);
