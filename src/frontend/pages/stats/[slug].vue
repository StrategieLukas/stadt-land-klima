<template>
  <main class="px-4 py-8 max-w-4xl mx-auto">
    <MunicipalitySearchBar basePath="/stats" :label="$t('municipalities_search.label')" :municipalities="allMunicipalities"/>
    <h1 class="text-2xl font-bold mb-4">{{ stats?.name || 'Lade Daten...' }}</h1>

    <MunicipalityStats v-if="stats" :stats="stats" />
    <p v-else>Keine Daten gefunden für diese Gemeinde.</p>
  </main>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { onMounted, ref } from 'vue';
import MunicipalitySearchBar from '@/components/MunicipalitySearchBar.vue';
import MunicipalityStats from '@/components/MunicipalityStats.vue';

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


onMounted(async () => {
  stats.value = await $municipalityApi.fetchStatsBySlug(route.params.slug);

  
});
</script>
