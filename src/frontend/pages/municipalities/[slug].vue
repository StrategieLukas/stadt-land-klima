<template>
  <NuxtLink :to="`/municipalities`" class="btn btn-ghost normal-case mt-4">
    {{ $t('municipality.back_label') }}
  </NuxtLink>
  <article class="mb-8 mt-10">
    <detail-municipality :municipality="municipalities[0]" :sorted-ratings="sortMeasuresBySectorDict"></detail-municipality>
  </article>
  <NuxtLink :to="`/municipalities`" class="btn btn-ghost normal-case mb-4">
    {{ $t('municipality.back_label') }}
  </NuxtLink>
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
const localteam_id = municipalities.value[0].localteam_id;
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

const rmArray = ratings_measures.value;
const measuresArray = measures.value;
const sortMeasuresBySectorDict = sortMeasuresBySector()

function sortMeasuresBySector() {
  //TODO Error HAndline
  const dictMeasuresRatingSorted = {};
  for (const key in rmArray) {
    for (const key2 in measuresArray) {
      if (rmArray[key].measure_id === measuresArray[key2].id) {
        rmArray[key].measure = measuresArray[key2];
      }
    }
    if (!Object.prototype.hasOwnProperty.call(dictMeasuresRatingSorted, rmArray[key].measure.sector)) {
      dictMeasuresRatingSorted[rmArray[key].measure.sector] = [];
    }
    dictMeasuresRatingSorted[rmArray[key].measure.sector].push(rmArray[key]);
  }

  return dictMeasuresRatingSorted;
}
</script>
