import { readTranslations, type CoreSchema } from "@directus/sdk";
import { createError, defineEventHandler, getQuery, setResponseHeader } from "h3";
import { createTypedDirectusServerClient } from "../../utils/directusServerClient";
import { locales, TranslationsSchema } from "~/shared/i18n";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const language = query.language;
  if (language !== undefined && (typeof language !== "string" || !locales.some((locale) => locale === language))) {
    throw createError({ statusCode: 400, statusMessage: "Unsupported translation language" });
  }
  if (query.keys !== undefined && (typeof query.keys !== "string" || query.keys.length > 16000)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid translation keys" });
  }
  const keys =
    typeof query.keys === "string"
      ? query.keys
          .split(",")
          .map((key) => key.trim())
          .filter(Boolean)
      : [];
  const client = createTypedDirectusServerClient<CoreSchema<object>>();
  const rows = await client.request(
    readTranslations({
      fields: ["language", "key", "value"],
      filter: {
        ...(typeof language === "string" ? { language: { _eq: language } } : {}),
        ...(keys.length ? { key: { _in: keys } } : {}),
      },
      // Each supported language already exceeds Directus's default page size.
      limit: -1,
    }),
  );
  const parsed = TranslationsSchema.safeParse(rows);
  if (!parsed.success) throw createError({ statusCode: 502, statusMessage: "Invalid translations response" });
  setResponseHeader(event, "Cache-Control", "public, max-age=300");
  return { translations: parsed.data };
});
