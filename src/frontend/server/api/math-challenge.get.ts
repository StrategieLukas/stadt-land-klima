import { createHmac, randomInt } from 'node:crypto';
import { queryChoice } from '../utils/publicQuery';
import { abuseProtection } from '../utils/abuseProtection';
import { rateLimit } from '../utils/rateLimit';

export default defineEventHandler(async event => {
  if (!await rateLimit(event, 'math-challenge')) throw createError({statusCode: 429, statusMessage: 'Too many requests'});
  const {hmacKey} = abuseProtection();
  const purpose = queryChoice(getQuery(event).purpose, ['contact', 'register', 'form', 'article'], 'contact') ?? 'contact';
  const num1 = randomInt(10, 20), num2 = randomInt(1, 11);
  const body = JSON.stringify({num1, num2, purpose}), timestamp = Date.now();
  const signature = createHmac('sha256', hmacKey).update(`${body}:${timestamp}`).digest('hex');
  setHeaders(event, {'Cache-Control': 'no-store'});
  return {num1, num2, token: Buffer.from(`${body}:${timestamp}:${signature}`).toString('base64')};
});
