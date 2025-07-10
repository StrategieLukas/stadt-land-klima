<template>
  <article v-if="page" class="prose py-8" v-html="page.contents" />
  <p v-else class="prose py-8">
    {{ t("page_not_found") }}
  </p>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();
const { t } = useI18n();
const route = useRoute();

const { data: pagesWithSlug } = await useAsyncData("pagesWithSlug", () => {
  return $directus.request(
    $readItems("pages", {
      filter: { slug: { _eq: route.params.slug } },
      limit: 1,
    }),
  );
});
const page = pagesWithSlug.value[0] || null;

//MetaTags
const title = page ? ref(page.name) : t("page_not_found");

useHead({
  title,
});
//
</script>
