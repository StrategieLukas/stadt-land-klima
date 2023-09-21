import { createDirectus } from "@directus/sdk";
import { rest, readItem, readItems, readTranslations } from "@directus/sdk/rest";
const directusUrl = process.env.DIRECTUS_URL || "http://127.0.0.1:8081";
const directus = createDirectus(directusUrl).with(rest());

// eslint-disable-next-line no-undef
export default defineNuxtPlugin(async () => {
  const translations = await directus.request(readTranslations({ limit: -1 }));
  const messages = {};
  translations.forEach((translation) => {
    messages[translation.key] = translation.value;
  });

  function t(key) {
    return messages[key] || key;
  }

  return {
    provide: { directus, readItem, readItems, t },
  };
});
