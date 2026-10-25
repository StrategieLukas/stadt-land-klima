import { municipalityPageHandler } from "../../../utils/municipalityPageData";
import { rateLimit } from "../../../utils/rateLimit";
import { createError } from "h3";

export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, "municipality-preview"))) {
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  setResponseHeader(event, "Referrer-Policy", "no-referrer");
  return municipalityPageHandler(event, true);
});
