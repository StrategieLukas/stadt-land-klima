<template>
  <div v-if="directusData && directusData.municipalityScores">
    <waving-banner v-if="directusData.municipalityScores[0].municipality.status === 'draft'">
      {{ $t("municipalities.preview_text") }}
    </waving-banner>
    <NuxtLink :to="`/municipalities?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
    <article class="mb-8 mt-10">
      <detail-municipality
        :municipalityScore="directusData.municipalityScores[0]"
        :sorted-ratings="sortMeasuresBySectorDict"
      ></detail-municipality>
    </article>
    <NuxtLink :to="`/municipalities?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
  </div>
  <div v-else>
        <NuxtLink :to="`/municipalities?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
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
const router = useRouter();
import { getCatalogVersion } from '~/composables/getCatalogVersion.js'
const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);

// Change the URL to match the catalog version, if it didn't to begin with
if (process.client && route.query.v != selectedCatalogVersion.name) {
  onMounted(() => {
    router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  });
}


const { data: directusData } = await useAsyncData("municipality", async () => {
  const [municipalityScores, measures] = await Promise.all([
    $directus.request(
      $readItems("municipality_scores", {
        fields: ["*", { municipality: ["*"]}, { catalog_version: ["*"]}],
        filter: { catalog_version: { _eq: selectedCatalogVersion.id }, municipality: {slug: { _eq: route.params.slug } }},
        limit: 1,
      }),
    ),
    $directus.request($readItems("measures", {})),
  ]);

  // Early return if municipalities is empty or null
  if (!municipalityScores || municipalityScores.length === 0) {
    return { municipalityScores: null, measures: measures, ratingsMeasures: [] };
  }

  const ratingsMeasures = await $directus.request(
    $readItems("ratings_measures", {
      filter: {
          localteam_id: { _eq: municipalityScores[0].municipality.localteam_id },
          measure_id: { catalog_version: { _eq: selectedCatalogVersion.id } }
        },
    }),
  );

  return {
    municipalityScores,
    measures,
    ratingsMeasures,
  };
});


//MetaTags
const title = ref(directusData.value?.municipalityScores?.[0]?.municipality?.name ?? '404');
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
