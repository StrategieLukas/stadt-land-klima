import { requestLog } from "../utils/securityLogging";
import { NewsletterListsSchema } from "~/shared/contracts/submissions";
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const endpoint = config.listmonkEndpoint?.replace(/\/+$/, "");
  const username = config.listmonkApiUsername as string | undefined;
  const token = config.listmonkApiToken as string | undefined;

  if (!endpoint || !username || !token) {
    throw createError({ statusCode: 503, message: "Newsletter-Dienst nicht konfiguriert." });
  }

  const credentials = Buffer.from(`${username}:${token}`).toString("base64");

  try {
    const result = NewsletterListsSchema.parse(
      await $fetch<unknown>(`${endpoint}/api/lists`, {
        timeout: 10_000,
        headers: { Authorization: `Basic ${credentials}` },
        query: { page: 1, per_page: 100 },
      }),
    );

    const lists = (result?.data?.results ?? [])
      .filter((l) => l.type === "public")
      .map((l) => ({ id: l.id, name: l.name, description: l.description ?? "" }));

    return { lists };
  } catch {
    requestLog(event, "error", "app.server.api.newsletter-lists.get.failed");
    throw createError({ statusCode: 502, message: "Newsletter-Listen konnten nicht geladen werden." });
  }
});
