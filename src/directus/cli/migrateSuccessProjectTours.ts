import pg from "pg";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { parse, stringify } from "yaml";

export const TOUR_MEDIA_FOLDER = "795b5a8b-0419-4fae-9959-a33af1fd2f37";
type Row = Record<string, any>;
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const exists = async (db: pg.Client, table: string): Promise<boolean> =>
  Boolean((await db.query("SELECT to_regclass($1) AS name", [table])).rows[0].name);
const hasColumn = async (db: pg.Client, table: string, column: string): Promise<boolean> =>
  Boolean(
    (
      await db.query(
        "SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass($1) AND attname = $2 AND NOT attisdropped",
        [table, column],
      )
    ).rows.length,
  );
const all = async (db: pg.Client, table: string): Promise<Row[]> =>
  (await exists(db, table)) ? (await db.query(`SELECT * FROM ${quote(table)}`)).rows : [];

export async function readLegacyTours(db: pg.Client) {
  const tours = (await all(db, "event_series")).filter((row) => row.format === "tour");
  const tourIds = new Set(tours.map((row) => row.id));
  const stops = (await all(db, "events")).filter((row) => tourIds.has(row.series));
  const ids = new Set(stops.map((row) => row.id));
  const reports = (await all(db, "event_reports")).filter((row) => ids.has(row.event));
  const orphanReports = (await all(db, "event_reports")).filter((row) => !ids.has(row.event));
  if (orphanReports.length)
    throw new Error(
      "Separate reports outside a tour must be resolved before removing event_reports: " +
        orphanReports.map((row) => row.id).join(", "),
    );
  const news = (await all(db, "news_items")).filter((row) => ids.has(row.report_event));
  for (const stop of stops) {
    const owned = reports.filter((row) => row.event === stop.id);
    const linked = news.filter((row) => row.report_event === stop.id);
    if (
      owned.length > 1 ||
      linked.length > 1 ||
      (owned.length && linked.length && owned[0].source_news_item !== linked[0].id)
    ) {
      throw new Error(`Conflicting report ownership for ${stop.slug}; resolve the linked reports before migration.`);
    }
  }
  return { tours, stops, reports, news };
}

async function insertUnchanged(db: pg.Client, table: string, values: Row): Promise<void> {
  const existing = (await db.query(`SELECT * FROM ${quote(table)} WHERE id = $1`, [values.id])).rows[0];
  if (existing)
    throw new Error(
      `Destination ${table}/${values.id} already exists while its legacy source remains; refusing to overwrite editorial content.`,
    );
  const fields = Object.keys(values);
  await db.query(
    `INSERT INTO ${quote(table)} (${fields.map(quote).join(",")}) VALUES (${fields.map((_, i) => "$" + (i + 1)).join(",")})`,
    fields.map((field) => values[field] ?? null),
  );
}

/** Move exclusively owned report uploads out of anonymous/global file access. */
export async function protectTourFiles(db: pg.Client): Promise<void> {
  await db.query("INSERT INTO directus_folders (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [
    TOUR_MEDIA_FOLDER,
    "tour-report-media",
  ]);
  const { rows: files } = await db.query(
    `SELECT DISTINCT file AS id FROM success_project_tour_media UNION SELECT poster FROM success_project_tour_media WHERE poster IS NOT NULL UNION SELECT image FROM success_project_tour_stops WHERE image IS NOT NULL`,
  );
  const { rows: references } = await db.query(
    `SELECT ns.nspname AS schema, t.relname AS table, a.attname AS column FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.contype='f' AND c.confrelid=to_regclass('directus_files')`,
  );
  for (const file of files) {
    if (!file.id) continue;
    let shared = false;
    for (const ref of references) {
      if (
        ref.table === "success_project_tour_media" ||
        (ref.table === "success_project_tour_stops" && ref.column === "image")
      )
        continue;
      const table = `${quote(ref.schema)}.${quote(ref.table)}`;
      const recoveryFilter =
        ref.table === "news_items"
          ? " AND NOT is_tour_redirect"
          : ref.table === "news_journey_photos"
            ? " AND news_items_id NOT IN (SELECT id FROM news_items WHERE is_tour_redirect)"
            : "";
      if (
        (await db.query(`SELECT 1 FROM ${table} WHERE ${quote(ref.column)} = $1${recoveryFilter} LIMIT 1`, [file.id]))
          .rows.length
      ) {
        shared = true;
        break;
      }
    }
    if (
      !shared &&
      (
        await db.query(
          `SELECT 1 FROM blocks WHERE entity_type <> 'success_project_tour_stops' AND (strpos(props::text, $1) > 0 OR strpos(options::text, $1) > 0) LIMIT 1`,
          [file.id],
        )
      ).rows.length
    )
      shared = true;
    if (!shared) await db.query("UPDATE directus_files SET folder=$1 WHERE id=$2", [TOUR_MEDIA_FOLDER, file.id]);
  }
}

/** Data-only transaction: all schema additions/removals belong to YAML imports. */
export async function migrateSuccessProjectTours(db: pg.Client): Promise<number> {
  await db.query("BEGIN");
  try {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('success-project-tour-migration'))");
    const legacy = await readLegacyTours(db);
    if (!legacy.tours.length) {
      await db.query("COMMIT");
      return 0;
    }
    for (const tour of legacy.tours) {
      await insertUnchanged(
        db,
        "success_project_tours",
        Object.fromEntries(
          [
            "id",
            "slug",
            "title",
            "status",
            "introduction",
            "closing_reflection",
            "cover_image",
            "cover_image_credits",
            "brand_logo",
            "featured_on_projects",
          ].map((key) => [key, tour[key]]),
        ),
      );
    }
    const legacyBlockRelation = await hasColumn(db, "blocks", "event_report");
    let mediaCount = 0;
    let blockCount = 0;
    for (const stop of legacy.stops) {
      const owned = legacy.reports.find((row) => row.event === stop.id);
      const source = owned || legacy.news.find((row) => row.report_event === stop.id);
      const news = legacy.news.find((row) => row.report_event === stop.id);
      const values: Row = Object.fromEntries(
        [
          "id",
          "slug",
          "title",
          "status",
          "location",
          "start_date",
          "end_date",
          "date_only",
          "date_created",
          "date_updated",
          "user_created",
          "user_updated",
          "state",
          "geolocation",
        ].map((key) => [key, stop[key]]),
      );
      Object.assign(values, {
        tour: stop.series,
        sort: stop.series_order,
        visit_details: stop.description,
        itinerary_image: stop.image,
        itinerary_image_credits: stop.image_credits,
        report_status: source?.status || "draft",
        report_title: source?.title || null,
        teaser: source?.teaser,
        author: source?.author,
        date_published: source?.date_published || source?.date_created,
        image: source ? source.image || stop.image : null,
        image_credits: source?.image ? source.image_credits : source ? stop.image_credits : null,
        legacy_report_id: owned?.id,
        source_news_item: news?.id,
      });
      await insertUnchanged(db, "success_project_tour_stops", values);
      const scopes = [owned ? ["event_reports", owned.id] : null, news ? ["news_items", news.id] : null].filter(
        Boolean,
      ) as string[][];
      const activeSources: string[] = [];
      for (const [type, uuid] of scopes) {
        if (
          (
            await db.query(
              "SELECT 1 FROM blocks WHERE entity_type=$1 AND entity_uuid=$2 AND field_name='content' AND status <> 'archived' LIMIT 1",
              [type, uuid],
            )
          ).rows.length
        )
          activeSources.push(type);
      }
      if (activeSources.length > 1)
        throw new Error(
          `Both legacy report sources contain live blocks for ${stop.slug}; refusing to combine different reports.`,
        );
      for (const [type, uuid] of scopes) {
        const moved = await db.query(
          `UPDATE blocks SET entity_type='success_project_tour_stops', entity_uuid=$1::uuid::text, tour_stop=$1::uuid${legacyBlockRelation ? ", event_report=NULL" : ""}, status=CASE WHEN $2='news_items' AND status<>'archived' THEN $4 ELSE status END WHERE entity_type=$2 AND entity_uuid=$3 AND field_name='content'`,
          [stop.id, type, uuid, source?.status === "published" ? "published" : "draft"],
        );
        blockCount += moved.rowCount || 0;
        const existingState = await db.query(
          "SELECT 1 FROM edit_states WHERE entity_type='success_project_tour_stops' AND entity_uuid=$1 LIMIT 1",
          [stop.id],
        );
        const sourceState = await db.query(
          "SELECT 1 FROM edit_states WHERE entity_type=$1 AND entity_uuid=$2 LIMIT 1",
          [type, uuid],
        );
        if (existingState.rows.length && sourceState.rows.length)
          throw new Error(`Conflicting edit states for ${stop.slug}; drafts were not overwritten.`);
        await db.query(
          "UPDATE edit_states SET entity_type='success_project_tour_stops', entity_bundle='success_project_tour_stop', entity_uuid=$1 WHERE entity_type=$2 AND entity_uuid=$3",
          [stop.id, type, uuid],
        );
      }
      if (owned) {
        const copied = await db.query(
          "INSERT INTO success_project_tour_media (id, stop, file, poster, sort, alt, caption, credit) SELECT id, $1, file, poster, sort, alt, caption, credit FROM event_report_media WHERE report=$2",
          [stop.id, owned.id],
        );
        mediaCount += copied.rowCount || 0;
        await resetMediaSequence(db);
      } else if (news) {
        const copied = await db.query(
          "INSERT INTO success_project_tour_media (stop, file, sort, alt, caption, credit) SELECT $1, file, sort, alt, caption, credit FROM news_journey_photos WHERE news_items_id=$2 ORDER BY sort NULLS LAST, id",
          [stop.id, news.id],
        );
        mediaCount += copied.rowCount || 0;
      }
      if (news) {
        const oldMarker = await hasColumn(db, "news_items", "is_event_redirect");
        await db.query(
          `UPDATE news_items SET is_tour_redirect=true, tour_stop=$1, report_event=NULL${oldMarker ? ", is_event_redirect=false" : ""} WHERE id=$2`,
          [stop.id, news.id],
        );
      }
      await db.query(
        "INSERT INTO success_project_tour_stops_articles (id, stop, articles_id) SELECT id, $1, articles_id FROM events_articles WHERE events_id=$1",
        [stop.id],
      );
    }
    // Verify ownership/counts before deleting any sources with cascade relationships.
    const ids = legacy.stops.map((row) => row.id);
    const count = async (table: string, field: string) =>
      Number(
        (await db.query(`SELECT count(*) AS count FROM ${quote(table)} WHERE ${quote(field)}=ANY($1::uuid[])`, [ids]))
          .rows[0].count,
      );
    if (
      (await count("success_project_tour_stops", "id")) !== ids.length ||
      (await count("success_project_tour_media", "stop")) !== mediaCount ||
      (await count("blocks", "tour_stop")) !== blockCount
    )
      throw new Error("Tour transfer verification failed; sources retained.");
    const links = Number(
      (await db.query("SELECT count(*) AS count FROM events_articles WHERE events_id=ANY($1::uuid[])", [ids])).rows[0]
        .count,
    );
    if ((await count("success_project_tour_stops_articles", "stop")) !== links)
      throw new Error("Project relationship verification failed; sources retained.");
    if (await exists(db, "event_reports"))
      await db.query("DELETE FROM event_reports WHERE event=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM events WHERE id=ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM event_series WHERE id=ANY($1::uuid[])", [legacy.tours.map((row) => row.id)]);
    await protectTourFiles(db);
    await resetMediaSequence(db);
    await db.query(
      "SELECT setval(pg_get_serial_sequence('success_project_tour_stops_articles','id'), COALESCE(max(id),1), count(*)>0) FROM success_project_tour_stops_articles",
    );
    await db.query("COMMIT");
    return legacy.stops.length;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}
async function resetMediaSequence(db: pg.Client) {
  await db.query(
    "SELECT setval(pg_get_serial_sequence('success_project_tour_media','id'), COALESCE(max(id),1), count(*)>0) FROM success_project_tour_media",
  );
}

async function yamlFiles(dir: string): Promise<Row[]> {
  const values: Row[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) values.push(...(await yamlFiles(file)));
    else if (entry.name.endsWith(".yaml")) values.push(parse(await readFile(file, "utf8")));
  }
  return values;
}

/** Include both legacy gallery formats so the recovery backup is complete. */
export async function readLegacyTourBackup(db: pg.Client, legacy: Awaited<ReturnType<typeof readLegacyTours>>) {
  const scopes = [...legacy.reports.map((row) => row.id), ...legacy.news.map((row) => row.id)];
  const newsIds = new Set(legacy.news.map((row) => row.id));
  return {
    ...legacy,
    media: await all(db, "event_report_media"),
    journeyPhotos: (await all(db, "news_journey_photos")).filter((row) => newsIds.has(row.news_items_id)),
    projectLinks: (await all(db, "events_articles")).filter((row) =>
      legacy.stops.some((stop) => stop.id === row.events_id),
    ),
    blocks: (await all(db, "blocks")).filter((row) => scopes.includes(row.entity_uuid)),
    editStates: (await all(db, "edit_states")).filter((row) => scopes.includes(row.entity_uuid)),
    files: await all(db, "directus_files"),
  };
}

/** Import an additive snapshot generated from the live schema and final YAML. */
async function prepare(db: pg.Client): Promise<void> {
  const legacy = await readLegacyTours(db);
  if (!legacy.tours.length) return;
  const backup = await readLegacyTourBackup(db, legacy);
  const backupDir = path.join(process.env.STORAGE_LOCAL_ROOT || "/directus/uploads", "migration-backups");
  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `success-project-tours-${Date.now()}.json`);
  await writeFile(backupPath, JSON.stringify(backup), { mode: 0o600 });
  console.info(`[tour migration] Recovery backup: ${backupPath}`);
  const base = process.env.CLI_DIRECTUS_URL || "http://127.0.0.1:8055";
  const response = await fetch(base + "/schema/snapshot", {
    headers: { Authorization: `Bearer ${process.env.CLI_DIRECTUS_STATIC_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Schema snapshot failed (${response.status}).`);
  const snapshot = ((await response.json()) as { data: Row }).data;
  const schemaRoot = new URL("../schema/", import.meta.url);
  const temp = await mkdtemp(path.join(tmpdir(), "slk-tour-schema-"));
  await writeFile(
    path.join(temp, "header.yaml"),
    stringify(
      Object.fromEntries(
        Object.entries(snapshot).filter(([key]) => !["collections", "fields", "relations"].includes(key)),
      ),
    ),
  );
  for (const kind of ["collections", "fields", "relations"]) {
    const desired = await yamlFiles(path.join(schemaRoot.pathname, kind));
    const key = (row: Row) => (kind === "collections" ? row.collection : `${row.collection}:${row.field}`);
    const merged = new Map((snapshot[kind] as Row[]).map((row) => [key(row), row]));
    for (const row of desired) merged.set(key(row), row);
    await mkdir(path.join(temp, kind));
    let index = 0;
    for (const row of merged.values()) await writeFile(path.join(temp, kind, `${index++}.yaml`), stringify(row));
  }
  const imported = spawnSync(
    process.execPath,
    [new URL("./index.mjs", import.meta.url).pathname, "import:schema", temp],
    { stdio: "inherit", env: process.env },
  );
  if (imported.status !== 0) throw new Error("Additive tour schema import failed; no source content was deleted.");
}

export async function runSuccessProjectTourMigration(env = process.env): Promise<number> {
  const db = new pg.Client({
    host: env.DB_HOST || "db",
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  });
  try {
    await db.connect();
    return await migrateSuccessProjectTours(db);
  } finally {
    await db.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = new pg.Client({
    host: process.env.DB_HOST || "db",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  (async () => {
    try {
      await db.connect();
      if (process.argv.includes("--prepare")) await prepare(db);
      else console.info(`[tour migration] ${await migrateSuccessProjectTours(db)} stop(s) migrated.`);
    } finally {
      await db.end();
    }
  })().catch((error) => {
    console.error("[tour migration]", error.message);
    process.exitCode = 1;
  });
}
