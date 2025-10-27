<template lang="">
    <header class="mb-3 bg-white px-2 py-4 shadow">
      <div class="mx-auto flex w-full max-w-screen-xl flex-col items-center gap-x-8 lg:flex-row lg:items-end">
        <NuxtLink to="/">
          <img src="~/assets/images/Stadt-Land-Klima-Logo.svg" class="h-32 w-auto" :alt="$t('logo.alt')" />
        </NuxtLink>
          <!-- Search Bar and map toggle in center -->
          <MunicipalitySearchBar basePath="/municipalities" :label="$t('municipalities_search.label')" :municipalities="municipalities"/>
      </div>
    </header>
  </template>

<script setup>
const { $t } = useNuxtApp();
const props = defineProps({
  municipalities: {
    type: Array,
    required: true,
  },
});

</script>
<style lang=""></style>