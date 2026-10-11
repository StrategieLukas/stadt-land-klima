import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

/** Data migration only; schema and permissions are imported from YAML first. */
export async function migrateTourReports(client: pg.Client, dryRun = false): Promise<number> {
  await client.query('BEGIN');
  try {
    // Lock sources so simultaneous imports cannot transfer the same report twice.
    const { rows: sources } = await client.query(`
      SELECT n.* FROM news_items n
      JOIN events e ON e.id = n.report_event
      JOIN event_series s ON s.id = e.series
      WHERE s.format = 'tour' AND NOT n.is_event_redirect
      ORDER BY n.id FOR UPDATE OF n
    `);
    let migrated = 0;
    for (const source of sources) {
      const existing = await client.query('SELECT id FROM event_reports WHERE event = $1', [source.report_event]);
      if (existing.rows.length) {
        // An editor-created report wins; do not overwrite it or redirect its source.
        console.info(`[tour reports] Skipping existing report for ${source.slug}`);
        continue;
      }
      if (dryRun) { migrated++; continue; }
      const reportId = randomUUID();
      await client.query(`INSERT INTO event_reports
        (id, event, source_news_item, status, title, teaser, author, date_published, image, image_credits)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
        reportId, source.report_event, source.id, source.status, source.title, source.teaser,
        source.author, source.date_published || source.date_created, source.image, source.image_credits,
      ]);
      // Keep UUIDs, nested props, ordering and archived history. Legacy published
      // news rendered all non-archived blocks, including rows still marked draft.
      await client.query(`UPDATE blocks SET entity_type = 'event_reports', entity_uuid = $1::uuid::text, event_report = $1::uuid,
        status = CASE WHEN status = 'archived' THEN status ELSE $3 END
        WHERE entity_type = 'news_items' AND entity_uuid = $2 AND field_name = 'content'`,
      [reportId, source.id, source.status === 'published' ? 'published' : 'draft']);
      await client.query(`INSERT INTO event_report_media (report, file, sort, alt, caption, credit)
        SELECT $1, file, sort, alt, caption, credit FROM news_journey_photos
        WHERE news_items_id = $2 ORDER BY sort NULLS LAST, id`, [reportId, source.id]);
      await client.query('UPDATE news_items SET is_event_redirect = true WHERE id = $1', [source.id]);
      migrated++;
    }
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return migrated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function runTourReportMigration(env = process.env, dryRun = false): Promise<number> {
  const client = new pg.Client({ host: env.DB_HOST || 'db', port: Number(env.DB_PORT || 5432),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_DATABASE });
  try {
    await client.connect();
    return await migrateTourReports(client, dryRun);
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTourReportMigration(process.env, process.argv.includes('--dry-run'))
    .then(count => console.info(`[tour reports] ${count} report(s) ${process.argv.includes('--dry-run') ? 'would be migrated' : 'migrated'}`))
    .catch(error => { console.error('[tour reports] Migration failed:', error); process.exitCode = 1; });
}
