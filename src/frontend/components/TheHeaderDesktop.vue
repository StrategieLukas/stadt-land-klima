<template>
  <header class="w-full transition-all duration-300 backdrop-blur-md shadow-xl">
    <div :class="[
      'flex flex-col md:flex-row md:items-center md:justify-between px-4 transition-all duration-300',
      isScrolled ? 'py-2' : 'py-4'
    ]">
      <!-- Logo/Icon Morph Animation -->
      <div class="w-[400px] flex-shrink-0 mb-4 md:mb-0 transition-all duration-300 relative flex items-center" :class="isScrolled ? 'h-12 md:h-16' : 'h-24 md:h-32'">
        <NuxtLink to="/">
          <transition name="logo-morph" mode="out-in">
            <img
              v-if="!isScrolled"
              key="logo"
              src="~/assets/images/Stadt-Land-Klima-Logo-Beta.svg"
              class="origin-left h-24 w-auto md:h-32 transition-transform duration-500"
              :alt="$t('logo.alt')"
            />
            <img
              v-else
              key="icon"
              src="/favicon.png"
              class="origin-left h-12 w-auto md:h-16 md:w-auto transition-transform duration-500"
              :alt="$t('logo.alt')"
            />
          </transition>
        </NuxtLink>
      </div>

      <MunicipalitySearchBar/>

      <!-- Right side (Buttons) -->
      <div class="flex flex-col items-end space-y-4 md:space-y-0 md:space-x-4 md:flex-row">
        <!-- Log in button -->
        <a href="/backend">
          <button class="h-10 flex items-center justify-center px-4 py-2 text-sm font-bold border-2 border-orange text-orange text-sm space-x-1 hover:bg-orange hover:text-white">
            <span>{{ $t('generic.log_in') }}</span>
            <span>→</span>
          </button>
        </a>
        <!-- Spenden button -->
        <DonateButton/>
      </div>
    </div>

    <!-- Navigation Bar -->
    <nav class="flex justify-center bg-mid-gray transition-all duration-300" :class="isScrolled ? 'h-8' : 'h-12'">
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
              'bg-light-green text-white': otherPages.some(p => isActive(p.slug)),
              'hover:bg-mid-gray': !otherPages.some(p => isActive(p.slug)),
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
                'bg-light-green hover:bg-green': isActive(page.slug),
                'bg-mid-gray hover:bg-gray' : !isActive(page.slug),
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
import { defineProps, ref, onMounted, onUnmounted, computed } from "vue";
const { $t } = useNuxtApp();
const route = useRoute();
const props = defineProps(["pages"]);

const isScrolled = ref(false);
const SCROLL_THRESHOLD = 40;

function handleScroll() {
  isScrolled.value = window.scrollY > SCROLL_THRESHOLD;
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
});
onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});

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
</script>

<style lang="css">
/* Fade and scale morph transition for logo/icon */
.logo-morph-enter-active, .logo-morph-leave-active {
  transition: opacity 0.3s, transform 0.5s cubic-bezier(0.4,0,0.2,1);
}
.logo-morph-enter-from, .logo-morph-leave-to {
  opacity: 0;
  transform: scale(0.7) translateY(20px);
}
.logo-morph-enter-to, .logo-morph-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}
</style>
