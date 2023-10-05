<template>
  <div>
    <div class="prose mb-8 mt-10">
      <h1>{{ $t("measures.heading") }}</h1>
      <p>
        {{ $t("measures.description") }}
      </p>
    </div>
    <ul>
      <li v-for="sector in sectors" :key="sector" class="mb-4">
        <NuxtLink :to="`/measures/sectors/${sector}`" class="card card-compact shadow">
          <div class="card-body">
            <div class="flex items-start gap-4">
              <img :src="sectorImages[sector]" alt="" class="h-auto w-24 opacity-50" />

              <div class="prose">
                <h3>{{ $t(`measure_sectors.${sector}.title`) }}</h3>
                {{ $t(`measure_sectors.${sector}.description`) }}
              </div>
            </div>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup>
import lodash from "lodash";
const { includes } = lodash;
import { ref } from "vue";
import sectorImages from "../../shared/sectorImages.js";



const { $directus, $readItems, $t } = useNuxtApp();
const sectors = ref([]);

const title = ref($t("measures.nav_label"))
useHead({
  title,
})

const { data: measures } = await useAsyncData("measures", () => {
  return $directus.request(
    $readItems("measures", {
      fields: ["slug", "name", "sector"],
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
