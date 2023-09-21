<template>
  <div>
    <detail-kommune :kommune="kommune[0]" :sorted-bewertungen="dictMassnhamenBewertungeSorted"></detail-kommune>
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
const lokalteam_id = kommune.value[0].lokalteam_id;
const { data: bewertungen_massnahmen } = await useAsyncData("bewertungen_massnahmen", () => {
  return $directus.request(
    $readItems("bewertungen_massnahmen", {
      filter: { lokalteam_id: { _eq: lokalteam_id } },
    }),
  );
});
const { data: massnahmen } = await useAsyncData("massnahmen", () => {
  return $directus.request($readItems("massnahmen", {}));
});

const bmArray = bewertungen_massnahmen.value;
const massnahmenArray = massnahmen.value;

function sortMassnahmneBySector() {
  //TODO Error HAndline
  const dictMassnhamenBewertungeSorted = {};
  for (const key in bmArray) {
    for (const key2 in massnahmenArray) {
      if (bmArray[key].massnahme_id === massnahmenArray[key2].id) {
        bmArray[key].massnahme = massnahmenArray[key2];
        console.log("succes", bmArray[key]);
      }
    }
    if (!Object.prototype.hasOwnProperty.call(dictMassnhamenBewertunge, bmArray[key].massnahme.sektor)) {
      dictMassnhamenBewertungeSorted[bmArray[key].massnahme.sektor] = [];
      console.log("succes2");
    }
    dictMassnhamenBewertungeSorted[bmArray[key].massnahme.sektor].push(bewertungen_massnahmen.value[key]);
  }

  return dictMassnhamenBewertungeSorted;
}
</script>
