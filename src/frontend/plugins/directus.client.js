import { createDirectus } from "@directus/sdk";
import { rest, readItem, readItems, readTranslations } from "@directus/sdk/rest";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";
const directusUrl = process.env.DIRECTUS_URL || "http://127.0.0.1:8081";
const directus = createDirectus(directusUrl).with(rest());
const locale = resolveFullLocaleCode(document.documentElement.getAttribute("lang"));

// eslint-disable-next-line no-undef
export default defineNuxtPlugin(async () => {
  const translations = await directus.request(
    readTranslations({
      limit: -1,
      filter: { language: { _eq: locale } },
    }),
  );

  const translator = createTranslator(translations);

  return {
    provide: {
      directus,
      readItem,
      readItems,
      locale,
      t: translator.t,
    },
  };
});
