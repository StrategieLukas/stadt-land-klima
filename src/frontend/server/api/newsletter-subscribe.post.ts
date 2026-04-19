export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const endpoint = config.listmonkEndpoint as string | undefined;
  const username = config.listmonkApiUsername as string | undefined;
  const token = config.listmonkApiToken as string | undefined;
  const defaultListId = config.listmonkListId as string | undefined;

  if (!endpoint || !username || !token) {
    throw createError({ statusCode: 503, message: 'Newsletter-Dienst nicht konfiguriert.' });
  }

  const body = await readBody(event);
  const { email, name, listIds } = body ?? {};

  if (!email?.trim()) {
    throw createError({ statusCode: 400, message: 'E-Mail-Adresse fehlt.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw createError({ statusCode: 400, message: 'Ungültige E-Mail-Adresse.' });
  }

  // Resolve which list IDs to subscribe to
  let targetIds: number[];
  if (Array.isArray(listIds) && listIds.length > 0) {
    targetIds = listIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (targetIds.length === 0) {
      throw createError({ statusCode: 400, message: 'Ungültige Listen-IDs.' });
    }
  } else if (defaultListId) {
    targetIds = [Number(defaultListId)];
  } else {
    throw createError({ statusCode: 503, message: 'Newsletter-Dienst nicht konfiguriert.' });
  }

  // Resolve list IDs → UUIDs (required by the public subscription endpoint)
  const credentials = Buffer.from(`${username}:${token}`).toString('base64');
  let listUuids: string[];
  try {
    const listsResult = await $fetch<{
      data: { results: Array<{ id: number; uuid: string }> }
    }>(`${endpoint}/api/lists`, {
      headers: { Authorization: `Basic ${credentials}` },
      query: { page: 1, per_page: 100 },
    });
    const allLists = listsResult?.data?.results ?? [];
    listUuids = targetIds
      .map((id) => allLists.find((l) => l.id === id)?.uuid)
      .filter((u): u is string => !!u);
    if (listUuids.length === 0) {
      throw createError({ statusCode: 503, message: 'Keine passende Newsletter-Liste gefunden.' });
    }
  } catch (err: any) {
    if (err?.statusCode) throw err;
    console.error('[newsletter-subscribe] Failed to fetch lists:', err);
    throw createError({ statusCode: 502, message: 'Anmeldung fehlgeschlagen. Bitte versuche es später erneut.' });
  }

  // Use the public subscription endpoint — handles double opt-in and sends confirmation mail
  try {
    await $fetch(`${endpoint}/api/public/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: email.trim(),
        name: name?.trim() || email.trim(),
        list_uuids: listUuids,
      },
    });
  } catch (err: any) {
    // 409 = already subscribed
    if (err?.status === 409 || err?.response?.status === 409) {
      return { success: true, alreadySubscribed: true };
    }
    console.error('[newsletter-subscribe] Listmonk error:', err?.data ?? err);
    throw createError({ statusCode: 502, message: 'Anmeldung fehlgeschlagen. Bitte versuche es später erneut.' });
  }

  return { success: true, alreadySubscribed: false };
});
