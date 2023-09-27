import { createDirectus } from "@directus/sdk";
import { rest, readItem, readItems, readTranslations } from "@directus/sdk/rest";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";
const directusUrl = "http://directus:8055";
const directus = createDirectus(directusUrl).with(rest());
const locale = resolveFullLocaleCode();

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
