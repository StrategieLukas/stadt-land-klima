<template>
  <div class="w-full">
    <article v-if="page" class="prose px-4 py-8 max-w-4xl mx-auto w-full self-center" v-html="page.contents" />
    <p v-else class="prose px-4 py-8 max-w-4xl mx-auto w-full self-center">
      {{ $t("page_not_found") }}
    </p>
  </div>
</template>
<script setup>
const { $directus, $readItems, $t } = useNuxtApp();

const { data: indexPages } = await useAsyncData("indexPages", () => {
  return $directus.request(
    $readItems("pages", {
      filter: { slug: { _eq: "index" } },
      limit: 1,
    }),
  );
});
const page = indexPages.value[0] || null;

//MetaTags
const title = page ? ref(page.name) : $t("page_not_found");

//MetaTags
useHead({
  title,
}); //
</script>
