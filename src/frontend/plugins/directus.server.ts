import { defineNuxtPlugin, useCookie, useRequestHeaders, useRuntimeConfig, useState } from "#app";
import { createDirectus, staticToken, rest, readTranslations } from "@directus/sdk";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode";
import { serviceBaseUrl } from "~/shared/serviceUrl";
import createTranslator from "~/shared/createTranslator";
import { TranslationsSchema, type TranslationEntry } from "~/shared/i18n";

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig();
  const locale = resolveFullLocaleCode(
    useCookie<unknown>("slk_locale").value || useRequestHeaders(["accept-language"])["accept-language"],
  );
  useHead({ htmlAttrs: { lang: locale } });
  useState("slk-locale", () => locale).value = locale;
  const directus = createDirectus(serviceBaseUrl(config.directusServerUrl, "http://directus:8055"))
    .with(rest())
    .with(staticToken(config.directusFrontendServerToken));
  const state = useState<TranslationEntry[]>("directus-translations", () => []);
  try {
    state.value = TranslationsSchema.parse(
      await directus.request(readTranslations({ limit: -1, filter: { language: { _eq: locale } } })),
    );
  } catch {
    state.value = [];
    console.warn("[directus.server] Translations unavailable");
  }
  const translator = createTranslator(state.value);
  return {
    provide: {
      appEnv: config.public.appEnv || "development",
      locale,
      t: translator.t,
      translateDynamic: translator.dynamic,
    },
  };
});
