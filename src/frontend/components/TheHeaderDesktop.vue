<template>
  <header
    ref="headerEl"
    class="fixed top-0 left-0 right-0 backdrop-blur-md border-b border-gray-200 transition-[box-shadow,background] duration-300"
    :style="isOpen ? 'background: rgba(255,255,255,1)' : 'background: rgba(255,255,255,0.82)'"
    :class="[
      scrolled && !isOpen ? 'shadow-lg' : '',
      isOpen && embeddedInput ? 'z-[10003]' : 'z-50',
    ]"
  >
    <!-- Row 1: Logo | Persistent Search Bar | Actions -->
    <div
      class="relative flex items-center mx-auto w-full max-w-screen-xl px-4 md:px-8 lg:px-4 xl:px-6 2xl:px-0 transition-[padding] duration-300 ease-in-out py-2"
      :class="scrolled ? 'sm:py-1.5' : 'sm:py-3'"
    >
      <!-- Logo -->
      <!-- On sm: breakpoint mirrors isDesktop so the pre-hydration desktop header
           looks identical to TheHeaderMobile (h-12 / py-2), preventing layout shift. -->
      <NuxtLink
        to="/"
        class="shrink-0 overflow-hidden transition-[height] duration-300 ease-in-out h-12"
        :class="scrolled ? 'sm:h-14' : 'sm:h-20'"
      >
        <!-- SVG logotype: shown on mobile (<sm, matches TheHeaderMobile) and large desktop (≥lg) -->
        <img src="~/assets/images/Stadt-Land-Klima-Logo.svg" class="h-full w-auto block sm:hidden lg:block" :alt="$t('logo.alt')" />
        <!-- Quad logo: only shown on sm–lg range where the header is narrow but ≥640px -->
        <img src="~/assets/images/Stadt-Land-Kima-Logo_quad.png" class="h-full w-auto hidden sm:block lg:hidden" :alt="$t('logo.alt')" />
      </NuxtLink>

      <!-- Persistent Search Bar — absolutely centered in the header -->
      <!-- hidden on sm: mirrors the isDesktop breakpoint (≥640px) so mobile users don't
           see the full search bar before hydration swaps to TheHeaderMobile. -->
      <div class="hidden sm:block absolute left-1/2 -translate-x-1/2 w-full max-w-[28rem] px-4">
      <div
        ref="searchBarRef"
        class="flex w-full items-center gap-2.5 bg-white border-2 rounded-full px-5 transition-colors duration-150 cursor-text"
        :class="[scrolled ? 'h-10' : 'h-11', searchFocused ? 'border-olive-green' : 'border-gray-200 hover:border-gray-300']"
        @click="searchInputRef?.focus()"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 flex-shrink-0 flex-shrink-0 transition-colors"
          :class="searchFocused ? 'text-olive-green' : 'text-gray-400'"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref="searchInputRef"
          v-model="query"
          class="flex-1 min-w-0 text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
          :placeholder="$t('search.header.placeholder')"
          @focus="onSearchFocus"
          @keydown.up.prevent="moveFocusEmbedded(-1)"
          @keydown.down.prevent="moveFocusEmbedded(1)"
          @keydown.enter.prevent="navigateFocusedEmbedded"
          @keydown.escape="onSearchEscape"
        />
        <button
          v-if="query"
          type="button"
          class="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
          :aria-label="$t('search.clear')"
          @click.stop="onClearSearch"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span
          v-if="!query && !searchFocused"
          class="hidden md:inline-flex items-center gap-0.5 pointer-events-none flex-shrink-0"
        >
          <kbd class="kbd kbd-xs">Ctrl</kbd><span class="text-[10px] text-gray-400">+</span><kbd class="kbd kbd-xs">K</kbd>
        </span>
      </div>
      </div>

      <!-- Actions: Login + Donate -->
      <div class="ml-auto flex items-center gap-2">
        <!-- Search button: only visible on mobile (<sm) to mirror TheHeaderMobile pre-hydration -->
        <button
          class="sm:hidden flex items-center justify-center h-10 w-12 bg-white border-2 border-gray-200 rounded-full text-gray-400 hover:border-gray-300 transition-colors flex-none"
          @click="open()"
          :aria-label="$t('generic.search')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </button>
        <!-- Login: compact icon on sm-lg, canonical button on desktop -->
        <a href="/backend" class="hidden sm:flex lg:hidden">
          <button
            class="h-9 w-9 flex items-center justify-center rounded-md bg-light-green text-white hover:brightness-110 transition-all shadow-sm"
            :aria-label="$t('generic.log_in')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 141.7 141.7" class="h-5 w-5" aria-hidden="true">
              <polygon fill="currentColor" points="72.8,103.7 78.3,109.2 116.5,71 78.3,32.8 72.8,38.3 90.3,55.8 37.1,55.8 37.1,63.5 98.1,63.5 105.5,71 98.1,78.4 37.1,78.4 37.1,86.2 90.3,86.2"/>
            </svg>
          </button>
        </a>
        <div class="hidden lg:block">
          <LoginButton />
        </div>
        <a
          href="https://www.betterplace.org/de/projects/157241-stadt-land-klima-bringe-kommunalen-klimaschutz-voran"
          class="hidden sm:flex lg:hidden"
          :aria-label="$t('donate.label')"
        >
          <button class="h-9 w-9 flex items-center justify-center rounded-md bg-orange text-white hover:brightness-110 transition-all shadow-sm">
            <img src="~/assets/icons/icon_hand_holding_heart.svg" class="h-5 w-5" aria-hidden="true" />
          </button>
        </a>
        <div class="hidden lg:block">
          <DonateButton />
        </div>
      </div>
    </div>

    <!-- Row 2: Navigation strip — collapses when scrolling down, reappears on scroll up.
         The clip wrapper handles max-height; the inner div handles opacity so both animate together.
         overflow switches to visible only after the expand transition ends (transitionend) so
         dropdowns are not clipped once the strip is fully open.
         navStripHeight is measured via ResizeObserver on the inner div so the animation
         handles any number of wrapped rows automatically. -->
    <!-- Nav strip: hidden below sm so pre-hydration mobile view matches TheHeaderMobile -->
    <div
      ref="navStripClipRef"
      class="hidden sm:block overflow-hidden transition-[max-height] duration-300 ease-in-out"
      :style="scrollNavVisible ? `max-height: ${navStripHeight}px` : 'max-height: 0'"
    >
      <div
        ref="navStripInnerRef"
        class="transition-[opacity] duration-300 ease-in-out"
        :style="scrollNavVisible ? 'opacity: 1' : 'opacity: 0'"
      >
        <TheNavigationStripDesktop :items="navItems" />
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSearchPalette } from '~/composables/useSearchPalette.js'
import { useEmbeddedSearchBridge } from '~/composables/useEmbeddedSearchBridge.js'
import { useHeaderHeight, useHeaderSpacerHeight, useNavInputRect } from '~/composables/useHeaderHeight.js'

const { $t } = useNuxtApp()
const { isOpen, query, embeddedInput, close, open } = useSearchPalette()

defineProps({
  municipalities: { type: Array, default: () => [] },
  pages:          { type: Array, default: () => [] },
  navItems:       { type: Array, default: () => [] },
})

const scrolled         = ref(false)
const searchFocused    = ref(false)
const searchInputRef   = ref(null)
const searchBarRef     = ref(null)
const headerEl         = ref(null)
const navStripClipRef  = ref(null)
const navStripInnerRef = ref(null)
// 41 = border-t (1px) + min-h-10 items (40px) — matches actual strip height on SSR
// so the clip wrapper never clips content before ResizeObserver fires.
const navStripHeight   = ref(41)
const headerHeight     = useHeaderHeight()
const headerSpacerHeight = useHeaderSpacerHeight()
const navInputRect     = useNavInputRect()
const scrollNavVisible = ref(true)

const { moveFocusEmbedded, navigateFocusedEmbedded } = useEmbeddedSearchBridge()
const bridge = useEmbeddedSearchBridge()

// Register the focus callback so Ctrl+K anywhere can focus this input
onMounted(() => {
  bridge.registerFocusInput(() => searchInputRef.value?.focus())
})

function onSearchFocus() {
  searchFocused.value = true
  // Open palette in embedded mode; preserve any existing query on re-focus
  embeddedInput.value = true
  isOpen.value = true
}

function onSearchEscape() {
  close()
  searchFocused.value = false
  searchInputRef.value?.blur()
}

function onClearSearch() {
  query.value = ''
  nextTick(() => searchInputRef.value?.focus())
}

// Sync focus indicator when palette is closed externally (backdrop click)
watch(isOpen, (val) => {
  if (!val) searchFocused.value = false
})

let removeScrollListener  = null
let removeResizeListener  = null
let resizeObserver        = null
let navStripObserver      = null
let lastScrollY           = 0

onMounted(() => {
  lastScrollY = window.scrollY

  // Measure inner nav strip height so the clip animation works for any number of wrapped rows.
  // The inner div is not constrained by overflow/max-height, so ResizeObserver always sees
  // the true content height even while the clip wrapper is collapsed.
  if (navStripInnerRef.value) {
    const updateNavHeight = (entries) => {
      for (const entry of entries) {
        const h = Math.round(entry.contentRect.height)
        if (h > 0) navStripHeight.value = h
      }
    }
    navStripObserver = new ResizeObserver(updateNavHeight)
    navStripObserver.observe(navStripInnerRef.value)
    // Seed immediately in case ResizeObserver hasn't fired yet
    navStripHeight.value = navStripInnerRef.value.offsetHeight || 40
  }

  // After the expand transition ends, switch overflow to visible so dropdowns aren't clipped.
  // On collapse start, switch back to hidden immediately so the closing animation clips correctly.
  const onTransitionEnd = (e) => {
    if (e.propertyName === 'max-height' && navStripClipRef.value) {
      navStripClipRef.value.style.overflow = scrollNavVisible.value ? 'visible' : 'hidden'
    }
  }
  // Watch scroll direction to reset overflow to hidden before collapse begins
  watch(scrollNavVisible, (visible) => {
    if (!visible && navStripClipRef.value) {
      navStripClipRef.value.style.overflow = 'hidden'
    }
  })

  nextTick(() => {
    navStripClipRef.value?.addEventListener('transitionend', onTransitionEnd)
    // On fresh load the strip is already visible but no transition has run,
    // so transitionend never fires — set overflow explicitly here.
    if (navStripClipRef.value) {
      navStripClipRef.value.style.overflow = 'visible'
    }
  })

  const onScroll = () => {
    const delta = window.scrollY - lastScrollY
    if (delta > 4)  scrollNavVisible.value = false
    if (delta < -4) scrollNavVisible.value = true
    const wasScrolled = lastScrollY >= 10
    lastScrollY    = window.scrollY
    scrolled.value = window.scrollY > 8
    // When the user scrolls back to the very top, sync the spacer to the current
    // (expanded) header height. This can't loop because scrollY is now < 10.
    if (wasScrolled && window.scrollY < 10 && headerEl.value) {
      headerSpacerHeight.value = headerEl.value.offsetHeight
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  removeScrollListener = () => window.removeEventListener('scroll', onScroll)

  if (headerEl.value) {
    const update = () => {
      const h = headerEl.value.offsetHeight
      // headerHeight tracks the live header height so that sticky children
      // (pill nav, sidebar tops) follow it precisely as the nav strip animates.
      headerHeight.value = h
      // headerSpacerHeight is only updated at the top of the page.
      // The layout spacer uses this value; keeping it frozen while scrolled
      // prevents the scroll-anchoring loop (spacer shrinks → browser adjusts
      // scrollY → delta triggers nav strip toggle → loop).
      if (window.scrollY < 10) {
        headerSpacerHeight.value = h
      }
      if (searchBarRef.value) {
        const r  = searchBarRef.value.getBoundingClientRect()
        const hr = headerEl.value.getBoundingClientRect()
        navInputRect.value = { left: r.left, width: r.width, topInHeader: r.top - hr.top }
      }
    }
    update()
    resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(headerEl.value)
    window.addEventListener('resize', update, { passive: true })
    removeResizeListener = () => window.removeEventListener('resize', update)
  }
})

onUnmounted(() => {
  if (removeScrollListener) removeScrollListener()
  if (removeResizeListener) removeResizeListener()
  if (resizeObserver)       resizeObserver.disconnect()
  if (navStripObserver)     navStripObserver.disconnect()
})
</script>

