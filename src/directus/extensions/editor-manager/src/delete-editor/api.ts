import { isEmpty } from "lodash-es";
import type { Editor } from '../types';

export default {
  id: "delete-editor",
  handler: async (
    { keys, measureIds }: { keys: string | string[]; measureIds?: string | string[] },
    context: {
      env: Record<string, string>;
      logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
      accountability: { user: string | null; admin: boolean };
      services: any;
      getSchema: () => Promise<any>;
    }
  ) => {
    const keysToDelete = Array.isArray(keys) ? keys : [keys];
    
    if (isEmpty(keysToDelete)) {
      throw new Error("No Keys for deletion");
    }

    // set accountability to admin
    context.accountability.admin = true;
    const { UsersService, ItemsService } = context.services;
    const schema = await context.getSchema();
    const usersService = new UsersService({ schema, accountability: context.accountability });
    const localteamMember = new ItemsService("editors", {
      schema,
      accountability: context.accountability,
    });

    const query = {
      limit: -1,
    };

    const editors = await localteamMember.readMany(keysToDelete, query) as Editor[];
    context.logger.info("editors:");
    
    const userIdsForDeletion: string[] = [];
    
    for (const editor of editors) {
      context.logger.info(editor);
      const user = await usersService.getUserByEmail(editor.email);
      
      // IF multiple localteams per Editor Return here
      if (isEmpty(user)) {
        context.logger.info("User not found");
      } else {
        // only push userIdsForDeletion when a user was found
        userIdsForDeletion.push(user.id);
      }
    }

    if (!isEmpty(userIdsForDeletion)) {
      await usersService.deleteMany(userIdsForDeletion);
    }
  },
};
