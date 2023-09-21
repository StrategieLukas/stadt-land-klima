<template>
  <article class="prose py-8" v-html="pages[0].inhalt">
  </article>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();
const route = useRoute();

const { data: pages } = await useAsyncData('pages', () => {
  return $directus.request(
    $readItems('pages', {
      filter: { slug: { _eq: route.params.slug } },
      limit: 1,
    }),
  );
});
</script>
