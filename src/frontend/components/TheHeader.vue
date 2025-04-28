<template>

<!-- TODO: Split header in mobile and desktop layout (using previous TheHeader-impl for mobile AND removing the drawer from the desktop version) -->
 <!-- TODO:  -->

  <header class="w-full">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-4">
      <!-- Logo -->
      <div class="flex-shrink-0 mb-4 md:mb-0">
        <NuxtLink to="/">
          <img src="~/assets/images/Stadt-Land-Klima-Logo-Beta.svg" class="h-32 w-auto" :alt="$t('logo.alt')" />
        </NuxtLink>
      </div>

      <!-- Right side (Search + Buttons) -->
      <div class="flex flex-col items-end space-y-4 md:space-y-0 md:space-x-4 md:flex-row">
        <!-- Search bar -->
        <div class="relative w-full md:w-auto">
          <input
            v-model="search"
            type="text"
            :placeholder="$t('generic.search')"
            class="w-full border-b border-mid-gray focus:outline-none focus:border-mid-gray placeholder-mid-gray text-sm pl-6 pr-2 py-1"
          />
          <span class="absolute left-0 top-1/2 transform -translate-y-1/2 text-mid-gray">
            🔍
          </span>
        </div>

        <!-- Log in button -->
        <button class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold border-2 border-orange text-orange text-sm space-x-1 hover:bg-orange hover:text-white">
          <span>{{ $t('generic.log_in') }}</span>
          <span>→</span>
        </button>

        <!-- Spenden button -->
        <button class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold bg-orange text-white text-sm space-x-1 hover:brightness-110">
          <span>{{ $t('donate.label') }}</span>
          <span>💳</span>
        </button>
      </div>
    </div>

    <!-- Navigation Bar -->
    <nav class="flex justify-center bg-mid-gray h-12">
      <ul class="flex h-full">
        <!-- Main Pages -->
        <li
          v-for="page in mainPages"
          :key="page.id"
          class="h-full"
        >
          <NuxtLink
            :to="`/${page.slug}`"
            class="flex items-center justify-center px-6 text-white font-bold h-full"
            :class="{
              'bg-light-green text-white': '/' + page.slug === route.path,
              'hover:bg-mid-gray': '/' + page.slug !== route.path,
            }"
          >
            {{ page.name }}
          </NuxtLink>
        </li>

        <!-- Other Pages Dropdown -->
        <li class="relative h-full group">
          <div
            class="flex items-center justify-center px-6 text-white font-bold h-full cursor-pointer"
            :class="{
              'bg-light-green text-white': otherPages.some(p => '/' + p.slug === route.path),
              'hover:bg-mid-gray': !otherPages.some(p => '/' + p.slug === route.path),
            }"
          >
            {{ $t('generic.other') }}
          </div>
          <div
            class="absolute left-0 top-full mt-0 w-48 bg-white shadow-md hidden group-hover:block"
          >
            <NuxtLink
              v-for="page in otherPages"
              :key="page.id"
              :to="`/${page.slug}`"
              class="block px-4 py-2 text-white font-bold"
              :class="{
                'bg-light-green hover:bg-green': '/' + page.slug === route.path,
                'bg-mid-gray hover:bg-gray' : '/' + page.slug !== route.path,
              }"
            >
              {{ page.name }}
            </NuxtLink>
          </div>
        </li>
      </ul>
    </nav>


  </header>
</template>

<script setup>
import { computed, ref } from "vue";
const { $t, $directus, $readItems } = useNuxtApp();

const route = useRoute();

// Simple local search
const search = ref("");

// Fetch pages from Directus
const { data: pages } = await useAsyncData("pages", () => {
  return $directus.request(
    $readItems("pages", {
      fields: ["name", "slug", "menus"],
      sort: "sort_order",
    })
  );
});

//Separate pages into "main" and "other" based on configured menus
const mainPages = computed(() =>
  pages.value?.filter((page) => page.menus && page.menus.includes('top-bar')) || []
);
const otherPages = computed(() =>
  pages.value?.filter((page) => page.menus && page.menus.includes('main') && !page.menus.includes('top-bar')) || []
);

// Function to check if a page is active
const isActive = (slug) => {
  return route.path === slug || route.path === `/${slug}`;
};

// Search logic
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
