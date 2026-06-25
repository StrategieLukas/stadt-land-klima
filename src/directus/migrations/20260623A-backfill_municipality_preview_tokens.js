import { randomUUID } from 'node:crypto';

function createPreviewToken() {
  return `${randomUUID()}${randomUUID()}`.replace(/-/g, '');
}

export async function up(knex) {
  const municipalities = await knex('municipalities')
    .select('id')
    .where((builder) => {
      builder.whereNull('creator_verified').orWhere('creator_verified', false);
    })
    .where((builder) => {
      builder.whereNull('preview_token').orWhere('preview_token', '');
    });

  for (const municipality of municipalities) {
    await knex('municipalities')
      .where({ id: municipality.id })
      .update({ preview_token: createPreviewToken() });
  }
}

export async function down() {}
