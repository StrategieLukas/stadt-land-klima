const LEGACY_TEMPLATE_MD5 = '0e02c4aa3035b57a2f7d78ad787b4a18';

export async function up(knex) {
  await knex.transaction(async (transaction) => {
    const legacyTemplates = transaction('elections')
      .whereRaw('md5(??) = ?', ['candidate_email_template', LEGACY_TEMPLATE_MD5]);

    const legacyElections = await legacyTemplates.clone().select('id');

    if (legacyElections.length === 0) {
      return;
    }

    await legacyTemplates.update({
      candidate_email_template: transaction.raw('DEFAULT'),
    });

    const [{ count: invalidCount }] = await transaction('elections')
      .whereIn('id', legacyElections.map(({ id }) => id))
      .where(function validateUpdatedTemplate() {
        this
          .whereNull('candidate_email_template')
          .orWhereRaw("position('<!doctype html>' in lower(candidate_email_template)) = 0")
          .orWhereRaw("position('{{ stadt_land_klima_logo }}' in candidate_email_template) = 0")
          .orWhereRaw("position('{{ custom_logo }}' in candidate_email_template) = 0");
      })
      .count('*');

    if (Number(invalidCount) > 0) {
      throw new Error(
        'The candidate email template default is still outdated. Import the current Directus schema before running this migration.',
      );
    }
  });
}

export async function down() {}
