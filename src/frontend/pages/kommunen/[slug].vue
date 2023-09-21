<template>
  <div>
    <h1>{{ kommune[0].name }}</h1>
    <Kommune></Kommune>
  </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();
const route = useRoute();

const { data: kommune } = await useAsyncData('kommune', () => {
  return $directus.request(
    $readItems('kommunen', {
      filter: { slug: { _eq: route.params.slug } },
    }),
  );
});
console.log(kommune);
</script>
