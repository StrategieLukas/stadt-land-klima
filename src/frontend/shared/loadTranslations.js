import { readTranslations } from "@directus/sdk/rest";

export async function fetchAndApplyTranslations(i18n, directus) {
  const response = await directus.request(
    readTranslations({
      limit: -1,
      filter: { language: { _eq: i18n.locale.value } },
    }),
  );

  const messages = {};
  response.forEach((translation) => {
    messages[translation.key] = translation.value;
  });

  return i18n.mergeLocaleMessage(i18n.locale.value, messages);
}
