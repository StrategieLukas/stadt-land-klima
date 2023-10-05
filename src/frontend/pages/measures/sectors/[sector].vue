<template>
  <div>
    <NuxtLink to="/measures" class="btn btn-ghost mt-4 normal-case">
      {{ $t("measures_sector.back_label") }}
    </NuxtLink>
    <div class="mb-8 mt-10 flex items-start gap-4">
      <img :src="sectorImages[route.params.sector]" alt="" class="h-auto w-24 opacity-50" />

      <div class="prose">
        <h1>{{ $t(`measure_sectors.${route.params.sector}.title`) }}</h1>
        {{ $t(`measure_sectors.${route.params.sector}.description`) }}
      </div>
    </div>
    <div class="prose">
      <h2>{{ $t("measures_in_sector", { ":sector": $t(`measure_sectors.${route.params.sector}.title`) }) }}</h2>
    </div>
    <ul>
      <li v-for="measure in measures" class="mb-4">
        <NuxtLink :to="`/measures/${measure.slug}`" class="card card-compact shadow">
          <div class="card-body prose hover:underline focus:underline">
            <h3>{{ measure.name }}</h3>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
<script setup>
import sectorImages from "../../shared/sectorImages.js";
const { $directus, $readItems, $t } = useNuxtApp();
const route = useRoute();

const { data: measures } = await useAsyncData("measures", () => {
  return $directus.request(
    $readItems("measures", {
      filter: { sector: { _eq: route.params.sector } },
      limit: -1,
    }),
  );
});

</script>
