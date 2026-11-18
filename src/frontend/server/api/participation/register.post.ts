import { createError, defineEventHandler, getHeader, readBody, setResponseHeader, setResponseStatus } from "h3";
import { z } from "zod";
import {
  PARTICIPATION_ERROR_KEYS,
  ParticipationRequestSchema,
  ParticipationResultSchema,
} from "~/shared/participation";
import { requestErrorData, requestErrorStatus } from "~/shared/requestError";
import { abuseProtection } from "../../utils/abuseProtection";
import { rateLimit } from "../../utils/rateLimit";
import { verifyAltcha } from "../../utils/verifyAltcha";
import { participationRequest } from "../../utils/participation";

export default defineEventHandler(async (event) => {
  if (!(await rateLimit(event, "participation-register"))) throw createError({ statusCode: 429 });
  setResponseHeader(event, "Cache-Control", "no-store");
  const origin = getHeader(event, "origin");
  const site = getHeader(event, "sec-fetch-site");
  const configured = useRuntimeConfig().appPublicUrl;
  let validOrigin: boolean;
  try {
    validOrigin =
      !!origin &&
      (configured
        ? new URL(origin).origin === new URL(configured).origin
        : new URL(origin).host === getHeader(event, "host"));
  } catch {
    validOrigin = false;
  }
  if (!validOrigin || getHeader(event, "x-slk-participation") !== "1" || (site && site !== "same-origin"))
    throw createError({ statusCode: 403 });
  const body = ParticipationRequestSchema.safeParse(await readBody<unknown>(event));
  if (!body.success) throw createError({ statusCode: 400, data: { code: "invalid_request" } });
  const { hmacKey, devMode } = abuseProtection();
  if (!(await verifyAltcha(body.data.altcha, hmacKey, { devMode, purpose: "register" })))
    throw createError({ statusCode: 400, data: { code: "captcha" } });
  try {
    return ParticipationResultSchema.parse(await participationRequest("register", undefined, body.data.registration));
  } catch (error) {
    // Return only the checked business code. Nitro deliberately hides arbitrary 5xx error data.
    const code = z.object({ code: z.enum(PARTICIPATION_ERROR_KEYS) }).safeParse(requestErrorData(error));
    if (!code.success) throw error;
    setResponseStatus(event, requestErrorStatus(error) ?? 503);
    return { code: code.data.code };
  }
});
