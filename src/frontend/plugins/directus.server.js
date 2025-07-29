import { defineNuxtPlugin, useRuntimeConfig } from "#app";
import { createDirectus } from "@directus/sdk";
import { staticToken } from "@directus/sdk/auth";
import { rest, readItem, readItems } from "@directus/sdk/rest";

export default defineNuxtPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  const token = runtimeConfig.public.directusToken;
  const directusUrl = runtimeConfig.public.serverDirectusUrl || "http://directus:8055";
  const appEnv = runtimeConfig.public.appEnv || "development";
  let directus = createDirectus(directusUrl).with(rest()).with(staticToken(token));

  return {
    provide: {
      appEnv,
      directus,
      readItem,
      readItems,
    },
  };
});
