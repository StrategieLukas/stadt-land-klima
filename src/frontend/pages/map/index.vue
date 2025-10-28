<template>
  <div>
    <TheMap :municipalityScores="municipality_scores" />
  </div>
</template>

<script setup>
import TheMap from '~/components/TheMap.vue'
import { ref, onMounted } from 'vue'

const municipality_scores = ref([])

const { $directus, $readItems, $t } = useNuxtApp()

import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
const route = useRoute();
const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);

// // Fetch all relevant municipalityScores from directus
// const { data: municipalityScores } = await useAsyncData(`municipalities_ranking_scores_${selectedCatalogVersion.id}`, () => {
//   return $directus.request(
//     $readItems("municipality_scores", {
//       fields: ["id", "catalog_version", "rank", "score_total", "percentage_rated", "municipality.name", 
//       { municipality: ["id", "slug", "state", "municipality_type", "status", "geolocation", "date_updated"] }],
//       filter: { catalog_version: { _eq: selectedCatalogVersion.id }, percentage_rated: { _gt: 0} },
//       limit: -1,
//       sort: "-score_total",
//     })
//   )
// });


async function fetchMunicipalities(catalogVersionId) {
  municipality_scores.value = await $directus.request(
    $readItems("municipality_scores", {
      fields: ["id", "catalog_version", "rank", "score_total", "percentage_rated", "municipality.name", 
      { municipality: ["id", "slug", "state", "municipality_type", "status", "geolocation", "date_updated"] }],
      filter: { catalog_version: { _eq: catalogVersionId }, percentage_rated: { _gt: 0} },
      limit: -1,
      sort: "-score_total",
    })
  )
}

onMounted(() => {
  fetchMunicipalities(selectedCatalogVersion.id)
  console.log(municipality_scores)
})

const title = ref($t('map.title'))
useHead({ title })
</script>
