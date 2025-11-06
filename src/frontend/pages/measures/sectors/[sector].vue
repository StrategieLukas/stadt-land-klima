<template>
  <div class="px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-4xl mx-auto w-full min-w-0 overflow-hidden">
    <div class="mb-8 mt-10 flex flex-col items-start gap-4 xs:flex-row">
      <img :src="sectorImages[route.params.sector]" alt="" class="mt-0 h-auto w-24 opacity-50" />

      <div class="prose max-w-none">
        <h1>{{ $t(`measure_sectors.${route.params.sector}.title`) }}</h1>
        <div v-html="$t(`measure_sectors.${route.params.sector}.description`)" />
        <p>
          {{ $t("measures_sector.count_measures_in_sector", { ":count": measures?.length || 0 }) }}
        </p>

        <NuxtLink :to="`/measures?v=${selectedCatalogVersion.name}`" class="font-heading text-h4 text-light-blue">
          ← {{ $t("measures_sector.back_label") }}
        </NuxtLink>
      </div>
    </div>
    <div class="space-y-6">
      <StaticMeasureCard v-for="measure in measures" :key="measure.measure_id" :measure="measure" />
    </div>
  </div>
</template>
<script setup>
import { ref } from 'vue';
import sectorImages from "~/shared/sectorImages.js";
import { getCatalogVersion } from '~/composables/getCatalogVersion.js';
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const selectedCatalogVersion = await getCatalogVersion($directus, $readItems, route, true);
onMounted(() => {
  setCatalogVersionUrl(route, router, selectedCatalogVersion);
});

//MetaTags
const title = ref($t(`measure_sectors.${route.params.sector}.title`));
useHead({
  title,
});
//

const { data: measures } = await useAsyncData(`measures-sector-${route.params.sector}-${selectedCatalogVersion.id}`, () => {
  return $directus.request(
    $readItems("measures", {
      fields: [
        "measure_id", "name", "slug", "sector", "date_updated",
        "description_about", "description_evaluation_criteria", 
        "impact", "feasibility_political", "feasibility_economical",
        "description_benefit", "description_verification", "description_contribution",
        "description_implementation", "description_legal", "description_funding"
      ],
      filter: { 
        sector: { _eq: route.params.sector },
        catalog_version: { _eq: selectedCatalogVersion.id }
      },
      sort: "measure_id",
      limit: -1,
    }),
  );
});
</script>
