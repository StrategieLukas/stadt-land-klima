<script setup>
  import { useRoute } from "vue-router"
  import { fetchMunicipalityData } from '~/shared/directus-calls/complex-data-fetches.js';
  import { fetchMunicipalityScores } from '~/shared/directus-calls/municipality-scores.js';
  import { getCurrentFrontendCatalogVersion } from '~/composables/getCatalogVersion.js';
  import { ref } from "vue"

  const featureUnavailable = ref(false)
  const usingFallbackCatalog = ref(false)
  const directusData = ref(null)

  const route = useRoute()
  const { $directus, $readItems } = useNuxtApp();

  const municipalityScores = await fetchMunicipalityScores($directus, $readItems, route.params.slug)
  const currentCatalogVersion = await getCurrentFrontendCatalogVersion($directus, $readItems)

  const sufficientlyRatedMunicipalities = municipalityScores.filter(
    item => item.percentage_rated > 80
  )

  if (sufficientlyRatedMunicipalities.length === 0) {
    featureUnavailable.value = true
  } else {
    let selectedEntry = sufficientlyRatedMunicipalities.find(
      item => item.catalog_version?.id === currentCatalogVersion.id
    )

    if (!selectedEntry) {
      usingFallbackCatalog.value = true

      selectedEntry = sufficientlyRatedMunicipalities
        .slice()
        .sort((a, b) =>
          new Date(b.catalog_version.date_created) -
          new Date(a.catalog_version.date_created)
        )[0]
    }

    const result = await fetchMunicipalityData(
      $directus,
      $readItems,
      route.params.slug,
      selectedEntry.catalog_version.id
    )

    directusData.value = result
  }

  console.log("directusData", directusData);

  // Set title
  const title = ref(directusData?.municipalityScore?.municipality?.name ?? '404');
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
    />
  </div>
  <div v-else-if="featureUnavailable">
    <p>Diese Kommune wurde noch nicht ausreichend bewertet, daher kann auch kein Kommunalwahl-Guide auf Basis der Bewertung erstellt werden.</p>
  </div>
  <div v-else>
    <p>Diese Kommune wurde noch nicht bewertet, daher kann auch kein Kommunalwahl-Guide auf Basis der Bewertung erstellt werden.</p>
  </div>
</template>
    