import { createDirectus, rest, staticToken, createItem } from '@directus/sdk';

const ALLOWED_TYPES = ['legal', 'bug', 'inaccuracy', 'suggestion', 'cooperation', 'other'];

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

  // Submit to Directus using server-side token
  const directusUrl = config.serverDirectusUrl as string;
  const directusToken = config.public.directusToken as string;

  const client = createDirectus(directusUrl).with(rest()).with(staticToken(directusToken));

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
