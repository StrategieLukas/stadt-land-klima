<template>
  <div>
    <waving-banner v-if="directusData.municipalities[0].status === 'draft'">
      {{ $t("municipalities.preview_text") }}
    </waving-banner>
    <NuxtLink :to="`/municipalities`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
    <article class="mb-8 mt-10">
      <detail-municipality
        :municipality="directusData.municipalities[0]"
        :sorted-ratings="sortMeasuresBySectorDict"
      ></detail-municipality>
    </article>
    <NuxtLink :to="`/municipalities`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
  </div>
</template>
<script setup>
const { $directus, $readItems } = useNuxtApp();
const route = useRoute();

const { data: directusData } = await useAsyncData("municipality", async () => {
  const [municipalities, measures] = await Promise.all([
    $directus.request(
      $readItems("municipalities", {
        filter: { slug: { _eq: route.params.slug } },
        limit: 1,
      }),
    ),
    $directus.request($readItems("measures", {})),
  ]);
  const ratingsMeasures = await $directus.request(
    $readItems("ratings_measures", {
      filter: { localteam_id: { _eq: municipalities[0].localteam_id } },
    }),
  );
  return {
    municipalities,
    measures,
    ratingsMeasures,
  };
});
//MetaTags
const title = ref(directusData.value.municipalities[0].name);
useHead({
  title,
});

const sortMeasuresBySectorDict = computed(() => {
  return sortMeasuresBySector(directusData.value.ratingsMeasures, directusData.value.measures);
});

function sortMeasuresBySector(ratingsMeasuresArr, measuresArr) {
  if (!Array.isArray(ratingsMeasuresArr) || !Array.isArray(measuresArr)) {
    return {};
  }
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
