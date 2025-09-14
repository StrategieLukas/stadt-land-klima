<template>
  <header class="w-full">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-4">
      <!-- Logo -->
      <div class="flex-shrink-0 mb-4 md:mb-0">
        <NuxtLinkLocale to="/">
          <img src="~/assets/images/Stadt-Land-Klima-Logo-Beta.svg" class="h-32 w-auto" :alt="t('logo.alt')" />
        </NuxtLinkLocale>
      </div>

      <MunicipalitySearchBar/>

      <!-- Right side (Buttons) -->
      <div class="flex flex-col items-end space-y-4 md:space-y-0 md:space-x-4 md:flex-row">

        <!-- Log in button -->
        <a href="/backend">
          <button class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold border-2 border-orange text-orange text-sm space-x-1 hover:bg-orange hover:text-white">
            <span>{{ t('generic.log_in') }}</span>
            <span>→</span>
          </button>
        </a>


        <!-- Spenden button -->
        <DonateButton />

        <LanguageSelectorDesktop v-if="num_languages > 1" />
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
          <NuxtLinkLocale
            :to="`/${page.slug}`"
            class="flex items-center justify-center px-6 text-white font-bold h-full"
            :class="{
              'bg-light-green text-white': '/' + page.slug === route.path,
              'hover:bg-mid-gray': '/' + page.slug !== route.path,
            }"
          >
            {{ page.translations[0].name }}
          </NuxtLinkLocale>
        </li>

        <!-- Other Pages Dropdown -->
        <li class="relative h-full group">
          <div
            class="flex items-center justify-center px-6 text-white font-bold h-full cursor-pointer"
            :class="{
              'bg-light-green text-white': otherPages.some(p => isActive(p.slug)),
              'hover:bg-mid-gray': !otherPages.some(p => isActive(p.slug)),
            }"
          >
            {{ t('generic.other') }}
          </div>
          <div
            class="absolute left-0 top-full mt-0 w-48 bg-white shadow-md hidden group-hover:block"
          >
            <NuxtLinkLocale
              v-for="page in otherPages"
              :key="page.id"
              :to="`/${page.slug}`"
              class="block px-4 py-2 text-white font-bold"
              :class="{
                'bg-light-green hover:bg-green': isActive(page.slug),
                'bg-mid-gray hover:bg-gray' : !isActive(page.slug),
              }"
            >
              {{ page.translations[0].name }}
            </NuxtLinkLocale>
          </div>
        </li>
      </ul>
    </nav>


  </header>
</template>

<script setup>
import { defineProps } from "vue";

const { t } = useI18n();
const route = useRoute();
const props = defineProps(["pages"]);

//Separate pages into "main" and "other" based on configured menus
const mainPages = computed(() =>
  props?.pages?.filter((page) => page.menus && page.menus.includes('top-bar')) || []
);
const otherPages = computed(() =>
  props?.pages?.filter((page) => page.menus && page.menus.includes('main') && !page.menus.includes('top-bar')) || []
);

// Function to check if a page is active
const isActive = (slug) => {
  return route.path === slug || route.path === `/${slug}`;
};

const { data: fetchedLanguages } = await fetchLanguages();

const num_languages = fetchedLanguages.value.length;
</script>
<style lang=""></style>
