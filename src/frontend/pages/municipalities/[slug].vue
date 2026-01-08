<template>
  <div v-if="directusData && directusData.municipalityScore">
    <waving-banner v-if="directusData.municipalityScore.municipality.status === 'draft'">
      {{ $t("municipalities.preview_text") }}
    </waving-banner>
    <NuxtLink :to="`/municipalities?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
      ← {{ $t("municipality.back_label") }}
    </NuxtLink>
    <article class="mb-8 mt-10">
      <detail-municipality
        :municipalityScore="directusData.municipalityScore"
        :sorted-ratings="directusData.sortedRatings"
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
const router = useRouter();

import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
import { fetchMunicipalityData } from '~/shared/complex-data-fetches.js';
const route = useRoute();
const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);

// Change the URL to match the catalog version, if it didn't to begin with
if (process.client && route.query.v != selectedCatalogVersion.name) {
  onMounted(() => {
    router.replace({ query: { ...route.query, v: selectedCatalogVersion.name } });
  });
}


const { data: directusData } = await fetchMunicipalityData(route.params.slug, selectedCatalogVersion.id);
console.log(directusData)

//MetaTags
const title = ref(directusData.value?.municipalityScore?.municipality?.name ?? '404');
useHead({
  title,
});

</script>
