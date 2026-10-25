import { createError, defineEventHandler, setResponseStatus } from "h3";
import { z } from "zod";
import { SECURITY_CLIENT_EVENTS } from "../../../shared/securityClientEvents";
import { readRequestBody } from "../../utils/readRequestBody";
import { rateLimit } from "../../utils/rateLimit";
import { requestLog } from "../../utils/securityLogging";

export default defineEventHandler(async (event) => {
  if (!(await rateLimit(event, "client-event"))) throw createError({ statusCode: 429 });
  const body = z.strictObject({ event: z.enum(SECURITY_CLIENT_EVENTS) }).safeParse(await readRequestBody(event, 2048));
  if (!body.success) throw createError({ statusCode: 400, statusMessage: "Invalid client diagnostic" });
  // Browser reports are untrusted signals, not a way for anonymous clients to fire error alarms.
  requestLog(event, "warn", body.data.event, { outcome: "failed" });
  setResponseStatus(event, 202);
  return { accepted: true };
});
