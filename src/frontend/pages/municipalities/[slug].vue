<template>
  
  <div v-if="directusData && directusData.municipalities">
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
  
  <div v-else>
    <NuxtLink :to="`/municipalities`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
    
    <waving-banner>
      {{ $t("municipality_missing") }}
    </waving-banner>
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

  // Early return if municipalities is empty or null
  if (!municipalities || municipalities.length === 0) {
    return { municipalities: null, measures: measures, ratingsMeasures: [] };
  }

  const ratingsMeasures = await $directus.request(
    $readItems("ratings_measures", {
      filter: {
          localteam_id: {
            _eq: municipalities[0].localteam_id,
          },
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
const title = ref(directusData.value?.municipalities?.[0]?.name ?? '404');
useHead({
  title,
});

const sortMeasuresBySectorDict = computed(() => {
  if(directusData === null || directusData.value === null) {
    return {};
  }
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
      if(item.applicable && item.rating === null) {
        console.error(`Item ${item.rating} hat kein rating, obwohl applicable=true. Unbewertete Massnahmen sollten nicht ans Frontend geschickt werden.`)
        // Do not add the broken rating to the dict in this case
      } else {
        const { sector } = measure;
        item.measure = measure;
        if(!item.applicable) {
          item.rating = null
        }
        dictMeasuresRatingSorted[sector] = dictMeasuresRatingSorted[sector] || [];
        dictMeasuresRatingSorted[sector].push(item);
      }
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
