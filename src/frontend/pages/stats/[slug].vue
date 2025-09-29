<template>
  <main class="px-4 py-8 max-w-4xl mx-auto">
    <MunicipalitySearchBar basePath="/stats" :label="$t('municipalities_search.label')" :municipalities="allMunicipalities"/>

    <div class="bg-very-light-blue px-4 mt-2 pt-8 pb-8 shadow-lg">
    <h1 class="text-2xl font-bold">{{ municipality?.name || 'Lade Daten...' }}</h1>
    <h3 v-if="municipality">{{ municipality?.state }}</h3>

    <!-- <MunicipalityStats v-if="stats" :stats="stats" />
    <p v-else>Keine Daten gefunden für diese Gemeinde.</p> -->

    

    <div
  class="flex items-center justify-between p-4 bg-base-100 shadow-md mt-2 mb-2 cursor-pointer"
  @click="toggle"
>
  <!-- Title + Unit -->
  <div>
    <div class="font-medium text-base-content w-40">
      Freiflächen-PV
    </div>
    <p class="text-sm">in MWh</p>
  </div>

  <!-- Progress bar -->
  <ThresholdProgressBar
    :progress="62.7"
    :orange-threshold="30"
    :light-green-threshold="60"
    :dark-green-threshold="80"
    unit="MWh"
  />

  <!-- Code + Info -->
  <div class="w-40 text-center">
    <p>EN_1</p>
    <button class="btn btn-ghost btn-sm pointer-events-none">
      Info
      <span v-if="expanded">▲</span>
      <span v-else>▼</span>
    </button>
  </div>
</div>

<!-- Expandable section -->
<div v-if="expanded" class="p-4 border-t space-y-3 text-sm text-black">
  <div>
    <p class="font-bold">Beschreibung</p>
    <p>{{ $t("stats.en_1.description") }}</p>
  </div>
  <div>
    <p class="font-bold">Berechnung</p>
    <p>{{ $t("stats.en_1.calculation") }}</p>
  </div>
  <div>
    <p class="font-bold">Datenquelle</p>
    <p>Vermessungsamt TODO</p>
  </div>
  <div>
    <NuxtLink
      to="/measures"
      class="underline text-primary hover:text-primary/70"
    >
      {{ $t("stats.measure.link") }}
    </NuxtLink>
  </div>
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
    unit="MWh"
    />
</div>

<div class="flex items-center justify-between p-4 rounded-lg bg-base-100 shadow-md mt-2 mb-2">
  <div class="font-medium text-base-content w-40">
    E-Ladesäulen
  </div>
    <ThresholdProgressBar
    :progress="70.3"
    :orange-threshold="20"
    :light-green-threshold="30"
    :dark-green-threshold="50"
    unit="MWh"
    />
</div>

<p>* das ist nur die Windkraft, die auf dem Gebiet der Kommune ist. Wenn die Kommune Windkraft in weiteren Orten betreibt, muss dies dazugerechnet werden.</p>


</div>



  </main>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { onMounted, ref } from 'vue';

const route = useRoute();
const { $t, $municipalityApi } = useNuxtApp();
const stats = ref(null);

const expanded = ref(false);
function toggle() {
  expanded.value = !expanded.value;
}

const allMunicipalities = [
  { name: 'Berlin', slug: 'berlin', state: "Berlin" },
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

const municipality = allMunicipalities.find(m => m.slug === route.params.slug)
const title = municipality?.name || 'n/a'

// Set the page title
useHead({
  title
})
</script>
