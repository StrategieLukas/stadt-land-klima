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
    if (devMode && parsed.dev === true) return true;
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
  if (devMode && payload.dev === true) {
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

  // 5. Single-use consumption: record the challenge fingerprint in Redis via raw
  // RESP protocol to avoid a native-module dependency. If Redis is unavailable,
  // fail closed — do not accept untracked proofs.
  const fingerprint = payload.challenge;
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://cache:6379';
    const url = new URL(redisUrl);
    const host = url.hostname;
    const port = Number(url.port) || 6379;
    const ttl = Math.max(60, Math.ceil((expiresAt - Date.now()) / 1000));
    const key = `altcha:used:${fingerprint}`;
    // Build RESP3 array: *6 SET key 1 NX EX ttl
    const args = ['SET', key, '1', 'NX', 'EX', String(ttl)];
    const CRLF = '\r\n';
    let cmd = `*${args.length}${CRLF}`;
    for (const arg of args) {
      cmd += `$${Buffer.byteLength(arg)}${CRLF}${arg}${CRLF}`;
    }
    const { connect } = await import('node:net');
    const result = await new Promise<string | null>((resolve, reject) => {
      const socket = connect(port, host);
      socket.setTimeout(3000);
      const chunks: Buffer[] = [];
      socket.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        // RESP: +OK\r\n or $-1\r\n (nil bulk string for NX failure)
        if (raw.startsWith('+OK')) {
          socket.destroy();
          resolve('OK');
        } else if (raw.startsWith('$-1')) {
          socket.destroy();
          resolve(null);
        } else if (raw.length > 200) {
          // Safety: if we got too much data without a clear response, give up
          socket.destroy();
          reject(new Error(`Unexpected Redis response: ${raw.slice(0, 100)}`));
        }
      });
      socket.on('error', (err) => { socket.destroy(); reject(err); });
      socket.on('timeout', () => { socket.destroy(); reject(new Error('Redis timeout')); });
      socket.write(cmd);
    });
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
