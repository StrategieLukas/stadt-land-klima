import { defineEventHandler, getRouterParam, createError, setResponseHeader } from "h3";
import { saveCandidateAnswers } from "../../../utils/candidateAnswers";
import { readRequestBody } from "../../../utils/readRequestBody";
import { CandidateAnswersRequestSchema } from "../../../../shared/contracts/candidateAnswers";
import { rateLimit } from "../../../utils/rateLimit";

export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, 'candidate-answers'))) {
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  setResponseHeader(event, "Cache-Control", "private, no-store");

  const accessToken = getRouterParam(event, "token");
  if (!accessToken || !/^[a-zA-Z0-9_-]{1,100}$/.test(accessToken)) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  const body: unknown = await readRequestBody(event, 65536);
  const parsed = CandidateAnswersRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid request body" });
  }

  return saveCandidateAnswers(accessToken, parsed.data);
});
