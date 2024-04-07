import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { createDirectus } from "@directus/sdk";
import { staticToken } from "@directus/sdk/auth";
import { rest, readItem, readItems, readTranslations } from "@directus/sdk/rest";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";

const locale = resolveFullLocaleCode();

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  const token = runtimeConfig.public.directusToken;
  const directusUrl = runtimeConfig.public.serverDirectusUrl || "http://directus:8055";
  const appEnv = runtimeConfig.public.appEnv || "development";
  let directus = createDirectus(directusUrl).with(rest()).with(staticToken(token));
  const translations = await directus.request(
    readTranslations({
      limit: -1,
      filter: { language: { _eq: locale } },
    }),
  );

  const translator = createTranslator(translations);

  return {
    provide: {
      appEnv,
      directus,
      readItem,
      readItems,
      locale,
      t: translator.t,
    },
  };
});
