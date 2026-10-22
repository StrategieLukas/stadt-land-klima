<script setup>
  import { ref } from 'vue'
  const route = useRoute()
  const { $t } = useNuxtApp()
  const catalogs = await getAllCatalogVersions()
  const currentCatalogVersion = await getCurrentFrontendCatalogVersion()
  const usingFallbackCatalog = ref(false)
  const directusData = ref(null)
  const results = await Promise.all(catalogs.map(catalog => $fetch(`/api/public/municipalities/${encodeURIComponent(route.params.slug)}`, { query: { v: catalog.name } })))
  const municipalityMissing = results.every(result => !result.municipality)
  const eligible = results.filter(result => Number(result.directusData?.municipalityScore?.percentage_rated) > 80)
  const selected = eligible.find(result => result.selectedCatalogVersion.id === currentCatalogVersion.id) ?? eligible.slice().sort((a, b) => new Date(b.selectedCatalogVersion.date_created) - new Date(a.selectedCatalogVersion.date_created))[0]
  if (selected?.directusData) {
    usingFallbackCatalog.value = selected.selectedCatalogVersion.id !== currentCatalogVersion.id
    directusData.value = {
      ...selected.directusData,
      ratingsMeasures: Object.values(selected.directusData.ratingsBySector).flat(),
    }
  }

  // Set title
  const title = ref(directusData?.value?.municipalityScore?.municipality?.name ?? '404');
  useHead({
    title,
  });

</script>

<template>
  <div v-if="directusData">
    <ElectionInfo
      :municipality-score="directusData.municipalityScore"
      :ratings-measures="directusData.ratingsMeasures"
      :using-fallback-catalog="usingFallbackCatalog"
      :current-catalog-version="currentCatalogVersion"
    />
  </div>
  <!-- Municipality completely missing -->
  <div v-else-if="municipalityMissing">
    <p>{{ $t("elections.guide.not_rated") }}</p>
  </div>
  <!-- Municipality exists, but not sufficiently rated to generate questions -->
  <div v-else>
    <p>{{ $t("elections.guide.not_fully_rated") }}</p>
  </div>
  
</template>
