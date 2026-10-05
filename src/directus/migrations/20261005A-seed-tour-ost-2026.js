import { seedTourOst2026 } from './fixtures/seedTourOst2026.js';

export async function up(knex) {
  const requiredTables = ['event_series', 'events', 'articles', 'events_articles'];
  const available = await Promise.all(requiredTables.map((table) => knex.schema.hasTable(table)));
  const requiredFields = [
    ['events', 'series'],
    ['events', 'geolocation'],
    ['articles', 'profile_stage'],
  ];
  const fieldsAvailable = available.every(Boolean)
    ? await Promise.all(requiredFields.map(([table, field]) => knex.schema.hasColumn(table, field)))
    : [];

  // Directus runs migrations during bootstrap, before the YAML schema import.
  // The post-import seed command will fill this fixture once the tables exist.
  if (available.some((hasTable) => !hasTable) || fieldsAvailable.some((hasField) => !hasField)) {
    console.info('[Tour Ost 2026] Waiting for the schema import before seeding.');
    return;
  }

  await seedTourOst2026(async (sql, values = []) => {
    const result = await knex.raw(sql, values);
    return result.rows;
  });
}

export async function down() {
  // Editorial changes made after seeding cannot safely be removed by rollback.
}
