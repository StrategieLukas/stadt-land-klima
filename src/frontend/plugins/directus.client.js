import { defineNuxtPlugin, useCookie, useRuntimeConfig } from "#app";
import { createDirectus, staticToken, rest, readItem, readItems, readSingleton, readTranslations } from "@directus/sdk";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";

const localeCookieName = "slk_locale";

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  const directusUrl = runtimeConfig.public.clientDirectusUrl || "http://127.0.0.1:8081";
  const token = runtimeConfig.public.directusToken;
  const appEnv = runtimeConfig.public.appEnv || "development";
  const localeCookie = useCookie(localeCookieName);
  const locale = resolveFullLocaleCode(localeCookie.value || document.documentElement.getAttribute("lang"));
  const directus = createDirectus(directusUrl).with(rest()).with(staticToken(token));
  let translations = []
  try {
    translations = await directus.request(
      readTranslations({
        limit: -1,
        filter: { language: { _eq: locale } },
      }),
    )
  } catch (e) {
    console.warn('[directus.client] Failed to load translations:', e?.message)
  }

  const translator = createTranslator(translations);

  return {
    provide: {
      appEnv,
      directus,
      readItem,
      readItems,
      readSingleton,
      locale,
      t: translator.t,
    },
  };
});
