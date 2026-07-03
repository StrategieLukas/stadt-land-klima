<template>
  <header
    class="border-gray-300 fixed left-0 right-0 top-0 z-50 w-full border-b bg-white transition-transform duration-300 ease-in-out"
    :style="[hidden ? 'transform: translateY(-100%)' : 'transform: translateY(0)']"
  >
    <div class="mx-auto flex w-full max-w-screen-xl items-center gap-3 px-3 py-2">
      <!-- Left: Logo -->
      <NuxtLink to="/" class="flex-shrink-0">
        <img src="~/assets/images/Stadt-Land-Klima-Logo.svg" class="h-12 w-auto dark:hidden" :alt="$t('logo.alt')" />
        <img
          src="~/assets/images/Stadt-Land-Klima-Logo-dark.svg"
          class="hidden h-12 w-auto dark:block"
          :alt="$t('logo.alt')"
        />
      </NuxtLink>

      <!-- Search bar fills remaining space -->
      <button
        class="border-gray-200 dark:border-[var(--slk-border)] flex h-10 min-w-0 flex-1 cursor-text items-center gap-2.5 rounded-full border-2 bg-white dark:bg-[var(--slk-surface-subdued)] px-4 text-left transition-colors hover:border-gray-300 dark:hover:border-[var(--slk-border-strong)]"
        @click="open()"
        :aria-label="$t('generic.search')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="text-gray-400 h-4 w-4 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <span class="text-gray-400 dark:text-[var(--slk-text-subtle)] min-w-0 flex-1 truncate text-sm">{{ $t('search.header.placeholder') }}</span>
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
