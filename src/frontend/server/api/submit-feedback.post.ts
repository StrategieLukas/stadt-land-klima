import { createDirectus, rest, staticToken, createItem } from '@directus/sdk';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const ALLOWED_TYPES = ['legal', 'bug', 'inaccuracy', 'suggestion', 'cooperation', 'other'];

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
  const expectedChallenge = createHash('SHA-256')
    .update(`${payload.salt}${payload.number}`)
    .digest('hex');
  if (expectedChallenge !== payload.challenge) return false;
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
  const { title, type, content, name, contact, altcha } = body ?? {};

  // Validate required fields
  if (!title?.trim() || !type?.trim() || !content?.trim() || !name?.trim() || !contact?.trim()) {
    throw createError({ statusCode: 400, message: 'Bitte alle Pflichtfelder ausfüllen.' });
  }

  // Allowlist type to prevent arbitrary values reaching the DB
  if (!ALLOWED_TYPES.includes(type)) {
    throw createError({ statusCode: 400, message: 'Ungültiger Feedback-Typ.' });
  }

  // Basic email check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim())) {
    throw createError({ statusCode: 400, message: 'Ungültige E-Mail-Adresse.' });
  }

  // Verify CAPTCHA
  if (!altcha || !verifyAltcha(altcha, hmacKey)) {
    throw createError({ statusCode: 400, message: 'CAPTCHA-Überprüfung fehlgeschlagen. Bitte Seite neu laden und es erneut versuchen.' });
  }

  // Submit to Directus using server-side admin token
  const directusUrl = (config.directusServerUrl as string) || 'http://directus:8055';
  const adminToken = config.directusAdminToken as string | undefined;

  if (!adminToken) {
    console.error('[submit-feedback] DIRECTUS_ADMIN_TOKEN not configured');
    throw createError({ statusCode: 503, message: 'Feedback kann momentan nicht gespeichert werden. Bitte versuche es später erneut.' });
  }

  const client = createDirectus(directusUrl).with(rest()).with(staticToken(adminToken));

  try {
    await client.request(
      createItem('feedback', {
        title: title.trim(),
        type: type.trim(),
        content: content.trim(),
        sender_name: name.trim(),
        sender_contact: contact.trim(),
      }),
    );
  } catch (err) {
    console.error('[submit-feedback] Directus error:', err);
    throw createError({ statusCode: 502, message: 'Feedback konnte nicht gespeichert werden. Bitte versuche es später erneut.' });
  }

  return { success: true };
});
