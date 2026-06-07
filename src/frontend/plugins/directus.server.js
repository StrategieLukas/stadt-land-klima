import { defineNuxtPlugin, useCookie, useRequestHeaders, useRuntimeConfig } from "#app";
import { createDirectus, staticToken, rest, readItem, readItems, readSingleton, readTranslations } from "@directus/sdk";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";

const localeCookieName = "slk_locale";

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  const token = runtimeConfig.public.directusToken;
  const directusUrl = runtimeConfig.public.serverDirectusUrl || "http://directus:8055";
  const appEnv = runtimeConfig.public.appEnv || "development";
  const localeCookie = useCookie(localeCookieName);
  const headers = useRequestHeaders(["accept-language"]);
  const locale = resolveFullLocaleCode(localeCookie.value || headers["accept-language"]);
  let directus = createDirectus(directusUrl).with(rest()).with(staticToken(token));
  let translations = []
  try {
    translations = await directus.request(
      readTranslations({
        limit: -1,
        filter: { language: { _eq: locale } },
      }),
    )
  } catch (e) {
    console.warn('[directus.server] Failed to load translations:', e?.message)
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
