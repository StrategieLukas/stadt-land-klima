import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { createDirectus, staticToken, rest, readItem, readItems, readSingleton, readTranslations } from "@directus/sdk";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";

const locale = resolveFullLocaleCode();

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  const token = runtimeConfig.public.directusToken;
  const directusUrl = runtimeConfig.directusServerUrl || "http://directus:8055";
  const appEnv = runtimeConfig.public.appEnv || "development";
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

  // Store in Nuxt state so the client plugin can reuse them without a redundant
  // round-trip (translations are permission-gated and must not be fetched anonymously).
  const translationState = useState('directus-translations', () => [])
  translationState.value = translations

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
