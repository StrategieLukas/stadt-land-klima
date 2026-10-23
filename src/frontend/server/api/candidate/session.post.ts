import { randomBytes } from 'node:crypto';
import { createError, defineEventHandler, setResponseHeader } from 'h3';
import { z } from 'zod';
import { candidateMutationOrigin, candidateSession } from '../../utils/candidateSession';
import { verifyCandidateAccessToken } from '../../utils/candidateAuth';
import { readRequestBody } from '../../utils/readRequestBody';
import { rateLimit } from '../../utils/rateLimit';
export default defineEventHandler(async event => {
  candidateMutationOrigin(event);
  if (!await rateLimit(event, 'candidate-info')) throw createError({statusCode: 429});
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  const body = z.strictObject({token: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/)}).safeParse(await readRequestBody(event, 2048));
  if (!body.success) throw createError({statusCode: 400});
  if (!await verifyCandidateAccessToken(body.data.token)) throw createError({statusCode: 404});
  const session = await candidateSession(event);
  const csrf = randomBytes(32).toString('hex');
  await session.update({accessToken: body.data.token, csrf});
  return {csrf};
});
