import { isEmpty } from "lodash-es";

export default {
  id: "operation-add-editor",
  handler: async (
    { email, localteam_id },
    { logger, accountability, services, getSchema },
  ) => {
    let roleName = "LokalteamMitglied";
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
    
    // Validate required parameters
    if (!email) {
      throw new Error("Email is required");
    }
    if (!localteam_id) {
      throw new Error("Localteam ID is required");
    }
    
    // Validate email format
    usersService.validateEmail(email);
    let url = usersService.inviteUrl(email);
    
    // Get the role
    const roles = await rolesService.readByQuery({
      fields: ["*"],
      filter: {
        name: {
          _eq: roleName,
        },
      },
    });
    
    if (isEmpty(roles)) {
      throw new Error(`Role "${roleName}" not found`);
    }
    const roleId = roles[0].id;
    
    // Get sender info
    if (!accountability.user) {
      throw new Error("No authenticated user found in accountability context");
    }
    
    const sender = await usersService.readOne(accountability.user, {
      fields: ["id", "first_name", "last_name", "email"],
    });
    
    if (!sender) {
      throw new Error(`Sender user with ID ${accountability.user} not found`);
    }
    
    // Get localteam
    const localteam = await localteamService.readOne(localteam_id, {
      fields: ["id", "municipality_name"],
    });
    
    if (!localteam) {
      throw new Error(`Localteam with ID ${localteam_id} not found`);
    }
    
    const fullName = sender.first_name + " " + sender.last_name;
    logger.info(`${fullName} hat eine neue Person (${email}) in das Lokalteam ${localteam.municipality_name} eingeladen!`);
    
    // Get existing user by email
    const user = await usersService.getUserByEmail(email);
    
    // Create user first to verify uniqueness if unknown
    if (isEmpty(user)) {
      //Create user
      const resultUser = await usersService.createOne({
        email,
        role: roleId,
        status: "invited",
        localteams: [{ localteam_id: localteam_id }],
      });

      //send Email
      const subjectLine = "Willkommen bei Stadt.Land.Klima!";

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
              projectName: "Stadt.Land.Klima",
              projectUrl: "https://stadt-land-klima.de",
              projectColor: "#1EA64A",
            },
          },
        });
      } catch (error) {
        if (process.env.SLK_ENV !== 'development') {
          logger.error(`Failed to send invitation email to ${email}`);
          // Don't throw the error to allow user creation to succeed even if email fails
          logger.warn(`User was created but email failed to send`);
        } else {
          logger.warn(`Failed to send invitation email to ${email} (=this is expected behaviour in dev, where no e-mail server is set up.)`);
        }
      }
    } else {
      if (user.role !== roleId) {
        throw new Error("User has different role");
      }
      //Possibility to also use for update Maybe also for multiple loalteams per editor
    }
  },
};
