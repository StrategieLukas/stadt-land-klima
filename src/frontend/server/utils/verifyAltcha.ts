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

  let payload: AltchaPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
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
  if (typeof payload.challenge !== 'string' || typeof payload.number !== 'number'
      || typeof payload.salt !== 'string' || typeof payload.signature !== 'string') {
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

  // 3. Enforce expiration if present
  if (payload.expires_at != null) {
    if (typeof payload.expires_at !== 'number') return false;
    if (Date.now() > payload.expires_at) return false;
  }

  // 4. Enforce purpose binding: only if the payload carries a purpose AND the caller
  // expects one, they must match. If the payload has no purpose (challenge generated
  // without ?purpose=), skip the check for backward compatibility.
  if (purpose && payload.purpose != null && payload.purpose !== purpose) {
    return false;
  }

  // 5. Single-use consumption: record the challenge fingerprint in Redis via raw
  // RESP protocol to avoid a native-module dependency. If Redis is unavailable,
  // fail closed — do not accept untracked proofs.
  const fingerprint = `${payload.algorithm}:${payload.challenge}`;
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://cache:6379';
    const url = new URL(redisUrl);
    const host = url.hostname;
    const port = Number(url.port) || 6379;
    const ttl = payload.expires_at
      ? Math.max(60, Math.ceil((payload.expires_at - Date.now()) / 1000))
      : 1200;
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
