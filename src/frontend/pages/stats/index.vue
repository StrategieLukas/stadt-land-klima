<template>
  <main class="px-4 py-8">
    <MunicipalitySearchBar basePath="/stats" :label="$t('municipalities_search.label')" :municipalities="allMunicipalities"/>
    <p class="text-center mt-4">Wähle eine Gemeinde aus der Liste, um Statistiken zu sehen.</p>
  </main>
</template>

<script setup>
const { $t } = useNuxtApp();

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


const title = ref($t("stats.title"));
useHead({
  title,
});
</script>
