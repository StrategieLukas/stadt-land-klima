import { constants } from 'node:fs';
import { copyFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const fixtureUrl = new URL('./tour-ost-2026.json', import.meta.url);
const imageUrl = new URL('./tour-ost-2026-keyvisual.png', import.meta.url);

export async function seedTourOst2026(query) {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  const imageId = fixture.series.cover_image;
  const existingFiles = await query('SELECT id FROM directus_files WHERE id = ? LIMIT 1', [imageId]);

  if (!existingFiles.length) {
    const filename = `${imageId}.png`;
    const destination = path.join(process.env.STORAGE_LOCAL_ROOT || '/directus/uploads', filename);
    try {
      await copyFile(imageUrl, destination, constants.COPYFILE_EXCL);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }

    const publicFolders = await query('SELECT id FROM directus_folders WHERE name = ? LIMIT 1', ['public']);
    const image = await stat(imageUrl);
    await query(
      'INSERT INTO directus_files (id, storage, filename_disk, filename_download, title, type, filesize, folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [imageId, 'local', filename, 'tour-ost-2026-keyvisual.png', fixture.series.title, 'image/png', image.size, publicFolders[0]?.id ?? null],
    );
  }

  const seriesRows = await query('SELECT id FROM event_series WHERE slug = ? LIMIT 1', [fixture.series.slug]);
  const seriesId = seriesRows[0]?.id ?? fixture.series.id;
  if (!seriesRows.length) {
    const series = fixture.series;
    await query(
      'INSERT INTO event_series (id, slug, title, introduction, format, status, featured_on_projects, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [seriesId, series.slug, series.title, series.introduction, series.format, series.status, series.featured_on_projects, imageId],
    );
  }

  for (const stop of fixture.stops) {
    const eventRows = await query('SELECT id FROM events WHERE slug = ? LIMIT 1', [stop.slug]);
    const eventId = eventRows[0]?.id ?? stop.id;
    if (!eventRows.length) {
      await query(
        'INSERT INTO events (id, slug, title, description, event_type, status, start_date, date_only, location, series_order, state, geolocation, series) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?)',
        [stop.id, stop.slug, stop.title, stop.description, stop.event_type, stop.status, stop.start_date, stop.date_only, stop.location, stop.series_order, stop.state, ...stop.geolocation.coordinates, seriesId],
      );
    }

    const articleSlug = stop.slug.replace(/^erfolgsprojekte-/, 'erfolgsprojekt-');
    const articleRows = await query('SELECT id FROM articles WHERE slug = ? LIMIT 1', [articleSlug]);
    let articleId = articleRows[0]?.id;
    if (!articleId) {
      const created = await query(
        'INSERT INTO articles (slug, title, municipality_name, state, status, profile_stage, image, image_credits, abstract, article_text, sectors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
        [articleSlug, `Erfolgsprojekt in ${stop.location} (Tour Ost 2026)`, stop.location, stop.state, 'draft', 'preview', imageId, '', `Redaktioneller Entwurf für den Tourstopp in ${stop.location}.`, 'Projektbeschreibung ergänzen.', JSON.stringify([])],
      );
      articleId = created[0].id;
    }

    const links = await query('SELECT id FROM events_articles WHERE events_id = ? AND articles_id = ? LIMIT 1', [eventId, articleId]);
    if (!links.length) {
      await query('INSERT INTO events_articles (events_id, articles_id) VALUES (?, ?)', [eventId, articleId]);
    }
  }
}
