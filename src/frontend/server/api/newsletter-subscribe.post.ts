import { z } from "zod";
import { NewsletterRequestSchema } from "~/shared/contracts/submissions";
import { rateLimit } from "../utils/rateLimit";
export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, "newsletter"))) {
    throw createError({ statusCode: 429, message: "Zu viele Anfragen. Bitte versuche es später erneut." });
  }
  const config = useRuntimeConfig();
  const endpoint = config.listmonkEndpoint?.replace(/\/+$/, "");
  const username = config.listmonkApiUsername as string | undefined;
  const token = config.listmonkApiToken as string | undefined;
  const defaultListId = config.listmonkListId as string | undefined;

  if (!endpoint || !username || !token) {
    throw createError({ statusCode: 503, message: "Newsletter-Dienst nicht konfiguriert." });
  }

  const parsedBody = NewsletterRequestSchema.safeParse(await readRequestBody(event, 64 * 1024));
  if (!parsedBody.success)
    throw createError({ statusCode: 400, message: "Ungültige Eingaben. Bitte prüfe das Formular." });
  const body = parsedBody.data;
  const { email, name, listIds } = body ?? {};

  if (!email?.trim()) {
    throw createError({ statusCode: 400, message: "E-Mail-Adresse fehlt." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw createError({ statusCode: 400, message: "Ungültige E-Mail-Adresse." });
  }

  // Resolve which list IDs to subscribe to
  let targetIds: number[];
  if (Array.isArray(listIds) && listIds.length > 0) {
    targetIds = listIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (targetIds.length === 0) {
      throw createError({ statusCode: 400, message: "Ungültige Listen-IDs." });
    }
  } else if (defaultListId && Number.isSafeInteger(Number(defaultListId)) && Number(defaultListId) > 0) {
    targetIds = [Number(defaultListId)];
  } else {
    throw createError({ statusCode: 503, message: "Newsletter-Dienst nicht konfiguriert." });
  }

  // Resolve list IDs → UUIDs (required by the public subscription endpoint)
  const credentials = Buffer.from(`${username}:${token}`).toString("base64");
  let listUuids: string[];
  try {
    const listsResult = z
      .object({
        data: z.object({ results: z.array(z.object({ id: z.number().int(), uuid: z.string(), type: z.string() })) }),
      })
      .parse(
        await $fetch<unknown>(`${endpoint}/api/lists`, {
          timeout: 10_000,
          headers: { Authorization: `Basic ${credentials}` },
          query: { page: 1, per_page: 100 },
        }),
      );
    // Only allow subscription to public lists — reject private list ID manipulation
    // An explicit server-owned default is trusted; browser-selected lists must be public.
    const publicLists = listsResult.data.results.filter(
      (list) => list.type === "public" || (!listIds && list.id === Number(defaultListId)),
    );
    if (targetIds.some((id) => !publicLists.some((list) => list.id === id)))
      throw createError({ statusCode: 400, message: "Ungültige Listen-IDs." });
    const allLists = publicLists;
    listUuids = targetIds.map((id) => allLists.find((l) => l.id === id)?.uuid).filter((u): u is string => !!u);
    if (listUuids.length === 0) {
      throw createError({ statusCode: 503, message: "Keine passende Newsletter-Liste gefunden." });
    }
  } catch (err: unknown) {
    if (err && typeof err === "object" && "statusCode" in err && err.statusCode === 400) throw err;
    console.error("[newsletter-subscribe] Failed to fetch lists");
    throw createError({ statusCode: 502, message: "Anmeldung fehlgeschlagen. Bitte versuche es später erneut." });
  }

  // Use the public subscription endpoint — handles double opt-in and sends confirmation mail
  try {
    const response = await $fetch<unknown>(`${endpoint}/api/public/subscription`, {
      method: "POST",
      timeout: 10_000,
      headers: { "Content-Type": "application/json" },
      body: {
        email: email.trim(),
        name: name?.trim() || email.trim(),
        list_uuids: listUuids,
      },
    });
    z.object({ data: z.literal(true) }).parse(response);
  } catch (err: unknown) {
    // ofetch exposes the HTTP status on FetchError.status.
    if (err && typeof err === "object" && "status" in err && err.status === 409) {
      return { success: true, alreadySubscribed: true };
    }
    console.error("[newsletter-subscribe] Subscription failed");
    throw createError({ statusCode: 502, message: "Anmeldung fehlgeschlagen. Bitte versuche es später erneut." });
  }

  return { success: true, alreadySubscribed: false };
});
