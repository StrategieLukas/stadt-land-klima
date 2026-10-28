import { useNuxtApp } from "#app";
import { CONTENT_LOCALE_QUERY, contentTranslationPolicy } from "~/shared/contentTranslation";

/** Capture Nuxt context during setup, then use this typed fetch in async callbacks too. */
export function useContentFetch(): typeof $fetch {
  const { $locale } = useNuxtApp();
  return $fetch.create({
    onRequest({ request, options }) {
      if (typeof request === "string" && contentTranslationPolicy(request)) {
        options.query = { ...options.query, [CONTENT_LOCALE_QUERY]: $locale };
      }
    },
  });
}
