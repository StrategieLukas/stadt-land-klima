import { createError, defineEventHandler, getHeader, setResponseHeader } from "h3";
import { CandidateAnswersRequestSchema } from "~/shared/contracts/candidateAnswers";
import { candidateMutationOrigin, candidateSession, validCandidateCsrf } from "../../../utils/candidateSession";
import { readRequestBody } from "../../../utils/readRequestBody";
import { saveCandidateAnswers } from "../../../utils/candidateAnswers";
import { rateLimit } from "../../../utils/rateLimit";
export default defineEventHandler(async (event) => {
  candidateMutationOrigin(event);
  if (!(await rateLimit(event, "candidate-answers"))) throw createError({ statusCode: 429 });
  setResponseHeader(event, "Cache-Control", "private, no-store");
  const session = await candidateSession(event);
  if (!session.data.accessToken) throw createError({ statusCode: 401 });
  if (!validCandidateCsrf(getHeader(event, "x-csrf-token"), session.data.csrf)) throw createError({ statusCode: 403 });
  const body = CandidateAnswersRequestSchema.safeParse(await readRequestBody(event));
  if (!body.success) throw createError({ statusCode: 400 });
  // Existing candidate/election/deadline authorization also checks token revocation on every write.
  return saveCandidateAnswers(session.data.accessToken, body.data, event);
});
