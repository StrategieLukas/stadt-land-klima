import { clientDiagnostic } from "~/shared/securityLog";
import { defineNuxtPlugin, useRuntimeConfig, useState } from "#app";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode";
import createTranslator from "~/shared/createTranslator";
import { TranslationsSchema, type TranslationEntry } from "~/shared/i18n";

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig();
  // SSR already resolves the locale cookie/header. Reuse it without touching
  // document.cookie, which browsers may deny in a third-party frame.
  const locale = useState("slk-locale", () =>
    resolveFullLocaleCode(document.documentElement.getAttribute("lang")),
  ).value;
  const state = useState<TranslationEntry[]>("directus-translations", () => []);
  const parsed = TranslationsSchema.safeParse(state.value);
  state.value = parsed.success ? parsed.data : [];
  if (!state.value.length) {
    try {
      const response = await $fetch("/api/public/translations", { query: { language: locale } });
      state.value = TranslationsSchema.parse(response.translations);
    } catch {
      clientDiagnostic("app.plugins.directus.client.degraded", "warn");
    }
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
