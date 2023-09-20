<template>
  <div>
    <h1 class="text-3xl font-bold underline">Hello world!</h1>

    <the-ranking :kommunen="kommunen"></the-ranking>
  </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();

const { data: kommunen } = await useAsyncData('kommunen', () => {
  return $directus.request($readItems('kommunen', {}));
});
</script>
