<template>
  <div>
    <div class="mb-8 mt-10 flex flex-col items-start gap-4 xs:flex-row">
      <img :src="sectorImages[route.params.sector]" alt="" class="mt-0 h-auto w-24 opacity-50" />

      <div class="prose">
        <h1>{{ $t(`measure_sectors.${route.params.sector}.title`) }}</h1>
        <div v-html="$t(`measure_sectors.${route.params.sector}.description`)" />
        <p>
          {{ $t("measures_sector.count_measures_in_sector", { ":count": measures.length }) }}
        </p>

        <NuxtLink to="/measures" class="font-heading text-h4 text-light-blue">
          ← {{ $t("measures_sector.back_label") }}
        </NuxtLink>
      </div>
    </div>
    <ul>
      <li v-for="measure in measures" class="mb-4">
        <StaticMeasureCard :measure="measure" />
      </li>
    </ul>
  </div>
</template>
<script setup>
import sectorImages from "../../../shared/sectorImages.js";
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
</script>
