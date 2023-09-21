<template>
  <div>
    <the-ranking :kommunen="kommunen" class=""></the-ranking>
  </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();

const { data: kommunen } = await useAsyncData("kommunen", () => {
  return $directus.request(
    $readItems("kommunen", {
      sort: ["-score_total"],
    }),
  );
});
</script>
