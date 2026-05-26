import { isEmpty } from "lodash-es";

export default {
  id: "operation-add-editor",
  handler: async (
    { email, localteam_id },
    { logger, accountability, services, getSchema },
  ) => {
    let roleName = "EditorLocalteam";
    accountability.admin = true;

    const { UsersService, RolesService, MailService, ItemsService } = services;
    const schema = await getSchema();
    const usersService = new UsersService({ schema, accountability });
    const rolesService = new RolesService({ schema, accountability });
    const localteamService = new ItemsService("localteams", {
      schema,
      accountability,
    });
    const mailService = new MailService({
      schema: schema,
      accountability: accountability,
    });
    usersService.validateEmail(email);
    let url = usersService.inviteUrl(email);
    const user = await usersService.getUserByEmail(email);
    const roles = await rolesService.readByQuery({
      fields: ["*"],
      filter: {
        name: {
          _eq: roleName,
        },
      },
    });

    const sender = await usersService.readOne(accountability.user, {
      fields: ["id", "first_name", "last_name", "email"],
    });
    const localteam = await localteamService.readOne(localteam_id, {
      fields: ["id", "municipality_name"],
    });
    const fullName = sender.first_name + " " + sender.last_name;
    logger.info(`${fullName} hat eine neue Person (${email}) in das Lokalteam ${localteam.municipality_name} eingeladen!`);
    // Create user first to verify uniqueness if unknown
    if (isEmpty(user)) {
      //Create user
      const resultUser = await usersService.createOne({
        email,
        role: roles[0].id,
        status: "invited",
        localteams: [{ localteam_id: localteam_id }],
      });

      //send Email
      const subjectLine =
        "Willkommen bei Stadt.Land.Klima!";

      try {
        await mailService.send({
          to: email,
          subject: subjectLine,
          template: {
            name: "email-template-invite",
            data: {
              url: url,
              email: email,
              fullName: fullName,
              municipality_name: localteam.municipality_name,
            },
          },
        });
      } catch (error) {
        if (process.env.SLK_ENV !== 'development') {
          logger.error(`Failed to send invitation email to ${email}`);
          throw error;
        } else {
          logger.warn(`Failed to send invitation email to ${email} (=this is expected behaviour in dev, where no e-mail server is set up.)`);
        }
      }
    } else {
      if (user.role !== roles[0].id) {
        throw new Error("User has different role");
      }
      //Possibility to also use for update Maybe also for multiple loalteams per editor
    }
  },
};
