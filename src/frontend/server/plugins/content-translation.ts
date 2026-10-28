import { getQuery, setResponseHeader } from "h3";
import { contentTranslationPolicy } from "~/shared/contentTranslation";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode";
import { translatePublicContent } from "../utils/contentTranslation";
import { requestLog } from "../utils/securityLogging";

/** Runs after each endpoint's authorization, projection and validation, before JSON serialization. */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("beforeResponse", async (event, response) => {
    if (event.method !== "GET" || event.node.res.statusCode >= 400) return;
    const policy = contentTranslationPolicy(event.path);
    if (!policy || !response.body || typeof response.body !== "object" || response.body instanceof Error) return;
    // The explicit query is part of HTTP cache identity; cookies/headers cannot vary this response.
    const locale = resolveFullLocaleCode(getQuery(event).contentLocale);
    const result = await translatePublicContent(response.body, locale, policy);
    response.body = result.data;
    if (result.degraded || result.pending) setResponseHeader(event, "Cache-Control", "no-store");
    if (result.degraded) requestLog(event, "warn", "content.translation.degraded");
  });
});
