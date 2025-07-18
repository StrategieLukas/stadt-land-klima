<template>
  <div v-if="num_measures !== 0">
    <div class="mb-8 mt-10 flex flex-col items-start gap-4 xs:flex-row">
      <img :src="sectorImages[route.params.sector]" alt="" class="mt-0 h-auto w-24 opacity-50" />

      <div class="prose">
        <h1>{{ t(`measure_sectors.${route.params.sector}.title`) }}</h1>
        <div v-html="t(`measure_sectors.${route.params.sector}.description`)" />
        <p>
          {{ t("measures_sector.count_measures_in_sector", { ":count": num_measures }) }}
        </p>

        <NuxtLinkLocale to="/measures" class="font-heading text-h4 text-light-blue">
          ← {{ t("measures_sector.back_label") }}
        </NuxtLinkLocale>
      </div>
    </div>
    <ul>
      <li v-for="measure in measures" class="mb-4">
        <MeasureCard :measure="measure" />
      </li>
    </ul>
  </div>
  <p v-else class="prose py-8">
    {{ t("page_not_found") }}
  </p>
</template>
<script setup>
import sectorImages from "../../shared/sectorImages.js";
const { $directus, $readItems } = useNuxtApp();
const { t } = useI18n();
const route = useRoute();

const { data: measures } = await useAsyncData("measures", () => {
  return $directus.request(
    $readItems("measures", {
      filter: { sector: { _eq: route.params.sector } },
      limit: -1,
    }),
  );
});

const num_measures = measures.value.length;

//MetaTags
const title = num_measures !== 0 ? ref(t(`measure_sectors.${route.params.sector}.title`)) : t("page_not_found");
useHead({
  title,
});
//
</script>
