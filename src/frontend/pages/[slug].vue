<template>
  <article v-if="page" class="prose py-8" v-html="page.translations[0].contents" />
  <p v-else class="prose py-8">
    {{ t("page_not_found") }}
  </p>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();
const { locale, t } = useI18n();
const route = useRoute();

const { data: pagesWithSlug } = await useAsyncData("pagesWithSlug", () => {
  return $directus.request(
    $readItems("pages", {
      filter: { slug: { _eq: route.params.slug } },
      fields: ["*", "translations.*"],
      deep: {
        translations: {
          _filter: {
            languages_code: { _eq: locale.value },
          },
        },
      },
      limit: 1,
    }),
  );
});
const page = pagesWithSlug.value[0] || null;

//MetaTags
const title = page ? ref(page.translations[0].name) : t("page_not_found");

useHead({
  title,
});
//
</script>
