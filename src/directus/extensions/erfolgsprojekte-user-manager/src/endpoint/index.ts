import type { Request, Response, Router } from "express";

interface Accountability {
  admin?: boolean;
  role?: string | null;
  user?: string | null;
}

interface DatabaseQuery {
  select(...fields: string[]): DatabaseQuery;
  where(criteria: Record<string, unknown>): DatabaseQuery;
  first(): Promise<unknown>;
}

type Database = (table: string) => DatabaseQuery;

interface ServiceOptions {
  accountability: Accountability;
  schema: unknown;
}

interface UsersServiceInstance {
  createOne(data: Record<string, unknown>): Promise<string>;
  getUserByEmail(email: string): Promise<ExistingUser | undefined>;
  inviteUrl(email: string, role: string): string;
  validateEmail(email: string): void;
}

interface MailServiceInstance {
  send(options: {
    subject: string;
    template: { data: Record<string, unknown>; name: string };
    to: string;
  }): Promise<void>;
}

interface AuthenticatedRequest extends Request {
  accountability?: Accountability;
}

interface ExtensionContext {
  database: Database;
  env: Record<string, string | undefined>;
  getSchema: () => Promise<unknown>;
  logger: {
    error(message: string, error?: unknown): void;
    info(message: string): void;
    warn(message: string): void;
  };
  services: {
    MailService: new (options: ServiceOptions) => MailServiceInstance;
    UsersService: new (options: ServiceOptions) => UsersServiceInstance;
  };
}

interface InviteBody {
  email?: unknown;
  first_name?: unknown;
  last_name?: unknown;
}

interface RoleRow {
  id: string;
  name: string;
}

interface ExistingUser {
  id: string;
  role?: string | null;
  status?: string | null;
}

interface InviterRow {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

const ALLOWED_ROLE = "Planungsteam";
const TARGET_ROLE = "ErfolgsprojekteRedaktion";
const MAX_NAME_LENGTH = 100;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function canInvite(
  database: Database,
  accountability?: Accountability,
): Promise<boolean> {
  if (accountability?.admin) return true;
  if (!accountability?.role) return false;

  const role = (await database("directus_roles")
    .select("name")
    .where({ id: accountability.role })
    .first()) as Pick<RoleRow, "name"> | undefined;

  return role?.name === ALLOWED_ROLE;
}

export default {
  id: "erfolgsprojekte-users",
  handler: (
    router: Router,
    { database, env, getSchema, logger, services }: ExtensionContext,
  ) => {
    router.post("/invite", async (req: AuthenticatedRequest, res: Response) => {
      if (!(await canInvite(database, req.accountability))) {
        return res
          .status(req.accountability?.user ? 403 : 401)
          .json({ error: "Keine Berechtigung, Redakteur:innen einzuladen." });
      }

      const body = (req.body ?? {}) as InviteBody;
      const email = normalizeText(body.email).toLowerCase();
      const firstName = normalizeText(body.first_name);
      const lastName = normalizeText(body.last_name);

      if (!email || !firstName || !lastName) {
        return res.status(400).json({
          error: "E-Mail-Adresse, Vorname und Nachname sind erforderlich.",
        });
      }

      if (
        firstName.length > MAX_NAME_LENGTH ||
        lastName.length > MAX_NAME_LENGTH
      ) {
        return res.status(400).json({ error: "Der Name ist zu lang." });
      }

      try {
        const targetRole = (await database("directus_roles")
          .select("id", "name")
          .where({ name: TARGET_ROLE })
          .first()) as RoleRow | undefined;

        if (!targetRole) {
          logger.error(
            `[erfolgsprojekte-users] Role ${TARGET_ROLE} not found.`,
          );
          return res
            .status(500)
            .json({ error: "Die Redaktionsrolle wurde nicht gefunden." });
        }

        const schema = await getSchema();
        const systemAccountability = { ...req.accountability, admin: true };
        const { MailService, UsersService } = services;
        const usersService = new UsersService({
          schema,
          accountability: systemAccountability,
        });
        const mailService = new MailService({
          schema,
          accountability: systemAccountability,
        });

        try {
          usersService.validateEmail(email);
        } catch {
          return res
            .status(400)
            .json({ error: "Die E-Mail-Adresse ist ungültig." });
        }

        const existingUser = (await usersService.getUserByEmail(email)) as
          | ExistingUser
          | undefined;
        if (existingUser) {
          return res.status(409).json({
            error:
              existingUser.role === targetRole.id
                ? "Für diese E-Mail-Adresse besteht bereits ein Redaktionskonto."
                : "Für diese E-Mail-Adresse besteht bereits ein Konto mit einer anderen Rolle.",
          });
        }

        const inviteUrl = usersService.inviteUrl(email, targetRole.id);
        const userId = (await usersService.createOne({
          email,
          first_name: firstName,
          last_name: lastName,
          role: targetRole.id,
          status: "invited",
        })) as string;

        const inviter = (req.accountability?.user
          ? await database("directus_users")
              .select("first_name", "last_name", "email")
              .where({ id: req.accountability.user })
              .first()
          : null) as InviterRow | null;
        const inviterName =
          [inviter?.first_name, inviter?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          inviter?.email ||
          "das Planungsteam";

        let mailSent = true;
        try {
          await mailService.send({
            to: email,
            subject: "Einladung zur Erfolgsprojekte-Redaktion",
            template: {
              name: "email-template-erfolgsprojekte-invite",
              data: {
                firstName,
                inviterName,
                url: inviteUrl,
              },
            },
          });
        } catch (error) {
          if (env["SLK_ENV"] !== "development") throw error;
          mailSent = false;
          logger.warn(
            `[erfolgsprojekte-users] Invitation mail for ${email} was not sent in development.`,
          );
        }

        logger.info(
          `[erfolgsprojekte-users] ${inviterName} invited ${email} as ${TARGET_ROLE}.`,
        );

        return res.status(201).json({
          user: {
            id: userId,
            email,
            first_name: firstName,
            last_name: lastName,
            role: targetRole.name,
            status: "invited",
          },
          mailSent,
        });
      } catch (error) {
        logger.error("[erfolgsprojekte-users] Invitation failed.", error);
        return res
          .status(500)
          .json({ error: "Die Einladung konnte nicht versendet werden." });
      }
    });
  },
};
