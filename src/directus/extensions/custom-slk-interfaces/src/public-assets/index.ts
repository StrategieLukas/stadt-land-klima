import { extensionLog } from "../../../shared/securityLogger.ts";
import type { HookConfig, ApiExtensionContext } from "@directus/types";

type Database = ApiExtensionContext["database"];

const PUBLIC_FOLDER_NAME = "public";

async function moveToPublicFolder(fileId: string, database: Database, logError: (message: string) => void) {
  const folder = await database("directus_folders").select("id").where({ name: PUBLIC_FOLDER_NAME }).first();

  if (!folder?.id) {
    logError(`[public-assets] Directus folder "${PUBLIC_FOLDER_NAME}" was not found.`);
    return;
  }

  await database("directus_files").where({ id: fileId }).update({ folder: folder.id });
  return true;
}

const publicAssetsHook: HookConfig = ({ action }, { logger }) => {
  action("files.upload", async ({ key, payload }, { database, accountability }) => {
    if (
      typeof key !== "string" ||
      typeof payload?.type !== "string" ||
      !payload.type.startsWith("image/") ||
      payload.folder
    ) {
      return;
    }

    const moved = await moveToPublicFolder(key, database, () =>
      extensionLog(logger, "error", "directus.asset.public_folder_missing"),
    );
    if (moved)
      extensionLog(logger, "info", "directus.asset.public_folder_assigned", {
        userId: accountability?.user,
        resource: "directus_files",
        resourceId: key,
        outcome: "success",
      });
  });
};

export default publicAssetsHook;
