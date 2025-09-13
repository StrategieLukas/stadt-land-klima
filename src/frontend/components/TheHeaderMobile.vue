<template>
  <header class="mb-3 bg-white px-2 py-4 shadow">
    <div class="mx-auto flex w-full max-w-screen-xl flex-col items-center gap-x-8 lg:flex-row lg:items-end">
      <NuxtLink to="/">
        <img src="~/assets/images/Stadt-Land-Klima-Logo-Beta.svg" class="h-32 w-auto" :alt="$t('logo.alt')" />
      </NuxtLink>
      <!-- Search Bar and map toggle in center -->
      <MunicipalitySearchBar/>
    </div>
  </header>
</template>

<script setup>
const { $t } = useNuxtApp();
</script>

<style>
/* Add your styles here if needed */
</style>