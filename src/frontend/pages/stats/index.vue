<template>
  <main class="prose px-4 py-8">
    <h1 class="text-center text-xl font-bold mb-4">{{ $t("stats.title") }}</h1>
    <p class="mt-4">Wähle eine Verwaltungsgliederung aus der Liste, um Statistiken zu sehen.</p>
    <AdministrativeAreaSearchBar 
      :label="$t('administrative_areas_search.label')" 
      base-path="/stats" 
    />
  </main>
</template>

<script setup>
const { $t } = useNuxtApp();

const title = ref($t("stats.title"));
useHead({
  title,
});
</script>
