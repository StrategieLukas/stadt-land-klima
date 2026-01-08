<script setup>
  import { useRoute } from "vue-router"
  import { fetchMunicipalityData } from '~/shared/complex-data-fetches.js';
  import { getCurrentFrontendCatalogVersion } from '~/composables/getCatalogVersion.js';
  
  const route = useRoute()
  const catalogVersion = await getCurrentFrontendCatalogVersion();
  const { data: directusData } = await fetchMunicipalityData(route.params.slug, catalogVersion.id);

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
      :sorted-ratings="directusData.sortedRatings"
    />
  </div>
  <div v-else>
    <p>Not found</p>
  </div>
</template>
    