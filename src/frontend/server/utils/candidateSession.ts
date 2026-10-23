import { createHmac, timingSafeEqual } from 'node:crypto';
import { createError, getHeader, useSession, type H3Event } from 'h3';
import { abuseProtection } from './abuseProtection';

/** Uses H3's authenticated, encrypted HttpOnly cookie; never accepts a session header. */
export async function candidateSession(event: H3Event) {
  const config = useRuntimeConfig();
  const {hmacKey, devMode} = abuseProtection();
  const configured = config.candidateSessionSecret;
  if (configured && configured.length < 32) throw createError({statusCode: 503, statusMessage: 'Invalid candidate session configuration'});
  const password = configured || createHmac('sha256', hmacKey).update('slk:candidate-session:v1').digest('hex');
  return useSession<{accessToken: string; csrf: string}>(event, {
    name: 'slk-candidate', password, maxAge: 7200, sessionHeader: false,
    cookie: {httpOnly: true, secure: !devMode, sameSite: 'strict', path: '/api/candidate'},
  });
}

/** A custom header plus same-origin browser metadata prevents cross-site submissions. */
export function candidateMutationOrigin(event: H3Event) {
  const config = useRuntimeConfig();
  const origin = getHeader(event, 'origin');
  const site = getHeader(event, 'sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') throw createError({statusCode: 403});
  if (getHeader(event, 'x-slk-candidate') !== '1') throw createError({statusCode: 403});
  if (origin) {
    const host = getHeader(event, 'host');
    const configured = config.appPublicUrl ? new URL(config.appPublicUrl).origin : undefined;
    let requested: URL;
    try { requested = new URL(origin); } catch { throw createError({statusCode: 403}); }
    if (configured ? requested.origin !== configured : requested.host !== host) throw createError({statusCode: 403});
  }
}
export function validCandidateCsrf(actual: string | undefined, expected: string | undefined) {
  if (!actual || !expected || !/^[a-f0-9]{64}$/.test(actual)) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
