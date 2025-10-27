<template>
  <main class="px-4 py-8 max-w-4xl mx-auto w-full">
    <h1 class="text-center text-xl font-bold mb-4">{{ $t("stats.title") }}</h1>
    <p class="text-center mt-4">Wähle eine Verwaltungsgliederung aus der Liste, um Statistiken zu sehen.</p>
    <div class="flex bg-blue-100 rounded-lg border-blue-600 drop-shadow-md border mt-4 p-4 justify-center">
      <AdministrativeAreaSearchBar 
        :label="$t('administrative_areas.search.label')" 
        base-path="/stats" 
      />
    </div>
  </main>
</template>

<script setup>
const { $t } = useNuxtApp();

const title = ref($t("stats.title"));
useHead({
  title,
});
</script>
