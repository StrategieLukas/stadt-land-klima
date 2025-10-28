<template>
  <div class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto w-full min-w-0 overflow-hidden">
    <div class="prose mb-8 mt-10 max-w-none">
      <h1>{{ $t("measures.heading") }}</h1>
      <p>
        {{ $t("measures.description") }}
      </p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      <NuxtLink 
        v-for="sector in sectors" 
        :key="sector" 
        :to="`/measures/sectors/${sector}`" 
        class="card card-compact shadow hover:shadow-lg transition-shadow duration-200 block"
      >
        <div class="card-body flex flex-col items-center text-center p-6">
          <img :src="sectorImages[sector]" alt="" class="h-auto w-20 mb-4 opacity-70" />
          <h3 class="font-heading text-lg font-bold text-gray-800 break-words">
            {{ $t(`measure_sectors.${sector}.title`) }}
          </h3>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import lodash from "lodash";
const { includes } = lodash;
import { ref } from "vue";
import sectorImages from "~/shared/sectorImages.js";
import { getCatalogVersion } from '~/composables/getCatalogVersion.js';

const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();
const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route);
const sectors = ref([]);

const title = ref($t("measures.nav_label"));
useHead({
  title,
});

const { data: measures } = await useAsyncData(`measures-index-${selectedCatalogVersion.id}`, () => {
  return $directus.request(
    $readItems("measures", {
      fields: ["slug", "name", "sector"],
      filter: { catalog_version: { _eq: selectedCatalogVersion.id } },
    }),
  );
});

measures.value.forEach((measure) => {
  if (!measure.sector) {
    return;
  }

  if (!includes(sectors.value, measure.sector)) {
    sectors.value.push(measure.sector);
  }
});
</script>
