import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

interface AltchaPayload {
  algorithm: string;
  challenge: string;
  number: number;
  salt: string;
  signature: string;
}

function verifyAltcha(payloadB64: string, hmacKey: string): boolean {
  let payload: AltchaPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
  } catch {
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
  return timingSafeEqual(a, b);
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const hmacKey: string = (config.altchaSecret as string) || 'dev-secret-change-in-production';

  const body = await readBody(event);
  const { name, email, organisation, ars, altcha } = body ?? {};

  // Validate required fields
  if (!name?.trim() || !email?.trim() || !ars?.trim()) {
    throw createError({ statusCode: 400, message: 'Bitte alle Pflichtfelder ausfüllen.' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw createError({ statusCode: 400, message: 'Ungültige E-Mail-Adresse.' });
  }

  // Verify CAPTCHA
  if (!altcha || !verifyAltcha(altcha, hmacKey)) {
    throw createError({ statusCode: 400, message: 'CAPTCHA-Überprüfung fehlgeschlagen. Bitte Seite neu laden und es erneut versuchen.' });
  }

  // Forward to Directus flow (if configured)
  const flowUrl = config.directusFlowRegisterMunicipality as string | undefined;
  if (flowUrl) {
    try {
      await $fetch(flowUrl, {
        method: 'POST',
        body: {
          name: name.trim(),
          email: email.trim(),
          organisation: organisation?.trim() ?? '',
          ars: ars.trim(),
        },
      });
    } catch (err) {
      console.error('[register-municipality] Directus flow error:', err);
      throw createError({ statusCode: 502, message: 'Registrierung konnte nicht verarbeitet werden. Bitte versuche es später erneut.' });
    }
  } else {
    // No flow configured yet — log and succeed in dev
    console.info('[register-municipality] No DIRECTUS_FLOW_REGISTER_MUNICIPALITY configured. Received:', { name: name.trim(), email: email.trim(), organisation: organisation?.trim(), ars });
  }

  return { success: true };
});
