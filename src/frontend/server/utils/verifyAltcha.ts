import { withProtectionRedis } from './protectionRedis';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

interface AltchaPayload {
  algorithm: string;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
  dev?: boolean;
  purpose?: string;
  expires_at?: number;
}

const DEV_SECRET = 'dev-secret-change-in-production';

/**
 * Verify an ALTCHA proof. In production mode (devMode = false), the HMAC key
 * must not be the development default and the challenge must be fresh, single-use,
 * and bound to the requested purpose.
 *
 * Returns true only when the proof is valid and has not been consumed.
 * A consumed proof is recorded in Redis so that replay across workers is prevented.
 */
export async function verifyAltcha(
  payloadB64: string,
  hmacKey: string,
  options: {
    devMode?: boolean;
    purpose?: string;
  } = {},
): Promise<boolean> {
  const { devMode = false, purpose } = options;

  // Reject the known development default in production — a missing or weak secret
  // means the challenge signature cannot be trusted.
  if (!devMode && (hmacKey === DEV_SECRET || !hmacKey)) {
    return false;
  }

  if (typeof payloadB64 !== 'string' || payloadB64.length > 20000) return false;
  let payload: AltchaPayload;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return false;
    const parsed = decoded as Record<string, unknown>;
    // Required proof fields are checked below before cryptographic operations.
    // The {dev: true} payload is ONLY accepted when BOTH conditions are met:
    // 1. devMode is true (APP_ENV === 'development')
    // 2. The HMAC key is the known dev default
    // This prevents a browser from bypassing CAPTCHA by simply sending {dev: true}
    // — the server must also be configured with the dev secret.
    if (devMode && parsed.dev === true && hmacKey === DEV_SECRET) return true;
    if (typeof parsed.algorithm !== "string" || typeof parsed.challenge !== "string" ||
        typeof parsed.number !== "number" || typeof parsed.salt !== "string" || typeof parsed.signature !== "string") return false;
    payload = { algorithm: parsed.algorithm, challenge: parsed.challenge, number: parsed.number,
      salt: parsed.salt, signature: parsed.signature,
      ...(typeof parsed.purpose === "string" ? { purpose: parsed.purpose } : {}),
      ...(typeof parsed.expires_at === "number" ? { expires_at: parsed.expires_at } : {}),
    };
  } catch {
    return false;
  }

  // Guard against obviously malformed payloads
  if (!payload || typeof payload !== 'object') return false;

  // In development, accept the static dev-bypass payload so plain-HTTP devices
  // (e.g. phones on a local network without HTTPS) can submit forms. The altcha
  // widget refuses to run over HTTP (isSecureContext = false) so we skip it.
  // This check must come BEFORE field validation — the dev payload has no challenge fields.
  // Dev bypass: only active when devMode is true AND the HMAC key is the known
  // dev default. A browser sending {dev: true} cannot bypass this in production,
  // because production either has a real secret (hmacKey !== DEV_SECRET) or
  // devMode is false.
  if (devMode && payload.dev === true && hmacKey === DEV_SECRET) {
    return true;
  }

  // Validate required fields for non-dev payloads
  if (payload.algorithm !== 'SHA-256' || typeof payload.challenge !== 'string' || !/^[a-f0-9]{64}$/.test(payload.challenge)
      || !Number.isSafeInteger(payload.number) || payload.number < 0 || payload.number >= 100000
      || typeof payload.salt !== 'string' || payload.salt.length > 512
      || typeof payload.signature !== 'string' || !/^[a-f0-9]{64}$/.test(payload.signature)) {
    return false;
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
  if (!timingSafeEqual(a, b)) return false;

  // 3–4. Only metadata in the verified salt establishes expiry and purpose.
  const saltMatch = /^[a-f0-9]{24}\?(.+)$/.exec(payload.salt);
  if (!saltMatch?.[1]) return false;
  const metadata = new URLSearchParams(saltMatch[1]);
  const expires = metadata.get('expires');
  const signedPurpose = metadata.get('purpose');
  if (metadata.getAll('expires').length !== 1 || metadata.getAll('purpose').length !== 1
      || metadata.size !== 2 || !expires || !/^\d{13}$/.test(expires)) return false;
  const expiresAt = Number(expires);
  if (Date.now() > expiresAt || expiresAt > Date.now() + 20 * 60 * 1000) return false;
  if (purpose && signedPurpose !== purpose) return false;
  if (payload.expires_at != null && payload.expires_at !== expiresAt) return false;
  if (payload.purpose != null && payload.purpose !== signedPurpose) return false;

  // 5. Atomically consume the challenge using the portable Redis client.
  // If Redis is unavailable,
  // fail closed — do not accept untracked proofs.
  const fingerprint = payload.challenge;
  try {
    const ttl = Math.max(60, Math.ceil((expiresAt - Date.now()) / 1000));
    const key = `altcha:used:${fingerprint}`;
    const result = await withProtectionRedis(redis => redis.set(key, '1', {NX: true, EX: ttl}));
    if (result !== 'OK') {
      // Already consumed (nil)
      return false;
    }
  } catch {
    // Redis unavailable — fail closed in production
    if (!devMode) return false;
  }

  return true;
}
