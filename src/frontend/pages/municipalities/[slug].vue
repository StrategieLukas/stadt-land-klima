<template>
  <div>
    <NuxtLink :to="`/municipalities`" class="btn btn-ghost mt-4 normal-case">
      {{ $t("municipality.back_label") }}
    </NuxtLink>
    <article class="mb-8 mt-10">
      <detail-municipality
        :municipality="municipalities[0]"
        :sorted-ratings="sortMeasuresBySectorDict"
      ></detail-municipality>
    </article>
    <NuxtLink :to="`/municipalities`" class="btn btn-ghost mb-4 normal-case">
      {{ $t("municipality.back_label") }}
    </NuxtLink>
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
const sortMeasuresBySectorDict = computed(() => {
  return sortMeasuresBySector(rmArray, measuresArray);
});

function sortMeasuresBySector(ratingsMeasuresArr, measuresArr) {
  const measureMap = new Map(measuresArr.map((measure) => [measure.id, measure]));
  const dictMeasuresRatingSorted = {};

  for (const item of ratingsMeasuresArr) {
    const measure = measureMap.get(item.measure_id);
    if (measure) {
      const { sector } = measure;
      item.measure = measure;
      dictMeasuresRatingSorted[sector] = dictMeasuresRatingSorted[sector] || [];
      dictMeasuresRatingSorted[sector].push(item);
    }
  }
  return dictMeasuresRatingSorted;
}
</script>
