/**
 * Move Blökkli ownership from mutable slugs to immutable Directus UUIDs.
 *
 * Blocks with a create activity older than the currently matching entity are
 * deliberately left on their legacy slug. They belong to a deleted/replaced
 * entity and must not be resurrected on the new entity that reused the slug.
 */
export async function up(knex) {
  const entityTables = ["pages", "news_items"];

  for (const entityTable of entityTables) {
    const result = await knex.raw(
      `
        WITH unambiguous_entities AS (
          SELECT MIN(id::text) AS id, slug, MIN(date_created) AS date_created
          FROM ??
          WHERE slug IS NOT NULL AND btrim(slug) <> ''
          GROUP BY slug
          HAVING COUNT(*) = 1
        )
        UPDATE blocks AS block
        SET entity_uuid = entity.id
        FROM unambiguous_entities AS entity
        WHERE block.entity_type = ?
          AND block.entity_uuid = entity.slug
          AND (
            entity.date_created IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM directus_activity AS activity
              WHERE activity.collection = 'blocks'
                AND activity.action = 'create'
                AND activity.item = block.id::text
                AND activity.timestamp < entity.date_created
            )
          )
        RETURNING block.id
      `,
      [entityTable, entityTable],
    );

    const migratedBlocks = result.rows?.length ?? 0;
    console.info(
      `[blokkli migration] ${entityTable}: migrated ${migratedBlocks} block rows to immutable entity IDs`,
    );

    await knex.raw(
      `
        WITH unambiguous_entities AS (
          SELECT MIN(id::text) AS id, slug
          FROM ??
          WHERE slug IS NOT NULL AND btrim(slug) <> ''
          GROUP BY slug
          HAVING COUNT(*) = 1
        )
        UPDATE edit_states AS edit_state
        SET entity_uuid = entity.id
        FROM unambiguous_entities AS entity
        WHERE edit_state.entity_type = ?
          AND edit_state.entity_uuid = entity.slug
      `,
      [entityTable, entityTable],
    );
  }

  const legacyRows = await knex("blocks")
    .whereIn("entity_type", entityTables)
    .whereNot("entity_uuid", "~", "^[0-9a-fA-F-]{36}$")
    .count("id as count")
    .first();
  console.info(
    `[blokkli migration] left ${Number(legacyRows?.count ?? 0)} ambiguous or orphaned block rows on legacy slugs for manual audit`,
  );

  // Old edit states never contained recoverable drafts. If concurrent records
  // exist, retain the newest lock before enforcing one state per entity.
  await knex.raw(`
    DELETE FROM edit_states AS older
    USING edit_states AS newer
    WHERE older.entity_type = newer.entity_type
      AND older.entity_uuid = newer.entity_uuid
      AND older.id < newer.id
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS edit_states_entity_unique
    ON edit_states (entity_type, entity_uuid)
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS blocks_entity_content_order
    ON blocks (entity_type, entity_uuid, field_name, sort_order)
  `);
}

export async function down() {
  // Entity slugs can change after this migration. Reconstructing the old slug
  // ownership would therefore be unsafe and could reintroduce content leaks.
}
