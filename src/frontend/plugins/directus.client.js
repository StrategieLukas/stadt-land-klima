import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { createDirectus } from "@directus/sdk";
import { staticToken } from "@directus/sdk/auth";
import { rest, readItem, readItems } from "@directus/sdk/rest";

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  const directusUrl = runtimeConfig.public.clientDirectusUrl || "http://127.0.0.1:8081";
  const token = runtimeConfig.public.directusToken;
  const appEnv = runtimeConfig.public.appEnv || "development";
  const directus = createDirectus(directusUrl).with(rest()).with(staticToken(token));

  return {
    provide: {
      appEnv,
      directus,
      readItem,
      readItems,
    },
  };
});
