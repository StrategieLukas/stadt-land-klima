export async function up(knex) {
  await
    knex.schema.hasTable('ratings_measures', (exists) => {
      if (exists) {
        knex.schema.alterTable('ratings_measures', (table) => {
          table.unique(['localteam_id', 'measure_id'], { indexName: 'uq_localteamid_measureid', useConstraint: true });
        });
      }
    })
  };
