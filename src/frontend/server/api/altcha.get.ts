import { createHash, createHmac, randomBytes } from 'node:crypto';

// Challenges expire after 20 minutes
const CHALLENGE_TTL_MS = 20 * 60 * 1000;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const hmacKey: string = (config.altchaSecret as string) || 'dev-secret-change-in-production';

  const query = getQuery(event);
  const purpose = typeof query.purpose === 'string' ? query.purpose : undefined;

  const salt = randomBytes(12).toString('hex');
  const maxNumber = 100_000;
  // The client must brute-force which number produces this SHA-256 hash
  const targetNumber = Math.floor(Math.random() * maxNumber);

  const challenge = createHash('SHA-256')
    .update(`${salt}${targetNumber}`)
    .digest('hex');

  const signature = createHmac('SHA-256', hmacKey)
    .update(challenge)
    .digest('hex');

  const expiresAt = Date.now() + CHALLENGE_TTL_MS;

  const result: Record<string, unknown> = {
    algorithm: 'SHA-256',
    challenge,
    maxnumber: maxNumber,
    salt,
    signature,
    expires_at: expiresAt,
  };
  if (purpose) {
    result.purpose = purpose;
  }

  return result;
});
