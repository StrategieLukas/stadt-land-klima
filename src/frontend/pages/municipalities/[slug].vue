<template>
  <div>
    <detail-municipality :municipality="municipality[0]" :sorted-ratings="dictMassnhamenBewertungeSorted"></detail-municipality>
  </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();
const route = useRoute();

const { data: municipalities } = await useAsyncData("municipality", () => {
  return $directus.request(
    $readItems("municipalities", {
      filter: { slug: { _eq: route.params.slug } },
      limit: 1,
    }),
  );
});
const municipality = municipalities.value[0] || null;
const localteam_id = municipality.value[0].localteam_id;
const { data: ratings_measures } = await useAsyncData("ratings_measures", () => {
  return $directus.request(
    $readItems("ratings_measures", {
      filter: { localteam_id: { _eq: localteam_id } },
    }),
  );
});
const { data: measures } = await useAsyncData("measures", () => {
  return $directus.request($readItems("measures", {}));
});

const bmArray = ratings_measures.value;
const measuresArray = measures.value;

function sortMeasureBySector() {
  //TODO Error HAndline
  const dictMassnhamenBewertungeSorted = {};
  for (const key in bmArray) {
    for (const key2 in measuresArray) {
      if (bmArray[key].measure_id === measuresArray[key2].id) {
        bmArray[key].measure = measuresArray[key2];
        console.log("succes", bmArray[key]);
      }
    }
    if (!Object.prototype.hasOwnProperty.call(dictMassnhamenBewertunge, bmArray[key].measure.sector)) {
      dictMassnhamenBewertungeSorted[bmArray[key].measure.sector] = [];
      console.log("succes2");
    }
    dictMassnhamenBewertungeSorted[bmArray[key].measure.sector].push(ratings_measures.value[key]);
  }

  return dictMassnhamenBewertungeSorted;
}
</script>
