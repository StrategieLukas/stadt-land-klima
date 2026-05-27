import { isEmpty } from "lodash-es";
import type { LocalTeam, DirectusUser, Role, MailTemplateData } from '../types';

export default {
  id: "operation-add-editor",
  handler: async (
    { email, localteam_id }: { email: string; localteam_id: string },
    context: {
      logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
      accountability: { user: string | null; admin: boolean };
      services: any;
      getSchema: () => Promise<any>;
    }
  ) => {
    const roleName = "LokalteamMitglied";
    context.accountability.admin = true;

    const { UsersService, RolesService, MailService, ItemsService } = context.services;
    const schema = await context.getSchema();
    const usersService = new UsersService({ schema, accountability: context.accountability });
    const rolesService = new RolesService({ schema, accountability: context.accountability });
    const localteamService = new ItemsService("localteams", {
      schema,
      accountability: context.accountability,
    });
    const mailService = new MailService({
      schema: schema,
      accountability: context.accountability,
    });

    usersService.validateEmail(email);
    const url = usersService.inviteUrl(email);
    const user = await usersService.getUserByEmail(email);
    const roles = await rolesService.readByQuery({
      fields: ["*"],
      filter: {
        name: {
          _eq: roleName,
        },
      },
    }) as Role[];

    const sender = await usersService.readOne(context.accountability.user as string, {
      fields: ["id", "first_name", "last_name", "email"],
    }) as DirectusUser;
    const localteam = await localteamService.readOne(localteam_id, {
      fields: ["id", "municipality_name"],
    }) as LocalTeam;

    const fullName = sender.first_name + " " + sender.last_name;
    context.logger.info(`${fullName} hat eine neue Person (${email}) in das Lokalteam ${localteam.municipality_name} eingeladen!`);

    // Create user first to verify uniqueness if unknown
    if (isEmpty(user)) {
      // Create user
      await usersService.createOne({
        email,
        role: roles[0].id,
        status: "invited",
        localteams: [{ localteam_id: localteam_id }],
      });

      // send Email
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
            } as MailTemplateData,
          },
        });
      } catch (error) {
        if (process.env.SLK_ENV !== 'development') {
          context.logger.error(`Failed to send invitation email to ${email}`);
          throw error;
        } else {
          context.logger.warn(`Failed to send invitation email to ${email} (=this is expected behaviour in dev, where no e-mail server is set up.)`);
        }
      }
    } else if (user.role !== roles[0].id) {
      throw new Error("User has different role");
    }
    // Possibility to also use for update Maybe also for multiple localteams per editor
  },
};
