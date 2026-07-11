<script setup>
  import { useRoute } from "vue-router"
  import { fetchMunicipalityData } from '~/shared/directus-calls/complex-data-fetches.js';
  import { fetchMunicipalityScores } from '~/shared/directus-calls/municipality-scores.js';
  import { getCurrentFrontendCatalogVersion } from '~/composables/getCatalogVersion.js';
  import { ref } from "vue"

  const usingFallbackCatalog = ref(false)
  const directusData = ref(null)

  const route = useRoute()
  const { $directus, $readItems, $t } = useNuxtApp();

  const municipalityScores = await fetchMunicipalityScores($directus, $readItems, route.params.slug)
  const municipalityMissing = !municipalityScores || municipalityScores.length === 0
  const currentCatalogVersion = await getCurrentFrontendCatalogVersion($directus, $readItems)

  const sufficientlyRatedMunicipalities = municipalityScores.filter(
    item => item.percentage_rated > 80
  )

  if (sufficientlyRatedMunicipalities.length !== 0) {
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
