<template>
  <header class="w-full">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-4">
      <!-- Logo -->
      <div class="flex-shrink-0 mb-4 md:mb-0">
        <NuxtLink to="/">
          <img src="~/assets/images/Stadt-Land-Klima-Logo.svg" class="h-32 w-auto" :alt="$t('logo.alt')" />
        </NuxtLink>
      </div>

      <!-- Search Bar in center -->
      <MunicipalitySearchBar basePath="/municipalities" :label="$t('municipalities_search.label')" :municipalities="municipalities"/>

      <!-- Right side (Buttons) -->
      <div class="flex flex-col items-end space-y-4 md:space-y-0 md:space-x-4 md:flex-row">

        <!-- Global search icon -->
        <button
          class="h-10 flex items-center justify-center px-3 py-2 text-sm font-bold border-2 border-mid-gray text-mid-gray hover:bg-mid-gray hover:text-white transition-colors"
          :title="$t('generic.search')"
          @click="openSearch"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </button>

        <!-- Log in button -->
        <a href="/backend">
          <button class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold border-2 border-orange text-orange hover:bg-orange hover:text-white">
            <span>{{ $t('generic.log_in') }}</span>
            <span>→</span>
          </button>
        </a>

        <!-- Spenden button -->
        <DonateButton/>
      </div>
    </div>

  </header>
</template>

<script setup>
import { useSearchPalette } from '~/composables/useSearchPalette.js';

const { $t } = useNuxtApp();
const { open: openSearch } = useSearchPalette();

const props = defineProps({
  municipalities: {
    type: Array,
    required: true,
  },
  pages: {
    type: Array,
    required: true,
  },
  navItems: {
    type: Array,
    default: () => [],
  },
});

</script>
