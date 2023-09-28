import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { createDirectus } from "@directus/sdk";
import { staticToken } from "@directus/sdk/auth";
import { rest, readItem, readItems, readTranslations } from "@directus/sdk/rest";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";

const locale = resolveFullLocaleCode(document.documentElement.getAttribute("lang"));

export default defineNuxtPlugin(async () => {

  
  const runtimeConfig = useRuntimeConfig();
  const directusUrl = runtimeConfig.public.clientDirectusUrl || "http://127.0.0.1:8081"; 
  const token = runtimeConfig.public.directusToken;
  const directus = createDirectus(directusUrl).with(rest()).with(staticToken(token));
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
