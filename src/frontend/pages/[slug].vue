<template>
  <article v-if="pages.length" class="prose py-8" v-html="pages[0].contents" />
  <p v-else class="prose py-8">
    {{ $t("page_not_found") }}
  </p>
</template>
<script setup>
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();

const { data: pages } = await useAsyncData("pages", () => {
  return $directus.request(
    $readItems("pages", {
      filter: { slug: { _eq: route.params.slug } },
      limit: 1,
    }),
  );
});
console.log(pages);

//MetaTags
const title = ref(pages.value[0].name);
useHead({
  title,
});
//
</script>
