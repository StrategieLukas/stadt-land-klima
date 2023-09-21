<template>
  <div>
    <detail-kommune :kommune="kommune[0]"></detail-kommune>
  </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();
const route = useRoute();

const { data: kommune } = await useAsyncData("kommune", () => {
  return $directus.request(
    $readItems("kommunen", {
      filter: { slug: { _eq: route.params.slug } },
    }),
  );
});
const { data: massnahmen } = await useAsyncData("massnahmen", () => {
  return $directus.request($readItems("massnahmen", {}));
});
const { data: bewertungen_massnahmen } = await useAsyncData("bewertungen_massnahmen", () => {
  return $directus.request(
    $readItems("bewertungen_massnahmen", {
      filter: { lokalteam_id: { _eq: kommunen[0].lokalteam_id } },
    }),
  );
});
console.log(kommune);
console.log("massnahmen", massnahmen);
console.log("bewertungen_massnahmen", bewertungen_massnahmen);
</script>
