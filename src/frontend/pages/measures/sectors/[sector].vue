<template>
  <div>
    <div class="mb-8 mt-10 flex flex-col xs:flex-row items-start gap-4">
      <img :src="sectorImages[route.params.sector]" alt="" class="h-auto w-24 opacity-50 mt-0" />

      <div class="prose">
        <h1>{{ $t(`measure_sectors.${route.params.sector}.title`) }}</h1>
        <div v-html="$t(`measure_sectors.${route.params.sector}.description`)" />
        <p>
          {{ $t("measures_sector.count_measures_in_sector", {":count": measures.length }) }}
        </p>

        <NuxtLink to="/measures" class="btn btn-link text-light-blue p-0 normal-case">
          ← {{ $t("measures_sector.back_label") }}
        </NuxtLink>
      </div>
    </div>
    <ul>
      <li v-for="measure in measures" class="mb-4">
        <MeasureCard :measure="measure" />
      </li>
    </ul>
  </div>
</template>
<script setup>
import sectorImages from "../../shared/sectorImages.js";
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();

//MetaTags
const title = ref($t(`measure_sectors.${route.params.sector}.title`));
useHead({
  title,
});
//

const { data: measures } = await useAsyncData("measures", () => {
  return $directus.request(
    $readItems("measures", {
      filter: { sector: { _eq: route.params.sector } },
      limit: -1,
    }),
  );
});
console.log(measures.value);
</script>
