import { constants } from 'node:fs';
import { copyFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const fixtureUrl = new URL('./fixtures/tour-ost-2026.json', import.meta.url);
const imageUrl = new URL('./fixtures/tour-ost-2026-keyvisual.png', import.meta.url);

async function ensureImage(knex, imageId) {
  const existing = await knex('directus_files').where({ id: imageId }).first('id');
  if (existing) return;

  const filename = `${imageId}.png`;
  const destination = path.join(process.env.STORAGE_LOCAL_ROOT || '/directus/uploads', filename);

  // Existing uploads belong to the editor; only copy this file if the path is unused.
  try {
    await copyFile(imageUrl, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }

  const publicFolder = await knex('directus_folders').where({ name: 'public' }).first('id');
  const image = await stat(imageUrl);
  await knex('directus_files').insert({
    id: imageId,
    storage: 'local',
    filename_disk: filename,
    filename_download: 'tour-ost-2026-keyvisual.png',
    title: 'Erfolgsprojekte-Tour Ost 2026',
    type: 'image/png',
    filesize: image.size,
    folder: publicFolder?.id ?? null,
  });
}

export async function up(knex) {
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  await ensureImage(knex, fixture.series.cover_image);

  let series = await knex('event_series').where({ slug: fixture.series.slug }).first('id');
  if (!series) {
    await knex('event_series').insert(fixture.series);
    series = { id: fixture.series.id };
  }

  for (const stop of fixture.stops) {
    let event = await knex('events').where({ slug: stop.slug }).first('id');
    if (!event) {
      const { geolocation, ...fields } = stop;
      await knex('events').insert({
        ...fields,
        series: series.id,
        geolocation: knex.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)', geolocation.coordinates),
      });
      event = { id: stop.id };
    }

    const articleSlug = stop.slug.replace(/^erfolgsprojekte-/, 'erfolgsprojekt-');
    let article = await knex('articles').where({ slug: articleSlug }).first('id');
    if (!article) {
      const [id] = await knex('articles').insert({
        slug: articleSlug,
        title: `Erfolgsprojekt in ${stop.location} (Tour Ost 2026)`,
        municipality_name: stop.location,
        state: stop.state,
        status: 'draft',
        profile_stage: 'preview',
        image: fixture.series.cover_image,
        image_credits: '',
        abstract: `Redaktioneller Entwurf für den Tourstopp in ${stop.location}.`,
        article_text: 'Projektbeschreibung ergänzen.',
        sectors: JSON.stringify([]),
      }).returning('id');
      article = { id: typeof id === 'object' ? id.id : id };
    }

    const existingLink = await knex('events_articles')
      .where({ events_id: event.id, articles_id: article.id })
      .first('id');
    if (!existingLink) {
      await knex('events_articles').insert({ events_id: event.id, articles_id: article.id });
    }
  }
}

export async function down() {
  // Editorial changes made after seeding cannot safely be removed by rollback.
}
