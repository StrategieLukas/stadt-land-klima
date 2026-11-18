<template>
  <header
    ref="headerEl"
    class="slk-header-surface fixed top-0 right-0 left-0 border-b border-gray-200 transition-[box-shadow,background] duration-300 dark:border-(--slk-border)"
    :class="[scrolled || (isOpen && embeddedInput) ? 'shadow-lg' : '', isOpen && embeddedInput ? 'z-10005' : 'z-50']"
  >
    <!-- Row 1: Logo | Persistent Search Bar | Actions -->
    <div
      class="mx-auto grid w-full max-w-(--breakpoint-xl) grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 sm:py-3 md:px-8 lg:px-4 xl:gap-6 xl:px-6 2xl:px-0"
    >
      <!-- Logo -->
      <!-- On sm: breakpoint mirrors isDesktop so the pre-hydration desktop header
           looks identical to TheHeaderMobile (h-12 / py-2), preventing layout shift. -->
      <NuxtLink
        to="/"
        class="header-logo flex h-12 shrink-0 items-center overflow-hidden transition-[height] duration-300 ease-in-out sm:w-20 lg:w-[228px]"
        :class="scrolled ? 'sm:h-14' : 'sm:h-20'"
      >
        <!-- SVG logotype: shown on mobile (<sm, matches TheHeaderMobile) and large desktop (≥lg) -->
        <img
          src="~/assets/images/Stadt-Land-Klima-Logo.svg"
          class="block h-full w-auto sm:hidden lg:block dark:hidden"
          :alt="$t('logo.alt')"
        />
        <img
          src="~/assets/images/Stadt-Land-Klima-Logo-dark.svg"
          class="hidden h-full w-auto dark:block dark:sm:hidden dark:lg:block"
          :alt="$t('logo.alt')"
        />
        <!-- Quad logo: only shown on sm–lg range where the header is narrow but ≥640px -->
        <img
          src="~/assets/images/Stadt-Land-Kima-Logo_quad.png"
          class="hidden h-full w-auto sm:block lg:hidden dark:hidden"
          :alt="$t('logo.alt')"
        />
        <img
          src="~/assets/images/Stadt-Land-Kima-Logo_quad-dark.png"
          class="hidden h-full w-auto dark:sm:block dark:lg:hidden"
          :alt="$t('logo.alt')"
        />
      </NuxtLink>

      <!-- Persistent Search Bar — always visible in the middle grid column. -->
      <div class="w-full min-w-0 justify-self-center 2xl:max-w-160">
        <div
          ref="searchBarRef"
          data-search-header
          class="flex h-11 w-full cursor-text items-center gap-2.5 rounded-full border-2 bg-white px-5 transition-colors duration-150 dark:bg-(--slk-surface-subdued)"
          :class="[
            searchFocused
              ? 'border-olive-green dark:border-(--slk-olive-green)'
              : 'border-gray-200 hover:border-gray-300 dark:border-(--slk-border) dark:hover:border-(--slk-border-strong)',
          ]"
          @click="focusSearchInput"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 shrink-0 transition-colors"
            :class="searchFocused ? 'text-olive-green' : 'text-gray-400'"
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
          <input
            ref="searchInputRef"
            v-model="query"
            class="min-w-0 flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-hidden dark:text-(--slk-text) dark:placeholder-(--slk-text-subtle)"
            :placeholder="$t('search.header.placeholder')"
            :aria-label="$t('generic.search')"
            aria-haspopup="dialog"
            aria-controls="search-palette-panel"
            :aria-expanded="isVisible"
            @focus="onSearchFocus"
            @blur="searchFocused = false"
            @input="openEmbedded"
            @keydown="onSearchKeydown"
          />
          <button
            v-if="query"
            type="button"
            class="shrink-0 text-gray-300 transition-colors hover:text-gray-500"
            :aria-label="$t('search.clear')"
            @click.stop="onClearSearch"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span
            v-if="!query && !searchFocused"
            class="pointer-events-none hidden shrink-0 items-center gap-0.5 md:inline-flex"
          >
            <kbd class="kbd kbd-xs">Ctrl</kbd><span class="text-[10px] text-gray-400">+</span
            ><kbd class="kbd kbd-xs">K</kbd>
          </span>
        </div>
      </div>

      <!-- Actions: Login + Donate -->
      <div class="relative z-10 flex min-w-max items-center gap-2 justify-self-end">
        <TheSettingsDropdown class="hidden sm:inline-flex" />
        <!-- Login: compact icon until 2xl, canonical button on wide desktop -->
        <a href="/backend" class="hidden sm:flex 2xl:hidden">
          <button
            class="flex h-9 w-9 items-center justify-center rounded-md bg-light-green text-white shadow-xs transition-all hover:brightness-110"
            :aria-label="$t('generic.log_in')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 141.7 141.7" class="h-5 w-5" aria-hidden="true">
              <polygon
                fill="currentColor"
                points="72.8,103.7 78.3,109.2 116.5,71 78.3,32.8 72.8,38.3 90.3,55.8 37.1,55.8 37.1,63.5 98.1,63.5 105.5,71 98.1,78.4 37.1,78.4 37.1,86.2 90.3,86.2"
              />
            </svg>
          </button>
        </a>
        <div class="hidden 2xl:block">
          <LoginButton />
        </div>
        <a :href="DONATION_PAGE_PATH" class="hidden sm:flex 2xl:hidden" :aria-label="$t('donate.label')">
          <button
            class="flex h-9 w-9 items-center justify-center rounded-md bg-orange text-white shadow-xs transition-all hover:brightness-110"
          >
            <img src="~/assets/icons/icon_hand_holding_heart.svg" class="h-5 w-5" aria-hidden="true" />
          </button>
        </a>
        <div class="hidden 2xl:block">
          <DonateButton />
        </div>
      </div>
    </div>

    <!-- Measured height supports wrapped rows. Dropdowns teleport outside this clip. -->
    <!-- Nav strip: hidden below sm so pre-hydration mobile view matches TheHeaderMobile -->
    <div
      class="header-nav-reveal hidden overflow-hidden sm:block"
      :style="{ height: scrollNavVisible ? `${navStripHeight}px` : '0px' }"
      :data-navigation-visible="scrollNavVisible"
      :inert="!scrollNavVisible"
      :aria-hidden="!scrollNavVisible"
    >
      <div
        ref="navStripInnerRef"
        class="header-nav-content"
        :class="{ 'header-nav-content-hidden': !scrollNavVisible }"
      >
        <TheNavigationStripDesktop :items="navItems" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { Municipality } from "~/types/components/municipality";
import type { NavigationPage, NavigationItem } from "~/types/components/navigation";

import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useSearchPalette } from "~/composables/useSearchPalette";
import { useEmbeddedSearchBridge } from "~/composables/useEmbeddedSearchBridge";
import { useHeaderHeight, useHeaderSpacerHeight, useNavInputRect } from "~/composables/useHeaderHeight";
import { DONATION_PAGE_PATH } from "~/shared/donation";
import { createHeaderScrollTracker } from "~/utils/headerScroll";

const { $t } = useNuxtApp();
const { isOpen, isVisible, query, embeddedInput, navigationDropdownOpen, openEmbedded, close, clearQuery } =
  useSearchPalette();

defineProps({
  municipalities: { type: Array as PropType<Municipality[] | undefined>, default: () => [] },
  pages: { type: Array as PropType<NavigationPage[] | undefined>, default: () => [] },
  navItems: { type: Array as PropType<NavigationItem[] | undefined>, default: () => [] },
});

const scrolled = ref(false);
const searchFocused = ref(false);
const searchInputRef = ref<HTMLInputElement | null>(null);
const searchBarRef = ref<HTMLElement | null>(null);
const headerEl = ref<HTMLElement | null>(null);
const navStripInnerRef = ref<HTMLElement | null>(null);
// 41 = border-t (1px) + min-h-10 items (40px) — matches actual strip height on SSR
// so the clip wrapper never clips content before ResizeObserver fires.
const navStripHeight = ref(41);
const headerHeight = useHeaderHeight();
const headerSpacerHeight = useHeaderSpacerHeight();
const navInputRect = useNavInputRect();
const scrollNavVisible = ref(true);

const { moveFocusEmbedded, navigateFocusedEmbedded } = useEmbeddedSearchBridge();
const bridge = useEmbeddedSearchBridge();

let unregisterFocus: (() => void) | undefined;
onMounted(() => {
  unregisterFocus = bridge.registerFocusInput(focusSearchInput);
});

function focusSearchInput() {
  if (!searchInputRef.value?.isConnected) return false;
  openEmbedded();
  searchInputRef.value.focus();
  return true;
}

function onSearchFocus() {
  searchFocused.value = true;
  openEmbedded();
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  if (event.key === "Escape") {
    event.stopPropagation();
    if (navigationDropdownOpen.value) navigationDropdownOpen.value = false;
    else {
      close();
      searchInputRef.value?.blur();
    }
  } else if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
    event.preventDefault();
    if (event.key === "Enter") void navigateFocusedEmbedded();
    else moveFocusEmbedded(event.key === "ArrowDown" ? 1 : -1);
  }
}

function onClearSearch() {
  clearQuery();
  void nextTick(focusSearchInput);
}

watch([isOpen, embeddedInput], ([open, embedded]) => {
  if (open && embedded) void nextTick(measureSearchInput);
});

function measureSearchInput() {
  if (!searchBarRef.value) return;
  const { left, width, bottom } = searchBarRef.value.getBoundingClientRect();
  const previous = navInputRect.value;
  if (previous.left !== left || previous.width !== width || previous.bottom !== bottom)
    navInputRect.value = { left, width, bottom };
}

let removeScrollListener: (() => void) | null = null;
let removeResizeListener: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let navStripObserver: ResizeObserver | null = null;
let scrollFrame = 0;

watch(scrollNavVisible, (visible) => {
  if (!visible) navigationDropdownOpen.value = false;
});

onMounted(() => {
  const trackScroll = createHeaderScrollTracker(window.scrollY);
  scrolled.value = window.scrollY > 16;

  // Measure inner nav strip height so the clip animation works for any number of wrapped rows.
  // The inner div is not constrained by overflow/max-height, so ResizeObserver always sees
  // the true content height even while the clip wrapper is collapsed.
  if (navStripInnerRef.value) {
    const updateNavHeight = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height);
        if (h > 0) navStripHeight.value = h;
      }
    };
    navStripObserver = new ResizeObserver(updateNavHeight);
    navStripObserver.observe(navStripInnerRef.value);
    // Seed immediately in case ResizeObserver hasn't fired yet
    navStripHeight.value = navStripInnerRef.value.offsetHeight || 40;
  }

  const updateScroll = () => {
    scrollFrame = 0;
    const y = window.scrollY;
    scrollNavVisible.value = trackScroll(y);
    if (y > 16) scrolled.value = true;
    else if (y <= 8) scrolled.value = false;
  };
  const onScroll = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  removeScrollListener = () => {
    window.removeEventListener("scroll", onScroll);
  };

  if (headerEl.value) {
    const update = (entries?: ResizeObserverEntry[]) => {
      const h = entries?.[0]?.borderBoxSize[0]?.blockSize ?? headerEl.value?.getBoundingClientRect().height ?? 146;
      // headerHeight tracks the live header height so that sticky children
      // (pill nav, sidebar tops) follow it precisely as the nav strip animates.
      headerHeight.value = h;
      // Only sync at exactly zero: changing the spacer near the top can make
      // browser scroll anchoring reverse the detected scroll direction.
      if (window.scrollY === 0) {
        headerSpacerHeight.value = h;
      }
      if (isOpen.value && embeddedInput.value) measureSearchInput();
    };
    update();
    measureSearchInput();
    resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(headerEl.value);
    const onResize = () => {
      update();
      measureSearchInput();
    };
    window.addEventListener("resize", onResize, { passive: true });
    removeResizeListener = () => {
      window.removeEventListener("resize", onResize);
    };
  }
});

onUnmounted(() => {
  unregisterFocus?.();
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  if (removeScrollListener) removeScrollListener();
  if (removeResizeListener) removeResizeListener();
  if (resizeObserver) resizeObserver.disconnect();
  if (navStripObserver) navStripObserver.disconnect();
});
</script>

<style scoped>
.header-nav-reveal {
  transition: height 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.header-nav-content {
  transition:
    opacity 180ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.header-nav-content-hidden {
  opacity: 0;
  transform: translateY(-8px);
}
@media (prefers-reduced-motion: reduce) {
  .header-logo,
  .header-nav-reveal,
  .header-nav-content {
    transition: none !important;
  }
}
</style>
