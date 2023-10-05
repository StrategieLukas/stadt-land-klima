<template>
  <div>
    <h1>Hello world!</h1>

    <the-ranking :municipalities="municipalities" class=""></the-ranking>
  </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();

//MetaTags
const title = ref("Ranking")
useHead({
  title,
})
// 

const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      sort: ["-score_total"],
    }),
  );
});
</script>
