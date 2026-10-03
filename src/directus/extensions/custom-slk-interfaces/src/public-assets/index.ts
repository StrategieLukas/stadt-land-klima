import type { Database, HookConfig } from '@directus/types';

const PUBLIC_FOLDER_NAME = 'public';

async function moveToPublicFolder(
  fileId: string,
  database: Database,
  logError: (message: string) => void,
) {
  const folder = await database('directus_folders')
    .select('id')
    .where({ name: PUBLIC_FOLDER_NAME })
    .first();

  if (!folder?.id) {
    logError(`[public-assets] Directus folder "${PUBLIC_FOLDER_NAME}" was not found.`);
    return;
  }

  await database('directus_files').where({ id: fileId }).update({ folder: folder.id });
}

const publicAssetsHook: HookConfig = ({ action }, { logger }) => {
  action('files.upload', async ({ key, payload }, { database }) => {
    if (
      typeof key !== 'string' ||
      typeof payload?.type !== 'string' ||
      !payload.type.startsWith('image/') ||
      payload.folder
    ) {
      return;
    }

    await moveToPublicFolder(key, database, (message) => logger.error(message));
  });
};

export default publicAssetsHook;
