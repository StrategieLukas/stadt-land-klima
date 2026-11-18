import type { Accountability } from "@directus/types";
import type { Request, Response, Router } from "express";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { RATE_LIMIT_CONFIG } from "../../../../../frontend/server/utils/rateLimitConfig.ts";
import { ParticipationError, ParticipationInputSchema } from "../../../../../frontend/shared/participation.ts";
import { extensionError } from "../../../shared/securityLogger.ts";
import { calendarConfig, participationCalendar } from "./calendar.ts";
import { participationOptions, registerParticipation, type ParticipationContext } from "./store.ts";

type ServiceRequest = Request & { accountability?: Accountability };
async function registrationRateLimit(context: ParticipationContext, email: string) {
  const preset = RATE_LIMIT_CONFIG["participation-register"]!;
  const subject = `participation:${createHash("sha256").update(email).digest("hex")}`;
  await context.database.transaction(async (db) => {
    await db.raw("SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))", ["participation-rate", subject]);
    const time = (await db.raw("SELECT clock_timestamp() AS now")) as { rows: { now: Date }[] };
    const now = time.rows[0]!.now;
    await db("role_invitation_requests")
      .where("created_at", "<", new Date(now.getTime() - preset.windowSeconds * 1000))
      .delete();
    const count = await db("role_invitation_requests").where({ subject }).count({ count: "id" }).first();
    if (Number(count?.count ?? 0) >= preset.max) throw new ParticipationError("unavailable", 429);
    await db("role_invitation_requests").insert({ id: randomUUID(), subject, created_at: now });
  });
}
export default {
  id: "participation",
  handler(router: Router, context: ParticipationContext) {
    async function authorized(req: ServiceRequest, res: Response): Promise<Accountability | null> {
      res.setHeader("Cache-Control", "private, no-store");
      const actor = req.accountability;
      if (!actor?.user || !actor.role) {
        res.status(401).json({ code: "unavailable" });
        return null;
      }
      const role = await context.database("directus_roles").where({ id: actor.role }).select("name").first();
      if (role?.name !== "Frontend-Server") {
        res.status(403).json({ code: "unavailable" });
        return null;
      }
      return actor;
    }
    const handle =
      (operation: (req: ServiceRequest, actor: Accountability) => Promise<unknown>) =>
      async (req: ServiceRequest, res: Response) => {
        try {
          const actor = await authorized(req, res);
          if (!actor) return;
          const result = await operation(req, actor);
          return res.json(result);
        } catch (error) {
          if (error instanceof ParticipationError) return res.status(error.status).json({ code: error.code });
          if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_request" });
          extensionError(context.logger, "directus.participation.failed", error);
          return res.status(503).json({ code: "unavailable" });
        }
      };
    router.get(
      "/options",
      handle((_req, actor) => participationOptions(context, actor)),
    );
    router.get(
      "/slots",
      handle(async (req) => {
        const query = z
          .object({
            start: z.iso.datetime({ offset: true }),
            end: z.iso.datetime({ offset: true }),
            timeZone: z.string().max(100),
          })
          .parse(req.query);
        try {
          new Intl.DateTimeFormat("en", { timeZone: query.timeZone });
        } catch {
          throw new ParticipationError("invalid_request", 400);
        }
        if (
          Date.parse(query.end) <= Date.parse(query.start) ||
          Date.parse(query.end) - Date.parse(query.start) > 34 * 86400000 ||
          Date.parse(query.start) < Date.now() - 86400000 ||
          Date.parse(query.end) > Date.now() + 122 * 86400000
        )
          throw new ParticipationError("invalid_request", 400);
        return {
          slots: await participationCalendar(calendarConfig(context.env)).slots(query.start, query.end, query.timeZone),
        };
      }),
    );
    router.post(
      "/register",
      handle(async (req) => {
        const input = ParticipationInputSchema.safeParse(req.body);
        if (!input.success) throw new ParticipationError("invalid_request", 400);
        await registrationRateLimit(context, input.data.email);
        return registerParticipation(context, input.data);
      }),
    );
  },
};
