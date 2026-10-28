import type { Accountability } from "@directus/types";
import type { Request, Response, Router } from "express";
import { extensionError } from "../../../shared/securityLogger.ts";
import {
  InvitationBodySchema,
  InvitationError,
  invitationRateLimit,
  listInvitationRoles,
  sendRoleInvitation,
  type InvitationContext,
} from "../shared/invitations.ts";

/** Existing planning-team article-editor workflow; arbitrary role assignment is admin-only in the separate module. */
export default {
  id: "erfolgsprojekte-users",
  handler(router: Router, context: InvitationContext) {
    router.post("/invite", async (req: Request & { accountability?: Accountability }, res: Response) => {
      res.setHeader("Cache-Control", "private, no-store");
      const actor = req.accountability;
      if (!actor?.user) return res.status(401).json({ error: "Bitte melde dich an." });
      try {
        if (!actor.admin) {
          if (!actor.role) return res.status(403).json({ error: "Keine Berechtigung, Redakteur:innen einzuladen." });
          const sender = await context.database("directus_roles").select("name").where({ id: actor.role }).first();
          if (sender?.name !== "Planungsteam")
            return res.status(403).json({ error: "Keine Berechtigung, Redakteur:innen einzuladen." });
        }
        await invitationRateLimit(context.database, actor.user);
        const body = InvitationBodySchema.safeParse(req.body);
        if (!body.success) return res.status(400).json({ error: "Bitte prüfe E-Mail-Adresse, Namen und Aktion." });
        const scopedAccountability = { ...actor, admin: true };
        const roles = await listInvitationRoles(context, scopedAccountability);
        const role = roles.find((candidate) => candidate.name === "ErfolgsprojekteRedaktion");
        if (!role) throw new InvitationError(503, "Die Redaktionsrolle ist nicht verfügbar.");
        const result = await sendRoleInvitation(context, scopedAccountability, role, body.data, true);
        return res.status(result.resent ? 200 : 201).json(result);
      } catch (error) {
        if (error instanceof InvitationError) {
          if (error.status === 429) res.setHeader("Retry-After", "60");
          return res.status(error.status).json({ error: error.message });
        }
        extensionError(context.logger, "directus.role_invitation.failed", error);
        return res
          .status(503)
          .json({ error: "Die Einladung konnte nicht versendet werden. Es wurde kein neues Konto angelegt." });
      }
    });
  },
};
