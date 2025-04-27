<template lang="">
  <header class="w-full border-b">
    <div class="flex items-center justify-between px-4 py-4">
      <!-- Logo -->
      <div class="flex-shrink-0">
        <NuxtLink to="/">
          <img src="~/assets/images/Stadt-Land-Klima-Logo-Beta.svg" class="h-32 w-auto" :alt="$t('logo.alt')" />
        </NuxtLink>
      </div>

      <!-- Right side (Search + Buttons) -->
      <div class="flex items-center space-x-4">
        <!-- Search bar -->
        <div class="relative">
          <input
            type="text"
            placeholder="Suchen..."
            class="border-b border-mid-gray focus:outline-none focus:border-mid-gray placeholder-mid-gray text-sm pl-6 pr-2 py-1"
          />
          <span class="absolute left-0 top-1/2 transform -translate-y-1/2 text-mid-gray">
            🔍
          </span>
        </div>

        <!-- Log in button -->
        <button class="border border-orange text-orange px-4 py-1 text-sm font-bold flex items-center space-x-1 hover:bg-orange">
          <span>Log in</span>
          <span>→</span>
        </button>

        <!-- Spenden button -->
        <button class="bg-orange text-white px-4 py-1 text-sm font-bold flex items-center space-x-1 hover:bg-orange">
          <span>Spenden</span>
          <span>💳</span>
        </button>
      </div>
    </div>

    <!-- Navigation Bar -->
    <nav class="flex justify-center bg-mid-gray py-2">
      <!--  -->
      <!--  -->
      <!--  -->
      <!-- TODO: Use previous header implementation for mobile version -->
      <!-- TODO: Fetch dynamically and sort - add sorting field to backend -->
      <!-- TODO: Dynamically highlight current page in green -->
      <!--  -->
      <!--  -->
      <!--  -->
      <ul class="flex">
        <li>
          <a href="#" class="px-6 py-3 text-white font-bold bg-light-green">
            Projekt
          </a>
        </li>
        <li>
          <a href="#" class="px-6 py-3 text-white font-bold border-l border-mid-gray hover:bg-mid-gray">
            Ranking
          </a>
        </li>
        <li>
          <NuxtLink to="/" class="px-6 py-3 text-white font-bold border-l border-mid-gray hover:bg-mid-gray">
            Erfolgsprojekte
          </NuxtLink>
        </li>
        <li>
          <a href="#" class="px-6 py-3 text-white font-bold border-l border-mid-gray hover:bg-mid-gray">
            Klimatools
          </a>
        </li>
        <li>
          <a href="#" class="px-6 py-3 text-white font-bold border-l border-mid-gray hover:bg-mid-gray">
            Kontakt
          </a>
        </li>
      </ul>
    </nav>
  </header>
</template>
<script setup>
import { computed, ref } from "vue";
const { $t, $directus, $readItems } = useNuxtApp();
const q = ref("");
const searchFocused = ref(false);
const { data: municipalities } = await useAsyncData("municipalities", () => {
  return $directus.request(
    $readItems("municipalities", {
      fields: ["slug", "name"],
      sort: "name",
      filter: {
        status: {
          _eq: "published",
        },
      },
      limit: -1,
    }),
  );
});

function handleSearchFocus() {
  searchFocused.value = true;
}

function handleSearchBlur() {
  setTimeout(() => {
    searchFocused.value = false;
  }, 100);
}

function handleSuggestionClick(event) {
  q.value = "";
  return false;
}

function handleResetSearchClick() {
  q.value = "";
}

const suggestions = computed(() => {
  const _q = q.value.trim().toLowerCase();

  if (!_q.length || !municipalities.value || !municipalities.value.length) {
    return [];
  }

  return municipalities.value
    .filter((municipality) => {
      return municipality.name.toLowerCase().indexOf(_q) !== -1;
    })
    .map((municipality) => {
      return {
        url: `/municipalities/${municipality.slug}`,
        label: municipality.name,
      };
    })
    .slice(0, 5);
});
</script>
<style lang=""></style>
