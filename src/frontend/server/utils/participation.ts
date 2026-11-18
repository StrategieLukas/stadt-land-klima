import { createError } from "h3";
import { z } from "zod";
import { PARTICIPATION_ERROR_KEYS } from "~/shared/participation";
import { requestErrorData, requestErrorStatus } from "~/shared/requestError";

/** Narrow, private extension transport; never proxy an arbitrary caller-controlled CMS path. */
export async function participationRequest(
  operation: "options" | "slots" | "register",
  query?: Record<string, string>,
  body?: unknown,
): Promise<unknown> {
  const config = useRuntimeConfig();
  if (!config.directusFrontendServerToken) throw createError({ statusCode: 503, data: { code: "unavailable" } });
  try {
    return await $fetch(`${config.directusServerUrl.replace(/\/$/, "")}/participation/${operation}`, {
      method: operation === "register" ? "POST" : "GET",
      headers: { Authorization: `Bearer ${config.directusFrontendServerToken}` },
      ...(query ? { query } : {}),
      ...(body ? { body } : {}),
      redirect: "error",
      retry: 0,
      timeout: 65000,
    });
  } catch (error) {
    const parsed = z.object({ code: z.enum(PARTICIPATION_ERROR_KEYS) }).safeParse(requestErrorData(error));
    const status = requestErrorStatus(error);
    throw createError({
      statusCode: status && [400, 409, 429].includes(status) ? status : 503,
      data: { code: parsed.success ? parsed.data.code : "unavailable" },
    });
  }
}
