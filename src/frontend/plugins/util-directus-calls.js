// IMPORTANT: THIS FILE NEEDS TO BE NAMED SO THAT IT IS ALPHABETICALLY AFTER THE OTHER DIRECTUS PLUGINs
// This is because it depends on them, and Nuxt loads Plugins alphabetically (and there is no stable other way yet...)

import { fetchArticlesWithOrganisations } from "../shared/complexDirectusCalls.js";

export default defineNuxtPlugin((nuxtApp) => {
    if (!nuxtApp.$directus) {
        throw new Error("SLK Error 173253: Directus plugin must be loaded before directus-calls plugin");
    }
    const $directus = nuxtApp.$directus;
    const $readItems = nuxtApp.$readItems;

  nuxtApp.provide(
    "fetchArticlesWithOrganisations",
    () => fetchArticlesWithOrganisations($directus, $readItems)
  );

});
