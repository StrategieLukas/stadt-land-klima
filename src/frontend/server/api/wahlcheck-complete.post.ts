import { WahlcheckCompletionRequestSchema } from "~/shared/contracts/submissions";
import { createError, defineEventHandler } from "h3";
import { useRuntimeConfig } from "#imports";
import { rateLimit } from "../utils/rateLimit";

/**
 * Record that a user completed a Wahlcheck (election comparison).
 * The browser cannot call Directus directly, so this route uses the server token.
 */
export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, "wahlcheck"))) {
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  const body = WahlcheckCompletionRequestSchema.safeParse(await readRequestBody(event));
  const electionId = body.success ? body.data.electionId : undefined;

  if (!electionId || typeof electionId !== "string" || !/^[a-z0-9-]{1,64}$/.test(electionId)) {
    throw createError({ statusCode: 400, statusMessage: "Missing or invalid election ID" });
  }

  const config = useRuntimeConfig();
  const directusUrl = config.directusServerUrl || "http://directus:8055";
  const token = config.directusFrontendServerToken as string | undefined;

  if (!token) {
    throw createError({ statusCode: 500, statusMessage: "Server token not configured" });
  }

  const response = await fetch(`${directusUrl}/election-actions/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ election_id: electionId }),
  });

  if (!response.ok) {
    throw createError({ statusCode: 502, statusMessage: "Completion tracking failed" });
  }

  return { success: true };
});
