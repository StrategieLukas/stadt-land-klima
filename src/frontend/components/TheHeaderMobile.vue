<template>
  <header
    class="border-gray-300 fixed left-0 right-0 top-0 z-50 w-full border-b bg-white transition-transform duration-300 ease-in-out"
    :style="[hidden ? 'transform: translateY(-100%)' : 'transform: translateY(0)']"
  >
    <div class="mx-auto flex w-full max-w-screen-xl items-center px-3 py-2">
      <!-- Left: Logo -->
      <NuxtLink to="/" class="flex-shrink-0">
        <img src="~/assets/images/Stadt-Land-Klima-Logo.svg" class="h-12 w-auto" :alt="$t('logo.alt')" />
      </NuxtLink>

      <div class="flex-1" />

      <!-- Right: Search button -->
      <ThemeToggle class="mr-2" />
      <button
        class="border-gray-200 text-gray-400 hover:border-gray-300 flex h-10 w-12 flex-none items-center justify-center rounded-full border-2 bg-white transition-colors"
        @click="open()"
        :aria-label="$t('generic.search')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useSearchPalette } from "~/composables/useSearchPalette.js";
import { useMobileHeaderHidden } from "~/composables/useMobileHeaderHidden.js";

const { $t } = useNuxtApp();
const { open } = useSearchPalette();
const { isDrawerOpen } = useDrawer();

const mobileHeaderHidden = useMobileHeaderHidden();
const hidden = ref(false);
watch(hidden, (v) => {
  mobileHeaderHidden.value = v;
});
let lastY = 0;

function onScroll() {
  // Always show when the menu sheet is open
  if (isDrawerOpen.value) {
    hidden.value = false;
    return;
  }
  const currentY = window.scrollY;
  const delta = currentY - lastY;
  if (currentY < 10) {
    // At the very top — always show
    hidden.value = false;
  } else if (delta > 4) {
    // Scrolling down — hide
    hidden.value = true;
  } else if (delta < -4) {
    // Scrolling up — reveal
    hidden.value = false;
  }
  lastY = currentY;
}

// When menu opens, always reveal the header
watch(isDrawerOpen, (open) => {
  if (open) hidden.value = false;
});

onMounted(() => {
  lastY = window.scrollY;
  window.addEventListener("scroll", onScroll, { passive: true });
});
onUnmounted(() => window.removeEventListener("scroll", onScroll));
</script>
