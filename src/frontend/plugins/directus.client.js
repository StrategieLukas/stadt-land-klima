import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { createDirectus,authentication} from "@directus/sdk";
import { rest, readItem, readItems, readTranslations } from "@directus/sdk/rest";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";
const directusUrl = process.env.DIRECTUS_URL || "http://127.0.0.1:8081"; //TODO



const directus = createDirectus(directusUrl).with(rest()).with(authentication());
const locale = resolveFullLocaleCode(document.documentElement.getAttribute('lang'));

export default defineNuxtPlugin(async () => {
  console.log("created Client plugin");
  const runtimeConfig = useRuntimeConfig()
  const email =  runtimeConfig.public.emailDirectus;  
  const password = runtimeConfig.public.passwordDirectus;  
  await directus.login(email, password);  

  const translations = await directus.request(readTranslations({
    limit: -1,
    filter: { language: { _eq: locale } },
  }));

  const t = createTranslator(translations).t;

  return {
    provide: { directus, readItem, readItems, t },
  };
});
