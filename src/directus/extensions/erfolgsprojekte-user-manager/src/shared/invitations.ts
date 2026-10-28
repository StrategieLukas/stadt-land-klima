import { randomUUID } from "node:crypto";
import type { Accountability, ApiExtensionContext } from "@directus/types";
import { z } from "zod";
import { RATE_LIMIT_CONFIG } from "../../../../../frontend/server/utils/rateLimitConfig.ts";
import { extensionLog } from "../../../shared/securityLogger.ts";
import { INVITABLE_ROLES, type InvitableRole } from "./roles.ts";

export type InvitationContext = Pick<ApiExtensionContext, "database" | "env" | "getSchema" | "logger" | "services">;
type Database = InvitationContext["database"];
const TABLE = "role_invitation_requests";
export class InvitationError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const InvitationBodySchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    first_name: z.string().trim().min(1).max(100).optional(),
    last_name: z.string().trim().min(1).max(100).optional(),
    action: z.enum(["invite", "resend"]).default("invite"),
  })
  .strict();
export const AdminInvitationBodySchema = InvitationBodySchema.extend({ role: z.uuid() });
export type InvitationInput = z.infer<typeof InvitationBodySchema>;
const RoleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  parent: z.uuid().nullable(),
  policies: z.array(z.object({ policy: z.object({ admin_access: z.boolean() }) })),
});

/** Fail closed if a configured human role inherits administrator access or has ambiguous configuration. */
export async function listInvitationRoles(
  context: InvitationContext,
  accountability: Accountability,
): Promise<InvitableRole[]> {
  const service = new context.services.RolesService({ schema: await context.getSchema(), accountability });
  const roles = RoleSchema.array().parse(
    await service.readByQuery({
      fields: ["id", "name", "parent", "policies.policy.admin_access"],
      limit: -1,
    }),
  );
  const byId = new Map(roles.map((role) => [role.id, role]));
  function safeRole(id: string, visited = new Set<string>()): boolean {
    const role = byId.get(id);
    if (!role || visited.has(id) || role.policies.some((access) => access.policy.admin_access)) return false;
    visited.add(id);
    return !role.parent || safeRole(role.parent, visited);
  }
  return INVITABLE_ROLES.flatMap((definition) => {
    const matches = roles.filter((role) => role.name === definition.name);
    const role = matches.length === 1 ? matches[0] : undefined;
    return role && safeRole(role.id) ? [{ ...definition, id: role.id }] : [];
  });
}

/** Database time and an atomic sliding window work across Directus replicas without a local fallback. */
export async function invitationRateLimit(database: Database, user: string, read = false): Promise<void> {
  const key = read ? "role-invitation-roles" : "role-invitation";
  const preset = RATE_LIMIT_CONFIG[key]!;
  const subject = `${key}:${user}`;
  await database.transaction(async (db) => {
    await db.raw("SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))", ["role-invitation-rate", subject]);
    const time = (await db.raw("SELECT clock_timestamp() AS now")) as { rows: { now: Date }[] };
    const now = time.rows[0]!.now;
    await db(TABLE)
      .where("created_at", "<", new Date(now.getTime() - preset.windowSeconds * 1000))
      .delete();
    const row = await db(TABLE).where({ subject }).count({ count: "id" }).first();
    if (Number(row?.count ?? 0) >= preset.max)
      throw new InvitationError(429, "Zu viele Einladungsversuche. Bitte warte eine Minute.");
    await db(TABLE).insert({ id: randomUUID(), subject, created_at: now });
  });
}

interface UsersService {
  getUserByEmail(email: string): Promise<unknown>;
  createOne(data: Record<string, unknown>): Promise<string>;
  inviteUrl(email: string, url: null): string;
  validateEmail(email: string): void;
}
const UserSchema = z.object({
  id: z.uuid(),
  role: z.uuid().nullable(),
  status: z.string(),
});

/** Native Directus token/acceptance, custom awaited mail. Only pending accounts in the exact same role may be resent. */
export async function sendRoleInvitation(
  context: InvitationContext,
  accountability: Accountability,
  role: InvitableRole,
  input: InvitationInput,
  editorialEmail = false,
) {
  if (input.action === "invite" && (!input.first_name || !input.last_name))
    throw new InvitationError(400, "Vorname und Nachname sind erforderlich.");
  const schema = await context.getSchema();
  // The transaction serializes duplicate requests and rolls back a new invited account on mail failure.
  return context.database.transaction(async (db) => {
    await db.raw("SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))", ["role-invitation-user", input.email]);
    const users = new context.services.UsersService({ schema, accountability, knex: db }) as unknown as UsersService;
    try {
      users.validateEmail(input.email);
    } catch {
      throw new InvitationError(400, "Die E-Mail-Adresse ist ungültig.");
    }
    const raw = await users.getUserByEmail(input.email);
    let user = raw ? UserSchema.parse(raw) : null;
    if (user && (user.role !== role.id || user.status !== "invited"))
      throw new InvitationError(
        409,
        "Für diese E-Mail-Adresse besteht bereits ein aktives Konto oder ein Konto mit einer anderen Rolle. Es wurde nichts geändert.",
      );
    if (user) {
      const directAdminPolicy = await db("directus_access as access")
        .join("directus_policies as policy", "policy.id", "access.policy")
        .where({ "access.user": user.id, "policy.admin_access": true })
        .select("access.id")
        .first();
      if (directAdminPolicy)
        throw new InvitationError(
          409,
          "Für dieses Konto bestehen zusätzliche Administrationsrechte. Bitte verwalte es direkt in der Benutzerverwaltung.",
        );
    }
    if (user && input.action !== "resend")
      throw new InvitationError(
        409,
        "Für diese E-Mail-Adresse besteht bereits eine Einladung. Wähle „Einladung erneut senden“.",
      );
    if (!user && input.action === "resend")
      throw new InvitationError(404, "Für diese E-Mail-Adresse und Rolle besteht keine offene Einladung.");
    if (!user) {
      const id = await users.createOne({
        email: input.email,
        first_name: input.first_name,
        last_name: input.last_name,
        role: role.id,
        status: "invited",
        language: "de-DE",
      });
      user = { id, role: role.id, status: "invited" };
    }
    const recipient = await db("directus_users").where({ id: user.id }).select("first_name").first();
    const firstName =
      typeof recipient?.first_name === "string" && recipient.first_name ? recipient.first_name : input.email;
    // In Directus 11.17.4 the second argument is an optional URL, never a role ID.
    const url = users.inviteUrl(input.email, null);
    const inviter = await db("directus_users")
      .where({ id: accountability.user })
      .select("first_name", "last_name")
      .first();
    const inviterName =
      [inviter?.first_name, inviter?.last_name]
        .filter((name): name is string => typeof name === "string" && Boolean(name))
        .join(" ") || "Stadt.Land.Klima!";
    const mail = new context.services.MailService({ schema, accountability, knex: db });
    await mail.send({
      to: input.email,
      subject: editorialEmail
        ? "Einladung zur Erfolgsprojekte-Redaktion"
        : `Einladung: ${role.label} bei Stadt.Land.Klima!`,
      template: {
        name: editorialEmail ? "email-template-erfolgsprojekte-invite" : "email-template-role-invite",
        data: {
          firstName,
          inviterName,
          roleLabel: role.label,
          roleDescription: role.description,
          url,
        },
      },
    });
    extensionLog(context.logger, "info", "directus.role_invitation.sent", {
      resource: "directus_users",
      resourceId: user.id,
      outcome: "success",
    });
    return {
      user: { id: user.id, email: input.email, role: role.name, status: "invited" },
      mailSent: true,
      resent: input.action === "resend",
    };
  });
}
