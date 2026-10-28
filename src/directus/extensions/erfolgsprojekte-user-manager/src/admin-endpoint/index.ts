import type { Accountability } from "@directus/types";
import type { Request, Response, Router } from "express";
import { extensionError } from "../../../shared/securityLogger.ts";
import {
  AdminInvitationBodySchema,
  InvitationError,
  invitationRateLimit,
  listInvitationRoles,
  sendRoleInvitation,
  type InvitationContext,
} from "../shared/invitations.ts";

type AdminRequest = Request & { accountability?: Accountability };
export default {
  id: "role-invitations",
  handler(router: Router, context: InvitationContext) {
    const handle = (read: boolean) => async (req: AdminRequest, res: Response) => {
      res.setHeader("Cache-Control", "private, no-store");
      const actor = req.accountability;
      if (!actor?.user || actor.admin !== true)
        return res
          .status(actor?.user ? 403 : 401)
          .json({ error: "Nur Administrator:innen dürfen Personen für andere Rollen einladen." });
      try {
        await invitationRateLimit(context.database, actor.user, read);
        const body = read ? null : AdminInvitationBodySchema.safeParse(req.body);
        if (body && !body.success)
          return res.status(400).json({ error: "Bitte prüfe E-Mail-Adresse, Namen, Rolle und Aktion." });
        const roles = await listInvitationRoles(context, actor);
        if (read) return res.json({ roles });
        if (!body?.success) return res.status(400).json({ error: "Ungültige Einladung." });
        const role = roles.find((candidate) => candidate.id === body.data.role);
        if (!role)
          return res.status(400).json({
            error: "Diese Rolle kann hier nicht eingeladen werden. Lokalteameinladungen werden im Lokalteam verwaltet.",
          });
        const result = await sendRoleInvitation(context, actor, role, body.data);
        return res.status(result.resent ? 200 : 201).json(result);
      } catch (error) {
        if (error instanceof InvitationError) {
          if (error.status === 429) res.setHeader("Retry-After", "60");
          return res.status(error.status).json({ error: error.message });
        }
        extensionError(context.logger, "directus.role_invitation.failed", error);
        return res.status(503).json({
          error: read
            ? "Die Rollen konnten nicht geladen werden. Bitte prüfe die Rollenkonfiguration."
            : "Die Einladung konnte nicht versendet werden. Es wurde kein neues Konto angelegt. Bitte versuche es später erneut.",
        });
      }
    };
    router.get("/roles", handle(true));
    router.post("/invite", handle(false));
  },
};
