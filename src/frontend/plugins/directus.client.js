import { createDirectus } from '@directus/sdk';
import { rest, readItem, readItems } from '@directus/sdk/rest';
const directusUrl = process.env.DIRECTUS_URL || 'http://127.0.0.1:8081';
const directus = createDirectus(directusUrl).with(rest());

export default defineNuxtPlugin(() => {
  return {
    provide: { directus, readItem, readItems },
  };
});
