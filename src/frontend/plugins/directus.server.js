import { createDirectus } from "@directus/sdk";
import { rest, readItem, readItems } from "@directus/sdk/rest";
const directusUrl = "http://directus:8055";
const directus = createDirectus(directusUrl).with(rest());

export default defineNuxtPlugin(() => {
  return {
    provide: { directus, readItem, readItems },
  };
});
