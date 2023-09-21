<template>
  <div>
    <h1>Hello world!</h1>

    <the-ranking :kommunen="kommunen" class="bg-ff-green"></the-ranking>
  </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();

const { data: kommunen } = await useAsyncData('kommunen', () => {
  return $directus.request($readItems('kommunen', {}));
});
</script>
