import { createHash, createHmac, randomBytes } from 'node:crypto';

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const hmacKey: string = (config.altchaSecret as string) || 'dev-secret-change-in-production';

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

  return {
    algorithm: 'SHA-256',
    challenge,
    maxnumber: maxNumber,
    salt,
    signature,
  };
});
