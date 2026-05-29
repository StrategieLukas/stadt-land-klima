import { isEmpty } from "lodash-es";
import { createError } from "@directus/errors";
import type { LocalTeam, DirectusUser, Role, MailTemplateData, OperationContext } from "../types";

// ---------------------------------------------------------------------------
// Custom typed errors — prefer @directus/errors over raw `new Error()`
// so Flows can distinguish reject paths and HTTP responses carry status codes.
// ---------------------------------------------------------------------------
const InvalidRoleError = createError(
  "INVALID_ROLE",
  "The user already exists but has a different role and cannot be added as an editor.",
  409
);
const RoleNotFoundError = createError(
  "ROLE_NOT_FOUND",
  `Required role was not found in the database.`,
  500
);

const ROLE_NAME = "LokalteamMitglied" as const;

export default {
  id: "operation-add-editor",
  handler: async (
    { email, localteam_id }: { email: string; localteam_id: string },
    context: OperationContext
  ) => {
    // Elevate to admin so the operation can manage users regardless of the
    // triggering user's own permissions.
    context.accountability.admin = true;

    const { UsersService, RolesService, MailService, ItemsService } = context.services;
    const schema = await context.getSchema();

    const usersService = new UsersService({ schema, accountability: context.accountability });
    const rolesService = new RolesService({ schema, accountability: context.accountability });
    const localteamService = new ItemsService("localteams", {
      schema,
      accountability: context.accountability,
    });
    const mailService = new MailService({ schema, accountability: context.accountability });

    // ------------------------------------------------------------------
    // Validate email format early — surface a clear error before any I/O.
    // ------------------------------------------------------------------
    usersService.validateEmail(email);

    // ------------------------------------------------------------------
    // Fetch supporting data in parallel where possible.
    // ------------------------------------------------------------------
    const [rolesResult, senderResult, localteamResult, existingUser] = await Promise.all([
      rolesService.readByQuery({
        fields: ["id", "name"],
        filter: { name: { _eq: ROLE_NAME } },
      }) as Promise<Role[]>,
      usersService.readOne(context.accountability.user as string, {
        fields: ["id", "first_name", "last_name", "email"],
      }) as Promise<DirectusUser>,
      localteamService.readOne(localteam_id, {
        fields: ["id", "municipality_name"],
      }) as Promise<LocalTeam>,
      usersService.getUserByEmail(email) as Promise<DirectusUser | undefined>,
    ]);

    if (isEmpty(rolesResult)) {
      throw new RoleNotFoundError();
    }

    const targetRole: Role = rolesResult[0];
    const sender = senderResult;
    const localteam = localteamResult;
    const fullName = `${sender.first_name} ${sender.last_name}`;

    context.logger.info(
      `${fullName} invited ${email} to localteam "${localteam.municipality_name}".`
    );

    if (!isEmpty(existingUser)) {
      // User already exists — only allow if they already carry the expected role.
      if (existingUser!.role !== targetRole.id) {
        throw new InvalidRoleError();
      }

      // TODO: if a user can belong to multiple localteams, add the M2M
      // relationship entry here instead of returning silently.
      context.logger.info(`User ${email} already exists with the correct role. No action taken.`);
      return;
    }

    // ------------------------------------------------------------------
    // New user path: create user then send invitation email.
    // ------------------------------------------------------------------

    // inviteUrl signature in Directus v11: inviteUrl(email, role)
    const url = usersService.inviteUrl(email, targetRole.id);

    await usersService.createOne({
      email,
      role: targetRole.id,
      status: "invited",
      localteams: [{ localteam_id }],
    });

    context.logger.info(`Created new user ${email} with status "invited".`);

    const mailData: MailTemplateData = {
      url,
      email,
      fullName,
      municipality_name: localteam.municipality_name,
    };

    try {
      await mailService.send({
        to: email,
        subject: "Willkommen bei Stadt.Land.Klima!",
        template: {
          name: "email-template-invite",
          data: mailData,
        },
      });
      context.logger.info(`Invitation email sent to ${email}.`);
    } catch (error) {
      // Use context.env instead of process.env — idiomatic in Directus extensions
      // and works correctly inside sandboxed operations.
      if (context.env["SLK_ENV"] !== "development") {
        context.logger.error(`Failed to send invitation email to ${email}: ${error}`);
        throw error;
      } else {
        context.logger.warn(
          `Failed to send invitation email to ${email}. ` +
          `This is expected in development where no mail server is configured.`
        );
      }
    }
  },
};
