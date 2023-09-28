export async function up(knex) {
  await knex.schema.alterTable('ratings_measures', (table) => {
    table.unique(['localteam_id', 'measure_id'], {indexName: 'uq_localteamid_measureid', useConstraint: true});
  });
}
