<template>
  <div>
    <waving-banner v-if="directusData.municipalities[0].status === 'draft'">
      {{ t("municipalities.preview_text") }}
    </waving-banner>
    <NuxtLinkLocale :to="`/municipalities`" class="font-heading text-h4 text-light-blue">
      ← {{ t("municipality.back_label") }}
    </NuxtLinkLocale>
    <article class="mb-8 mt-10">
      <detail-municipality
        :municipality="directusData.municipalities[0]"
        :sorted-ratings="sortMeasuresBySectorDict"
      ></detail-municipality>
    </article>
    <NuxtLinkLocale :to="`/municipalities`" class="font-heading text-h4 text-light-blue">
      ← {{ t("municipality.back_label") }}
    </NuxtLinkLocale>
  </div>
</template>
<script setup>
const { t } = useI18n();
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
      filter: {
            _and: [
              {
                localteam_id: {
                  _eq: municipalities[0].localteam_id,
                },
              },
              {
                applicable: {
                  _eq: true,
                },
              },
            ],
          },
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


  // Sort each sector's array: by rating (desc), then measure_id (asc)
  for (const sector in dictMeasuresRatingSorted) {
    dictMeasuresRatingSorted[sector].sort((a, b) => {
      const ratingA = a.rating;
      const ratingB = b.rating;

      // Handle nulls: treat null as lowest
      if (ratingA == null && ratingB != null) return 1;
      if (ratingA != null && ratingB == null) return -1;
      if (ratingA != null && ratingB != null) {
        if (ratingA !== ratingB) {
          return ratingB - ratingA; // Descending
        }
      }

      // Tiebreaker: sort by measure_id ascending
      if (a.measure_id < b.measure_id) return -1;
      if (a.measure_id > b.measure_id) return 1;
      return 0;
    });
  }

  return dictMeasuresRatingSorted;
}
</script>
