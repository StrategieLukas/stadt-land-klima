<template>
  <div>
    <article v-if="page" class="prose py-8" v-html="page.contents" />
    <p v-else class="prose py-8">
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
