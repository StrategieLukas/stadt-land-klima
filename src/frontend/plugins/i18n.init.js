import { defineNuxtPlugin, useNuxtApp } from "#app";
import { fetchAndApplyTranslations } from "#shared/loadTranslations";

export default defineNuxtPlugin(async () => {
  const { $i18n, $directus } = useNuxtApp();
  await fetchAndApplyTranslations($i18n, $directus);
});
