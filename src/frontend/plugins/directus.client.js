import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { createDirectus } from "@directus/sdk";
import { staticToken } from "@directus/sdk/auth";
import { rest, readItem, readItems, readSingleton, readTranslations } from "@directus/sdk/rest";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";
import resolveForBrowser from "~/shared/resolveForBrowser.js";

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  const directusUrl = resolveForBrowser(runtimeConfig.public.clientDirectusUrl || "http://localhost:8081");
  const token = runtimeConfig.public.directusToken;
  const appEnv = runtimeConfig.public.appEnv || "development";
  // Move locale detection inside the plugin so it runs after DOM is ready.
  const locale = resolveFullLocaleCode(document.documentElement.getAttribute("lang"));
  const directus = createDirectus(directusUrl).with(rest()).with(staticToken(token));

  // Reuse server-fetched translations from Nuxt state to avoid a redundant
  // client-side fetch (the endpoint requires authentication; a failed fetch
  // silently leaves $t returning raw keys).
  const translationState = useState('directus-translations', () => [])
  let translations = translationState.value
  if (!translations || translations.length === 0) {
    try {
      translations = await directus.request(
        readTranslations({
          limit: -1,
          filter: { language: { _eq: locale } },
        }),
      )
      translationState.value = translations
    } catch (e) {
      console.warn('[directus.client] Failed to load translations:', e?.message)
    }
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
