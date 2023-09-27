import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { createDirectus } from "@directus/sdk";
import { staticToken } from "@directus/sdk/auth";
import { rest, readItem, readItems, readTranslations } from "@directus/sdk/rest";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";
const directusUrl = process.env.DIRECTUS_URL || "http://127.0.0.1:8081"; //TODO

let directus = createDirectus(directusUrl).with(rest());
const locale = resolveFullLocaleCode(document.documentElement.getAttribute("lang"));

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  const token = runtimeConfig.public.directusToken;
  directus = directus.with(staticToken(token));

  const translations = await directus.request(
    readTranslations({
      limit: -1,
      filter: { language: { _eq: locale } },
    }),
  );

  const t = createTranslator(translations).t;

  return {
    provide: { directus, readItem, readItems, t },
  };
});
