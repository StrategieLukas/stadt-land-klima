<template>
  <div class="prose mb-8 mt-10">
    <h1>Maßnahmen zur CO<sub>2</sub>-Reduktion:</h1>
    <p>
      Einführungstext Auch gibt es niemanden, der den Schmerz an sich liebt, sucht oder wünscht, nur, weil er Schmerz ist, es sei denn, es kommt zu zufälligen Umständen, in denen Mühen und Schmerz ihm große Freude bereiten können.
    </p>
  </div>
  <ul>
    <li
      v-for="sector in sectors" :key="sector"
      class="mb-4"
    >
      <NuxtLink :to="`/measures/sectors/${sector}`" class="card card-compact shadow">
        <div class="card-body">
          <div class="flex items-start gap-4">
            <img :src="sectorImages[sector]" alt="" class="w-24 h-auto opacity-50" />

            <div class="prose">
              <h3>{{ $t(`measure_sectors.${sector}.title`) }}</h3>
              {{ $t(`measure_sectors.${sector}.description`) }}
            </div>
          </div>
        </div>
      </NuxtLink>
    </li>
  </ul>
</template>

<script setup>
import { includes } from 'lodash';
import { ref } from 'vue';
import sectorImages from '../../shared/sectorImages.js';
const { $directus, $readItems, $t } = useNuxtApp();
const sectors = ref([]);

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
