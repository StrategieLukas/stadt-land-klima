import { isEmpty } from "lodash-es";
import { createError } from "@directus/errors";
import type { Editor, OperationContext } from "../types";

// ---------------------------------------------------------------------------
// Custom typed error for missing keys input.
// ---------------------------------------------------------------------------
const NoKeysError = createError(
  "NO_KEYS_PROVIDED",
  "At least one editor key must be provided for deletion.",
  400
);

export default {
  id: "delete-editor",
  handler: async (
    { keys }: { keys: string | string[] },
    context: OperationContext
  ) => {
    const keysToDelete = Array.isArray(keys) ? keys : [keys];

    if (isEmpty(keysToDelete)) {
      throw new NoKeysError();
    }

    // Elevate to admin so the operation can delete users regardless of the
    // triggering user's own permissions.
    context.accountability.admin = true;

    const { UsersService, ItemsService } = context.services;
    const schema = await context.getSchema();

    const usersService = new UsersService({ schema, accountability: context.accountability });
    const editorsService = new ItemsService("editors", {
      schema,
      accountability: context.accountability,
    });

    // ------------------------------------------------------------------
    // Fetch editor records to resolve their linked Directus user emails.
    // ------------------------------------------------------------------
    const editors = await editorsService.readMany(keysToDelete, { limit: -1 }) as Editor[];

    if (isEmpty(editors)) {
      context.logger.warn(`No editor records found for keys: ${keysToDelete.join(", ")}`);
      return;
    }

    context.logger.info(`Resolving Directus users for ${editors.length} editor(s)...`);

    // Resolve all user lookups in parallel for performance.
    const userLookups = await Promise.all(
      editors.map(async (editor) => {
        const user = await usersService.getUserByEmail(editor.email);
        if (!user) {
          context.logger.warn(
            `No Directus user found for editor "${editor.id}" (${editor.email}). Skipping.`
          );
        }
        return user?.id ?? null;
      })
    );

    const userIdsForDeletion = userLookups.filter((id): id is string => id !== null);

    if (isEmpty(userIdsForDeletion)) {
      context.logger.warn("No matching Directus users found. Nothing to delete.");
      return;
    }

    context.logger.info(`Deleting ${userIdsForDeletion.length} user(s): ${userIdsForDeletion.join(", ")}`);
    await usersService.deleteMany(userIdsForDeletion);
    context.logger.info("User deletion complete.");
  },
};
