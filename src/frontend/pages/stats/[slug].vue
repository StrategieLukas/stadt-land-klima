<template>
  <main class="px-4 py-8 max-w-4xl mx-auto">
    <MunicipalitySearchBar basePath="/stats" :label="$t('municipalities_search.label')" :municipalities="allMunicipalities"/>
    <h1 class="text-2xl font-bold mb-4">{{ stats?.name || 'Lade Daten...' }}</h1>

    <!-- <MunicipalityStats v-if="stats" :stats="stats" />
    <p v-else>Keine Daten gefunden für diese Gemeinde.</p> -->

    

<div class="flex items-center justify-between p-4 rounded-lg bg-base-100 shadow-md mt-2 mb-2">
  <div class="font-medium text-base-content w-40">
    Freiflächen-PV
  </div>
  <ThresholdProgressBar
    :progress="62.7"
    :orange-threshold="30"
    :light-green-threshold="60"
    :dark-green-threshold="80"
  />
</div>

<div class="flex items-center justify-between p-4 rounded-lg bg-base-100 shadow-md mt-2 mb-2">
  <div class="font-medium text-base-content w-40">
    Windkraft*
  </div>
    <ThresholdProgressBar
    :progress="13.2"
    :orange-threshold="15"
    :light-green-threshold="40"
    :dark-green-threshold="70"
    />
</div>

<div class="flex items-center justify-between p-4 rounded-lg bg-base-100 shadow-md mt-2 mb-2">
  <div class="font-medium text-base-content w-40">
    E-Ladesäulen
  </div>
    <ThresholdProgressBar
    :progress="62.7"
    :orange-threshold="20"
    :light-green-threshold="30"
    :dark-green-threshold="50"
    />
</div>

<p>* das ist nur die Windkraft, die auf dem Gebiet der Kommune ist. Wenn die Kommune Windkraft in weiteren Orten betreibt, muss dies dazugerechnet werden.</p>

  </main>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { onMounted, ref } from 'vue';

const route = useRoute();
const { $municipalityApi } = useNuxtApp();
const stats = ref(null);

const allMunicipalities = [
  { name: 'Berlin', slug: 'berlin' },
  { name: 'Hamburg', slug: 'hamburg' },
  { name: 'München', slug: 'muenchen' },
  { name: 'Köln', slug: 'koeln' },
  { name: 'Frankfurt am Main', slug: 'frankfurt-am-main' },
  { name: 'Stuttgart', slug: 'stuttgart' },
  { name: 'Düsseldorf', slug: 'duesseldorf' },
  { name: 'Leipzig', slug: 'leipzig' },
  { name: 'Dresden', slug: 'dresden' },
  { name: 'Nürnberg', slug: 'nuernberg' }
];


// onMounted(async () => {
//   stats.value = await $municipalityApi.fetchStatsBySlug(route.params.slug);
// });
</script>
