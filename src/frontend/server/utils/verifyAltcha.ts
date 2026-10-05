import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

interface AltchaPayload {
  algorithm: string;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
  dev?: boolean;
}

export function verifyAltcha(payloadB64: string, hmacKey: string, devMode = false): boolean {
  let payload: AltchaPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
  } catch {
    return false;
  }

  // In development, accept the static dev-bypass payload so plain-HTTP devices
  // (e.g. phones on a local network without HTTPS) can submit forms. The altcha
  // widget refuses to run over HTTP (isSecureContext = false) so we skip it.
  if (devMode && payload.dev === true) {
    return true;
  }

  // 1. Verify proof-of-work: sha256(salt + number) === challenge
  const expectedChallenge = createHash('SHA-256')
    .update(`${payload.salt}${payload.number}`)
    .digest('hex');
  if (expectedChallenge !== payload.challenge) return false;

  // 2. Verify HMAC signature: hmac(challenge) === signature
  const expectedSig = createHmac('SHA-256', hmacKey).update(payload.challenge).digest('hex');
  const a = Buffer.from(expectedSig, 'hex');
  const b = Buffer.from(payload.signature, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
