export async function up(knex) {
  const publicFolder = await knex('directus_folders')
    .select('id')
    .where({ name: 'public' })
    .first();

  if (!publicFolder?.id) {
    throw new Error('Cannot move uploaded images: Directus folder "public" was not found.');
  }

  await knex('directus_files')
    .whereNull('folder')
    .where('type', 'like', 'image/%')
    .update({ folder: publicFolder.id });
}

export async function down() {}
