export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const endpoint = config.listmonkEndpoint as string | undefined;
  const username = config.listmonkApiUsername as string | undefined;
  const token = config.listmonkApiToken as string | undefined;
  const listId = config.listmonkListId as string | undefined;

  if (!endpoint || !username || !token || !listId) {
    throw createError({ statusCode: 503, message: 'Newsletter-Dienst nicht konfiguriert.' });
  }

  const body = await readBody(event);
  const { email, name } = body ?? {};

  if (!email?.trim()) {
    throw createError({ statusCode: 400, message: 'E-Mail-Adresse fehlt.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw createError({ statusCode: 400, message: 'Ungültige E-Mail-Adresse.' });
  }

  const credentials = Buffer.from(`${username}:${token}`).toString('base64');

  try {
    await $fetch(`${endpoint}/api/subscribers`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: {
        email: email.trim(),
        name: name?.trim() || email.trim(),
        status: 'enabled',
        lists: [Number(listId)],
        preconfirm_subscriptions: false,
      },
    });
  } catch (err: any) {
    // Listmonk returns 409 when the email is already subscribed — treat as success
    if (err?.status === 409 || err?.response?.status === 409) {
      return { success: true, alreadySubscribed: true };
    }
    console.error('[newsletter-subscribe] Listmonk error:', err);
    throw createError({ statusCode: 502, message: 'Anmeldung fehlgeschlagen. Bitte versuche es später erneut.' });
  }

  return { success: true, alreadySubscribed: false };
});
