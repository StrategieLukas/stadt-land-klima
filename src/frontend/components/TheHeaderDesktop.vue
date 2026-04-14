<template>
  <header
    ref="headerEl"
    class="fixed top-0 left-0 right-0 backdrop-blur-md border-b border-gray-200 transition-[box-shadow,background] duration-300"
    :style="isOpen ? 'background: rgba(255,255,255,1)' : 'background: rgba(255,255,255,0.82)'"
    :class="[
      scrolled && !isOpen ? 'shadow-lg' : '',
      isOpen ? 'z-[10003]' : 'z-50',
    ]"
  >
    <!-- Row 1: Logo | Persistent Search Bar | Actions -->
    <div
      class="flex items-center gap-4 mx-auto w-full max-w-screen-xl px-4 md:px-8 lg:px-4 xl:px-6 2xl:px-0 transition-[padding] duration-300 ease-in-out"
      :class="scrolled ? 'py-1.5' : 'py-3'"
    >
      <!-- Logo -->
      <NuxtLink
        to="/"
        class="flex-shrink-0 overflow-hidden transition-[height] duration-300 ease-in-out"
        :class="scrolled ? 'h-10' : 'h-20'"
      >
        <img src="~/assets/images/Stadt-Land-Klima-Logo.svg" class="h-full w-auto hidden lg:block" :alt="$t('logo.alt')" />
        <img src="~/assets/images/Stadt-Land-Kima-Logo_quad.png" class="h-full w-auto block lg:hidden" :alt="$t('logo.alt')" />
      </NuxtLink>

      <!-- Persistent Search Bar -->
      <div
        ref="searchBarRef"
        class="flex flex-1 items-center gap-2.5 bg-white border-2 rounded-full px-5 max-w-2xl mx-auto transition-colors duration-150 cursor-text"
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
          placeholder="Gemeinde, Projekt oder Thema suchen…"
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
          aria-label="Suche löschen"
          @click.stop="onClearSearch"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Actions: Login + Donate -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <a href="/backend">
          <button
            class="h-9 flex items-center gap-1 px-3 lg:px-4 rounded border-2 border-orange text-orange text-sm font-semibold hover:bg-orange hover:text-white transition-colors whitespace-nowrap"
            :aria-label="$t('generic.log_in')"
          >
            <svg class="h-4 w-4 lg:hidden" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M7.5 3.75A1.5 1.5 0 0 0 6 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V15a.75.75 0 0 1 1.5 0v3.75a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V5.25a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V9A.75.75 0 0 1 15 9V5.25a1.5 1.5 0 0 0-1.5-1.5h-6Zm10.72 4.72a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.72H9a.75.75 0 0 1 0-1.5h10.94l-1.72-1.72a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
            </svg>
            <span class="hidden lg:inline">{{ $t('generic.log_in') }}</span>
            <span class="hidden lg:inline" aria-hidden="true">→</span>
          </button>
        </a>
        <a
          href="https://www.betterplace.org/de/projects/157241-stadt-land-klima-bringe-kommunalen-klimaschutz-voran"
          class="lg:hidden"
          :aria-label="$t('donate.label')"
        >
          <button class="h-9 w-9 flex items-center justify-center rounded bg-orange text-white hover:brightness-110">
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
         dropdowns are not clipped once the strip is fully open. -->
    <div
      ref="navStripClipRef"
      class="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      :style="scrollNavVisible ? 'max-height: 40px' : 'max-height: 0'"
    >
      <div
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
import { useHeaderHeight, useNavInputRect } from '~/composables/useHeaderHeight.js'

const { $t } = useNuxtApp()
const { isOpen, query, embeddedInput, close } = useSearchPalette()

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
const headerHeight     = useHeaderHeight()
const navInputRect     = useNavInputRect()
const scrollNavVisible = ref(true)

const { moveFocusEmbedded, navigateFocusedEmbedded } = useEmbeddedSearchBridge()

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

let removeScrollListener = null
let removeResizeListener = null
let resizeObserver       = null
let lastScrollY          = 0

onMounted(() => {
  lastScrollY = window.scrollY

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
    lastScrollY    = window.scrollY
    scrolled.value = window.scrollY > 8
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  removeScrollListener = () => window.removeEventListener('scroll', onScroll)

  if (headerEl.value) {
    const update = () => {
      headerHeight.value = headerEl.value.offsetHeight
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
})
</script>


