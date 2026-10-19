import { defineNuxtPlugin, useCookie, useRuntimeConfig } from "#app";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";

const localeCookieName = "slk_locale";

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  const appEnv = runtimeConfig.public.appEnv || "development";
  const localeCookie = useCookie(localeCookieName);
  const locale = resolveFullLocaleCode(localeCookie.value || document.documentElement.getAttribute("lang"));

  // Translations are fetched server-side and passed via Nuxt state.
  // The browser no longer has a Directus token for content access.
  const translationState = useState('directus-translations', () => [])
  let translations = translationState.value
  if (!translations || translations.length === 0) {
    try {
      // Fallback: fetch translations from the server route
      const result = await $fetch('/api/public/translations', {
        query: { language: locale },
      })
      translations = result.translations || []
      translationState.value = translations
    } catch (e) {
      console.warn('[directus.client] Failed to load translations:', e?.message)
    }
  }

  const translator = createTranslator(translations);

  return {
    provide: {
      appEnv,
      locale,
      t: translator.t,
    },
  };
});
