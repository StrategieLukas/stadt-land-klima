import { createError, defineEventHandler, setResponseHeader } from "h3";
import { candidateSession } from "../../utils/candidateSession";
import { candidateRead } from "../../utils/candidateRead";
import { rateLimit } from "../../utils/rateLimit";
export default defineEventHandler(async (event) => {
  if (!(await rateLimit(event, "candidate-info"))) throw createError({ statusCode: 429 });
  setResponseHeader(event, "Cache-Control", "private, no-store");
  const session = await candidateSession(event);
  if (!session.data.accessToken) throw createError({ statusCode: 401 });
  return { data: await candidateRead(session.data.accessToken), csrf: session.data.csrf };
});
