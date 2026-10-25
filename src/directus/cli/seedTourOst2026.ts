import pg from "pg";
import { constants } from "node:fs";
import { copyFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TOUR_MEDIA_FOLDER } from "./migrateSuccessProjectTours.js";

/** Seed native tour records after YAML import; never recreate legacy events. */
export async function seedSuccessProjectTour(db: pg.Client): Promise<void> {
  await db.query("INSERT INTO directus_folders (id,name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING", [
    TOUR_MEDIA_FOLDER,
    "tour-report-media",
  ]);
  const fixture = JSON.parse(
    await readFile(new URL("../migrations/fixtures/success-project-tour-ost-2026.json", import.meta.url), "utf8"),
  );
  const imageId = fixture.tour.cover_image;
  if (!(await db.query("SELECT id FROM directus_files WHERE id=$1", [imageId])).rows.length) {
    const source = new URL("../migrations/fixtures/tour-ost-2026-keyvisual.png", import.meta.url);
    const filename = `${imageId}.png`;
    try {
      await copyFile(
        source,
        path.join(process.env.STORAGE_LOCAL_ROOT || "/directus/uploads", filename),
        constants.COPYFILE_EXCL,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const folder = (await db.query("SELECT id FROM directus_folders WHERE name='public' LIMIT 1")).rows[0]?.id;
    await db.query(
      "INSERT INTO directus_files (id,storage,filename_disk,filename_download,title,type,filesize,folder) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        imageId,
        "local",
        filename,
        "tour-ost-2026-keyvisual.png",
        fixture.tour.title,
        "image/png",
        (await stat(source)).size,
        folder,
      ],
    );
  }
  const existing = (await db.query("SELECT id FROM success_project_tours WHERE slug=$1", [fixture.tour.slug])).rows[0];
  const tourId = existing?.id || fixture.tour.id;
  if (!existing)
    await db.query(
      "INSERT INTO success_project_tours (id,slug,title,introduction,status,featured_on_projects,cover_image) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        tourId,
        fixture.tour.slug,
        fixture.tour.title,
        fixture.tour.introduction,
        fixture.tour.status,
        fixture.tour.featured_on_projects,
        imageId,
      ],
    );
  for (const stop of fixture.stops) {
    const row = (await db.query("SELECT id FROM success_project_tour_stops WHERE slug=$1", [stop.slug])).rows[0];
    const id = row?.id || stop.id;
    if (!row)
      await db.query(
        "INSERT INTO success_project_tour_stops (id,tour,slug,title,visit_details,status,report_status,start_date,date_only,location,state,sort,geolocation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,ST_SetSRID(ST_MakePoint($13,$14),4326))",
        [
          id,
          tourId,
          stop.slug,
          stop.title,
          stop.visit_details,
          stop.status,
          "draft",
          stop.start_date,
          stop.date_only,
          stop.location,
          stop.state,
          stop.sort,
          ...stop.geolocation.coordinates,
        ],
      );
    const slug = stop.slug.replace(/^erfolgsprojekte-/, "erfolgsprojekt-");
    let article = (await db.query("SELECT id FROM articles WHERE slug=$1", [slug])).rows[0];
    if (!article)
      article = (
        await db.query(
          "INSERT INTO articles (slug,title,municipality_name,state,status,profile_stage,image,image_credits,abstract,article_text,sectors) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
          [
            slug,
            `Erfolgsprojekt in ${stop.location} (Tour Ost 2026)`,
            stop.location,
            stop.state,
            "draft",
            "preview",
            imageId,
            "",
            `Redaktioneller Entwurf für den Tourstopp in ${stop.location}.`,
            "Projektbeschreibung ergänzen.",
            JSON.stringify([]),
          ],
        )
      ).rows[0];
    if (
      !(
        await db.query("SELECT id FROM success_project_tour_stops_articles WHERE stop=$1 AND articles_id=$2", [
          id,
          article.id,
        ])
      ).rows.length
    )
      await db.query("INSERT INTO success_project_tour_stops_articles (stop,articles_id) VALUES ($1,$2)", [
        id,
        article.id,
      ]);
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
      await db.query("BEGIN");
      await seedSuccessProjectTour(db);
      await db.query("COMMIT");
      console.info("Native Tour Ost 2026 fixture imported");
    } catch (error) {
      await db.query("ROLLBACK").catch(() => {});
      console.error("Tour fixture import failed:", (error as Error).message);
      process.exitCode = 1;
    } finally {
      await db.end();
    }
  })();
}
