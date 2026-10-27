import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseEnvFile } from "./lib/config.js";
import { createAdminClient } from "./lib/directus.js";
import {
  executeTranslationOperation,
  TranslationControlError,
  controlRateLimit,
} from "../../../src/directus/extensions/content-translations/src/index.js";
import { installTranslationOutbox } from "../../../src/directus/cli/installTranslationOutbox.js";
import { contentTranslationKey } from "../../../src/frontend/server/utils/contentTranslation.js";
import { createPersistedTranslationReader } from "../../../src/frontend/server/utils/contentTranslationPersistence.js";
import { collectPublicTranslationSnapshots } from "../../../src/frontend/server/utils/contentTranslationSources.js";
import type { TranslationOperation } from "../../../src/frontend/shared/contentTranslationProtocol.js";

const cli = createRequire(new URL("../../../src/directus/cli/package.json", import.meta.url));
const extension = createRequire(
  new URL("../../../src/directus/extensions/content-translations/package.json", import.meta.url),
);
const pg = cli("pg");
const knexFactory = extension("knex");
const PgDialect = extension("knex/lib/dialects/postgres/index.js");
class TestPgClient extends PgDialect {
  _driver() {
    return pg;
  }
}
const enabled = process.env.SLK_TRANSLATION_DATABASE_TEST === "1";
const backendEnv = () => parseEnvFile(fileURLToPath(new URL("../../../src/directus/.env", import.meta.url)));
const frontendEnv = () => parseEnvFile(fileURLToPath(new URL("../../../src/frontend/.env", import.meta.url)));

test(
  "PostgreSQL outbox, concurrency, durable memory, budgets and uncertain reservations",
  { skip: !enabled, timeout: 90_000 },
  async (t) => {
    const env = backendEnv();
    assert.notEqual(env.SLK_ENV, "production");
    const connection = {
      host: "127.0.0.1",
      port: Number(env.DB_PORT || 5432),
      database: env.DB_DATABASE,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    };
    const pool = new pg.Pool(connection);
    const schema = `slk_translation_test_${randomUUID().replaceAll("-", "")}`;
    let database: Parameters<typeof executeTranslationOperation>[0] | undefined;
    const namespace = `fixture-${randomUUID()}`;
    const key = (text: string) =>
      contentTranslationKey(namespace, "en-GB", { text, format: "text", context: "fixture" });
    try {
      await pool.query(`CREATE SCHEMA "${schema}"`);
      for (const table of [
        "content_translation_jobs",
        "content_translation_memory",
        "content_translation_usage",
        "content_translation_requests",
      ])
        await pool.query(`CREATE TABLE "${schema}".${table} (LIKE public.${table} INCLUDING ALL)`);
      await pool.query(
        `CREATE TABLE "${schema}".pages (id uuid PRIMARY KEY, name text, contents text, status text, sort_order integer)`,
      );
      await pool.query(`CREATE TABLE "${schema}".blocks (id integer PRIMARY KEY, props jsonb, status text)`);
      const installer = await pool.connect();
      try {
        assert.equal(await installTranslationOutbox(installer, schema), 2);
      } finally {
        installer.release();
      }
      database = knexFactory({
        client: TestPgClient,
        connection,
        searchPath: [schema],
        pool: { min: 0, max: 4 },
      }) as Parameters<typeof executeTranslationOperation>[0];
      const db = database;
      const job = () => db("content_translation_jobs").where({ id: "public-content" }).first();
      const usage = async () =>
        Number((await db("content_translation_usage").where({ id: "total" }).first())?.reserved_characters ?? 0);
      const budgets = { total: 10, daily: 10 };
      const operation = (value: TranslationOperation) => executeTranslationOperation(db, value, budgets);
      const pageId = randomUUID();
      await t.test(
        "source mutations and queued revision commit or roll back atomically; technical edits do not wake generation",
        async () => {
          const before = (await job()).revision;
          const source = await pool.connect();
          try {
            await source.query("BEGIN");
            await source.query(
              `INSERT INTO "${schema}".pages (id,name,contents,status) VALUES ($1,'Title','Public body','published')`,
              [pageId],
            );
            const inTransaction = await source.query(`SELECT revision FROM "${schema}".content_translation_jobs`);
            assert.equal(inTransaction.rows[0].revision, before + 1);
            assert.equal((await job()).revision, before, "Uncommitted work is invisible to workers");
            await source.query("ROLLBACK");
            assert.equal((await job()).revision, before);
          } finally {
            source.release();
          }
          await db("pages").insert({ id: pageId, name: "Title", contents: "Public body", status: "published" });
          const created = (await job()).revision;
          assert.equal(created, before + 1);
          await db("pages").where({ id: pageId }).update({ sort_order: 2 });
          assert.equal((await job()).revision, created);
          await db("pages").where({ id: pageId }).update({ contents: "Edited public body" });
          assert.equal((await job()).revision, created + 1);
          await assert.rejects(
            db.transaction(async (trx) => {
              await trx("blocks").insert({ id: 1, props: { text: "Uncommitted block" }, status: "published" });
              throw new Error("fixture rollback");
            }),
          );
          assert.equal(
            (await job()).revision,
            created + 1,
            "Custom block transaction rollback also removes its queue intent",
          );
        },
      );
      let ownership: { owner: string; namespace: string };
      let revision: number;
      await t.test(
        "two workers cannot claim the same lease and duplicate reservations cannot double charge",
        async () => {
          await db("content_translation_jobs").update({ next_run: new Date(0) });
          const owners = [randomUUID(), randomUUID()];
          const claims = await Promise.all(owners.map((owner) => operation({ op: "claim", owner, namespace })));
          const index = claims.findIndex((result: any) => result.lease);
          assert.equal(claims.filter((result: any) => result.lease).length, 1);
          ownership = { owner: owners[index]!, namespace };
          revision = (claims[index] as { lease: { revision: number } }).lease.revision;
          const batch = randomUUID();
          const reserve: TranslationOperation = {
            op: "reserve",
            ...ownership,
            revision,
            batch,
            units: [{ key: key("a"), locale: "en-GB", characters: 6 }],
          };
          await Promise.all([operation(reserve), operation(reserve)]);
          assert.equal(await usage(), 6);
          await assert.rejects(
            operation({
              op: "reserve",
              ...ownership,
              revision,
              batch: randomUUID(),
              units: [{ key: key("over-budget"), locale: "en-GB", characters: 5 }],
            }),
            (error: unknown) => error instanceof TranslationControlError && error.code === "local_character_budget",
          );
          const commit: TranslationOperation = {
            op: "commit",
            ...ownership,
            batch,
            units: [{ key: key("a"), text: "Ready translation", billed: 6 }],
            fields: [{ key: key("field"), locale: "en-GB", format: "html", text: "<p>Ready translation</p>" }],
          };
          await operation(commit);
          await operation(commit);
          assert.equal(
            Number((await db("content_translation_usage").where({ id: "total" }).first()).billed_characters),
            6,
          );
        },
      );
      await t.test(
        "definitive rate rejection refunds a reservation; ambiguous outcomes remain held and cannot be silently retried",
        async () => {
          const safeBatch = randomUUID();
          await operation({
            op: "reserve",
            ...ownership!,
            revision: revision!,
            batch: safeBatch,
            units: [{ key: key("rate"), locale: "en-GB", characters: 3 }],
          });
          assert.equal(await usage(), 9);
          await operation({ op: "failed-batch", ...ownership!, batch: safeBatch, code: "rate" });
          assert.equal(await usage(), 6);
          const uncertain = randomUUID();
          await operation({
            op: "reserve",
            ...ownership!,
            revision: revision!,
            batch: uncertain,
            units: [{ key: key("uncertain"), locale: "en-GB", characters: 3 }],
          });
          await operation({ op: "failed-batch", ...ownership!, batch: uncertain, code: "uncertain" });
          assert.equal(await usage(), 9);
          await assert.rejects(
            operation({
              op: "reserve",
              ...ownership!,
              revision: revision!,
              batch: randomUUID(),
              units: [{ key: key("uncertain"), locale: "en-GB", characters: 3 }],
            }),
            (error: unknown) => error instanceof TranslationControlError && error.code === "units_unavailable",
          );
          const crash = randomUUID();
          await operation({
            op: "reserve",
            ...ownership!,
            revision: revision!,
            batch: crash,
            units: [{ key: key("crash"), locale: "en-GB", characters: 1 }],
          });
          await db("content_translation_jobs").update({ lease_until: new Date(0), next_run: new Date(0) });
          ownership = { owner: randomUUID(), namespace };
          await operation({ op: "claim", ...ownership });
          assert.equal(
            (
              await db("content_translation_memory")
                .where({ id: key("crash") })
                .first()
            ).state,
            "uncertain",
          );
          assert.equal(await usage(), 10);
          const independent = knexFactory({
            client: TestPgClient,
            connection,
            searchPath: [schema],
            pool: { min: 0, max: 1 },
          });
          try {
            assert.equal(
              (
                await independent("content_translation_memory")
                  .where({ id: key("a") })
                  .first()
              ).state,
              "ready",
            );
            assert.equal(
              Number(
                (await independent("content_translation_usage").where({ id: "total" }).first()).reserved_characters,
              ),
              10,
            );
          } finally {
            await independent.destroy();
          }
        },
      );
      await t.test(
        "a committed source edit invalidates an old generation plan before quota can be reserved",
        async () => {
          const oldRevision = (await job()).revision;
          await db("pages").where({ id: pageId }).delete();
          assert.equal((await job()).revision, oldRevision + 1);
          await assert.rejects(
            operation({
              op: "reserve",
              ...ownership!,
              revision: oldRevision,
              batch: randomUUID(),
              units: [{ key: key("stale"), locale: "en-GB", characters: 1 }],
            }),
            (error: unknown) => error instanceof TranslationControlError && error.code === "source_changed",
          );
          assert.equal(await usage(), 10);
        },
      );
      await t.test("the central five-write limit is atomic across concurrent requests", async () => {
        const actor = randomUUID();
        const requests = await Promise.allSettled(Array.from({ length: 10 }, () => controlRateLimit(db, actor)));
        assert.equal(requests.filter((result) => result.status === "fulfilled").length, 5);
        assert.equal(requests.filter((result) => result.status === "rejected").length, 5);
      });
    } finally {
      if (database) await database.destroy();
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await pool.end();
    }
  },
);

test(
  "live Directus denies anonymous/public/editor translation access and isolates field reader from worker capabilities",
  { skip: !enabled, timeout: 60_000 },
  async () => {
    const env = backendEnv();
    const front = frontendEnv();
    for (const name of [
      "DIRECTUS_FRONTEND_SERVER_TOKEN",
      "DIRECTUS_FRONTEND_PUBLIC_TOKEN",
      "DIRECTUS_PREVIEW_TOKEN",
      "CONTENT_TRANSLATION_WORKER_TOKEN",
    ]) {
      assert(front[name], `Missing local test identity: ${name}`);
    }
    const base = "http://localhost:8081";
    const admin = await createAdminClient(base, env);
    const namespace = `fixture-${randomUUID()}`;
    const key = (text: string) =>
      contentTranslationKey(namespace, "en-GB", { text, format: "text", context: "fixture" });
    const fieldId = key("field");
    const unitId = key("unit");
    const marker = `PRIVATE-TRANSLATION-${randomUUID()}`;
    let editorId: string | undefined;
    try {
      const role = await admin.request<{ id: string }[]>("GET", "/roles", {
        query: { filter: JSON.stringify({ name: { _eq: "BlokkliEditor" } }), fields: "id" },
      });
      assert.equal(role.length, 1);
      const personalToken = `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
      const editor = await admin.createUser<{ id: string }>({
        email: `translation-${randomUUID()}@stadt-land-klima.de`,
        role: role[0]!.id,
        token: personalToken,
        status: "active",
        password: `SLK!${randomUUID()}`,
      });
      editorId = editor.id;
      for (const [id, kind] of [
        [fieldId, "field"],
        [unitId, "unit"],
      ])
        await admin.createItem("content_translation_memory", {
          id,
          namespace,
          kind,
          locale: "en-GB",
          format: "text",
          state: "ready",
          translated_text: marker,
          reserved_characters: 0,
          billed_characters: 0,
          attempts: 0,
          updated_at: new Date().toISOString(),
        });
      for (const token of [
        undefined,
        front.DIRECTUS_FRONTEND_PUBLIC_TOKEN,
        front.DIRECTUS_PREVIEW_TOKEN,
        personalToken,
      ]) {
        const response = await fetch(`${base}/items/content_translation_memory?limit=1`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        assert.equal(response.status, 403);
        assert(!(await response.text()).includes(marker));
      }
      const reader = createPersistedTranslationReader(base, front.DIRECTUS_FRONTEND_SERVER_TOKEN!, namespace, true);
      const fields = await reader.getMany([fieldId, unitId], new AbortController().signal);
      assert.equal(fields.get(fieldId), marker);
      assert.equal(fields.has(unitId), false, "Field-reader policy cannot read unit memory");
      const rawFields = await fetch(
        `${base}/items/content_translation_memory?${new URLSearchParams({
          fields: "id,translated_text",
          filter: JSON.stringify({ id: { _in: [fieldId, unitId] } }),
        })}`,
        { headers: { Authorization: `Bearer ${front.DIRECTUS_FRONTEND_SERVER_TOKEN}` } },
      );
      assert.equal(rawFields.status, 200);
      assert.deepEqual(
        ((await rawFields.json()) as { data: { id: string }[] }).data.map((row) => row.id),
        [fieldId],
        "Directus policy itself filters units even when the caller omits the kind filter",
      );
      const workerHeaders = { Authorization: `Bearer ${front.CONTENT_TRANSLATION_WORKER_TOKEN}` };
      const query = new URLSearchParams({ namespace, keys: `${fieldId},${unitId}` });
      const workerRead = await fetch(`${base}/content-translations/memory?${query}`, { headers: workerHeaders });
      assert.equal(workerRead.status, 200);
      assert.equal(((await workerRead.json()) as { rows: unknown[] }).rows.length, 2);
      const denied = await fetch(`${base}/content-translations`, {
        method: "POST",
        headers: { ...workerHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ op: "enqueue" }),
      });
      assert.equal(denied.status, 403, "Only operators may enqueue namespace changes or rebill uncertain work");
      const standardRead = await fetch(`${base}/items/pages?limit=1`, { headers: workerHeaders });
      assert.equal(standardRead.status, 403, "Worker cannot read raw source collections");
      for (const token of [
        undefined,
        front.DIRECTUS_FRONTEND_SERVER_TOKEN,
        front.DIRECTUS_PREVIEW_TOKEN,
        personalToken,
      ]) {
        const response = await fetch(`${base}/content-translations/memory?${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        assert.equal(response.status, 403);
        assert(!(await response.text()).includes(marker));
      }
    } finally {
      if (editorId) await admin.deleteUser(editorId).catch(() => {});
      await admin.deleteItem("content_translation_memory", fieldId).catch(() => {});
      await admin.deleteItem("content_translation_memory", unitId).catch(() => {});
    }
  },
);

test(
  "live source inventory traverses all checked routes without sending provider traffic",
  { skip: !enabled, timeout: 180_000 },
  async (t) => {
    const front = frontendEnv();
    const snapshots: string[] = [];
    let lastPath = "starting";
    t.after(() => {
      t.diagnostic(`Checked ${snapshots.length} public sources; last request ${lastPath}`);
    });
    for await (const snapshot of collectPublicTranslationSnapshots({
      records: async (collection, fields, filter) => {
        const result: Record<string, unknown>[] = [];
        for (let offset = 0; ; offset += 1000) {
          const query = new URLSearchParams({
            fields: fields.join(","),
            filter: JSON.stringify(filter),
            sort: "id",
            limit: "1000",
            offset: String(offset),
          });
          lastPath = `/items/${collection}`;
          const response = await fetch(`http://127.0.0.1:8081/items/${collection}?${query}`, {
            headers: { Authorization: `Bearer ${front.DIRECTUS_FRONTEND_SERVER_TOKEN}` },
            signal: AbortSignal.any([t.signal, AbortSignal.timeout(15_000)]),
          });
          assert.equal(response.status, 200, `Private source enumeration for ${collection}`);
          const rows = ((await response.json()) as { data: Record<string, unknown>[] }).data;
          result.push(...rows);
          if (rows.length < 1000) return result;
          assert(offset < 20_000, "Inventory is bounded");
        }
      },
      fetch: async (path) => {
        const url = new URL(path, "http://127.0.0.1:8080");
        lastPath = url.pathname;
        url.searchParams.set("contentLocale", "de-DE");
        const response = await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.any([t.signal, AbortSignal.timeout(15_000)]),
        });
        if (response.status === 404 || (response.status >= 300 && response.status < 400)) return undefined;
        assert.equal(response.status, 200, `Checked public source ${url.pathname}`);
        return (await response.json()) as unknown;
      },
    }))
      snapshots.push(snapshot.path);
    assert(snapshots.length > 10);
    assert(snapshots.some((path) => path.startsWith("/api/public/measures/")));
  },
);
