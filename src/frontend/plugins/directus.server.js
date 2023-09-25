import { createDirectus,authentication} from "@directus/sdk";
import { rest, readItem, readItems, readTranslations } from "@directus/sdk/rest";
import resolveFullLocaleCode from "~/shared/resolveFullLocaleCode.js";
import createTranslator from "~/shared/createTranslator.js";


const directusUrl = "http://directus:8055"; //TODO

const directus = createDirectus(directusUrl).with(rest()).with(authentication());



const locale = resolveFullLocaleCode();

export default defineNuxtPlugin(async () => {
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
