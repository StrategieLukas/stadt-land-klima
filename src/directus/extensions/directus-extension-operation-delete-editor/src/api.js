import { isEmpty } from "lodash-es";
export default {
  id: "delete-editor",
  handler: async (
    { keys, measureIds },
    { env, logger, accountability, services, getSchema },
  ) => {
    let keysToDelete = Array.isArray(keys) ? keys : [keys];
    if (isEmpty(keysToDelete)) {
      throw new Error("No Keys for deletion");
    }
    //set accountability to admin
    accountability.admin = true;
    const { UsersService, ItemsService } = services;
    const schema = await getSchema();
    const usersService = new UsersService({ schema, accountability });
    const EditorLocalteam = new ItemsService("editors", {
      schema,
      accountability,
    });
    let query = {
      limit: -1,
    };
    let editors = await EditorLocalteam.readMany(keys, query);
    logger.info("editors:");
    let userIdsForDeletion = [];
    for (const editor of editors) {
      logger.info(editor);
      let user = await usersService.getUserByEmail(editor.email);
      //IF multiple localteams per Editor Return here
      if (isEmpty(user)) {
        logger.info("User not found");
      } else {
        //only push userIdsForDeletion  when a user was found
        userIdsForDeletion.push(user.id);
      }
    }
    if (!isEmpty(userIdsForDeletion)) {
      usersService.deleteMany(userIdsForDeletion);
    }
  },
};
