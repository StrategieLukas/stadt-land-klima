import pg from "pg";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { CONTENT_TRANSLATION_SOURCE_FIELDS } from "./shared/contentTranslationSources.ts";

/** PostgreSQL triggers cannot be expressed by Directus schema YAML. The importer installs
 * this maintained DDL after the YAML tables, covering ordinary, bulk and custom block writes.
 * Enqueueing and the source mutation commit/roll back together, including deletions.
 */
export async function installTranslationOutbox(client: Pick<pg.PoolClient, "query">, schemaName = "public") {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schemaName)) throw new Error("Invalid outbox schema");
  const schema = pg.escapeIdentifier(schemaName);
  await client.query("BEGIN");
  try {
    await client.query(`
      CREATE OR REPLACE FUNCTION ${schema}.slk_translation_dirty() RETURNS trigger
      LANGUAGE plpgsql SET search_path = pg_catalog, ${schema} AS $body$
      DECLARE before_fields jsonb; after_fields jsonb;
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          SELECT jsonb_object_agg(key, value) INTO before_fields FROM jsonb_each(to_jsonb(OLD)) WHERE key = ANY(TG_ARGV);
          SELECT jsonb_object_agg(key, value) INTO after_fields FROM jsonb_each(to_jsonb(NEW)) WHERE key = ANY(TG_ARGV);
          IF before_fields IS NOT DISTINCT FROM after_fields THEN RETURN NEW; END IF;
        END IF;
        INSERT INTO ${schema}.content_translation_jobs AS queue (id, revision, next_run, attempts)
          VALUES ('public-content', 1, clock_timestamp() + interval '30 seconds', 0)
          ON CONFLICT (id) DO UPDATE SET revision = queue.revision + 1,
            next_run = clock_timestamp() + interval '30 seconds';
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
      $body$;
      REVOKE ALL ON FUNCTION ${schema}.slk_translation_dirty() FROM PUBLIC;
    `);
    let installed = 0;
    for (const [collection, fields] of Object.entries(CONTENT_TRANSLATION_SOURCE_FIELDS)) {
      const found = await client.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2",
        [schemaName, collection],
      );
      if (!found.rows.length) continue;
      const existing = new Set(found.rows.map((row) => row.column_name));
      const tracked = fields.filter((field) => existing.has(field));
      if (!tracked.length) continue;
      const table = pg.escapeIdentifier(collection);
      const args = tracked.map((field) => pg.escapeLiteral(field)).join(", ");
      await client.query(`DROP TRIGGER IF EXISTS slk_translation_dirty ON ${schema}.${table}`);
      await client.query(
        `CREATE TRIGGER slk_translation_dirty AFTER INSERT OR UPDATE OR DELETE ON ${schema}.${table} FOR EACH ROW EXECUTE FUNCTION ${schema}.slk_translation_dirty(${args})`,
      );
      installed++;
    }
    await client.query(
      `INSERT INTO ${schema}.content_translation_jobs AS queue (id, revision, next_run, attempts) VALUES ('public-content', 1, CURRENT_TIMESTAMP + interval '30 seconds', 0) ON CONFLICT (id) DO UPDATE SET revision=queue.revision+1, next_run=EXCLUDED.next_run`,
    );
    await client.query("COMMIT");
    return installed;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10_000,
  });
  const connection = await pool.connect();
  try {
    console.info(`Translation outbox installed for ${await installTranslationOutbox(connection)} source collections.`);
  } finally {
    connection.release();
    await pool.end();
  }
}
