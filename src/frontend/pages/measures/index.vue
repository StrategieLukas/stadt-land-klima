<template>
  <div class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto w-full min-w-0 overflow-hidden">
    <div class="prose mb-8 mt-10 max-w-none">
      <h1>{{ $t("measures.heading") }}</h1>
      <p>
        {{ $t("measures.description") }}
      </p>
    </div>
    <!-- Show the different sectors for measures -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      <NuxtLink 
        v-for="sector in sectors" 
        :key="sector" 
        :to="`/measures/sectors/${sector}?v=${selectedCatalogVersion.name}`" 
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
    <!-- Link to the measure catalog -->
     <div class="mt-12 flex justify-center">
      <NuxtLink
        v-if="selectedCatalogVersion.name == `v1.0`"
        :to="`/backend/assets/ac1df0cd-8a57-4082-bdd3-432f43e4a374`"
        >
          <button class="p-4 flex items-center justify-end text-white bg-gray h-10">{{  $t("measure_catalog.download") }} ({{ selectedCatalogVersion.name }})</button>
        </NuxtLink>

        <NuxtLink
        v-if="selectedCatalogVersion.name == `beta`"
        :to="`/backend/assets/9c270dd0-52dc-449b-9c2e-bbd5d5b829`"
        >
          <button class="p-4 flex items-center justify-end text-white bg-gray h-10">{{  $t("measure_catalog.download") }} ({{ selectedCatalogVersion.name }})</button>
      </NuxtLink>
     </div>

  </div>
</template>

<script setup>
import lodash from "lodash";
const { includes } = lodash;
import { ref } from "vue";
import sectorImages from "~/shared/sectorImages.js";

const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route, true);
onMounted(() => {
  setCatalogVersionUrl(route, router, selectedCatalogVersion);
});

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
