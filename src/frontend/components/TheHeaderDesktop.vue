<template>
  <header
    class="fixed top-0 left-0 right-0 backdrop-blur-md border-b border-gray-200 transition-[box-shadow] duration-300"
    style="background: rgba(255,255,255,0.82)"
    :class="[
      scrolled ? 'shadow-lg' : '',
      isOpen && embeddedInput ? 'z-[10003]' : 'z-50',
    ]"
  >
    <!-- 1fr | nav (auto, truly centred) | 1fr — equal side columns guarantee perfect centring -->
    <div
      class="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mx-auto w-full max-w-screen-xl transition-[padding] duration-300 ease-in-out"
      :class="scrolled ? 'py-1' : 'py-2'"
    >

      <!-- Left: Logo — left-aligned within its 1fr column -->
      <NuxtLink
        to="/"
        class="flex-shrink-0 justify-self-start overflow-hidden transition-[height] duration-300 ease-in-out"
        :class="scrolled ? 'h-12' : 'h-20'"
      >
        <img
          src="~/assets/images/Stadt-Land-Klima-Logo.svg"
          class="h-full w-auto"
          :alt="$t('logo.alt')"
        />
      </NuxtLink>

      <!-- Centre: nav always rendered (holds width); search overlays it absolutely -->
      <div class="flex items-center justify-center gap-2 min-w-0">

        <!-- Wrapper sized by the nav — search input absolutely covers the same box -->
        <div class="relative w-max">

          <!-- Nav pill bar: stays in DOM at all times to lock the container size.
               Fades out when search is active but keeps its layout footprint. -->
          <TheNavigationMenuDesktop
            :items="navItems"
            :style="{
              opacity: (isOpen && embeddedInput) ? '0' : '1',
              pointerEvents: (isOpen && embeddedInput) ? 'none' : 'auto',
              transition: 'opacity 150ms ease',
              userSelect: (isOpen && embeddedInput) ? 'none' : 'auto',
            }"
          />

          <!-- Search input: overlays the nav's exact bounding box, same styling -->
          <Transition name="nav-search" mode="out-in">
            <div
              v-if="isOpen && embeddedInput"
              key="search"
              class="absolute inset-0 flex items-center gap-3 px-4 bg-gray-50 border border-gray-200 rounded-full overflow-hidden"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                ref="embeddedInputRef"
                v-model="query"
                class="flex-1 min-w-0 text-sm text-gray-700 outline-none bg-transparent placeholder-gray-400"
                :placeholder="tabs[activeTab]?.placeholder ?? 'Gemeinde, Seite, Thema…'"
                @keydown.up.prevent="moveFocusEmbedded(-1)"
                @keydown.down.prevent="moveFocusEmbedded(1)"
                @keydown.enter.prevent="navigateFocusedEmbedded"
                @keydown.escape="close"
              />
            </div>
          </Transition>
        </div>

        <!-- Single toggle button — icon reacts to current mode -->
        <button
          @click="isOpen && embeddedInput ? close() : openEmbedded()"
          class="flex items-center justify-center h-9 w-9 flex-shrink-0 rounded-full border border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          :aria-label="isOpen && embeddedInput ? 'Navigation anzeigen' : $t('generic.search')"
        >
          <!-- Search icon — shown when nav is visible -->
          <svg v-if="!(isOpen && embeddedInput)" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <!-- Hamburger icon — shown when search is visible -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

      </div>

      <!-- Right: Login + Donate — right-aligned within its 1fr column -->
      <div class="flex items-center gap-2 flex-shrink-0 justify-self-end">
        <a href="/backend">
          <button class="h-9 flex items-center gap-1 px-4 rounded border-2 border-orange text-orange text-sm font-semibold hover:bg-orange hover:text-white transition-colors whitespace-nowrap">
            <span>{{ $t('generic.log_in') }}</span>
            <span aria-hidden="true">→</span>
          </button>
        </a>
        <DonateButton />
      </div>

    </div>
  </header>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSearchPalette } from '~/composables/useSearchPalette.js'
import { useEmbeddedSearchBridge } from '~/composables/useEmbeddedSearchBridge.js'

const { $t } = useNuxtApp()
const { isOpen, query, embeddedInput, open, openEmbedded, close } = useSearchPalette()

const props = defineProps({
  municipalities: { type: Array, default: () => [] },
  pages:          { type: Array, default: () => [] },
  navItems:       { type: Array, default: () => [] },
})

const scrolled = ref(false)
const embeddedInputRef = ref(null)

// Proxy for keyboard navigation in embedded mode — palette exposes these via a shared event bus below
const { moveFocusEmbedded, navigateFocusedEmbedded, tabs, activeTab } = useEmbeddedSearchBridge()

// Auto-focus embedded input on open
watch(
  () => isOpen.value && embeddedInput.value,
  async (active) => {
    if (active) {
      await nextTick()
      embeddedInputRef.value?.focus()
    }
  }
)

let removeScrollListener = null
onMounted(() => {
  const onScroll = () => { scrolled.value = window.scrollY > 8 }
  window.addEventListener('scroll', onScroll, { passive: true })
  removeScrollListener = () => window.removeEventListener('scroll', onScroll)
})
onUnmounted(() => { if (removeScrollListener) removeScrollListener() })
</script>

<style scoped>
/* ── nav ↔ search : 3-D flip-out + spring-roll-in ──────────────────────────── */

/* The leaving element flips away like a card tumbling forward */
.nav-search-leave-active {
  transition: transform 200ms ease-in, opacity 160ms ease-in;
  transform-origin: center center;
  backface-visibility: hidden;
  will-change: transform, opacity;
}
.nav-search-leave-to {
  transform: perspective(500px) rotateX(-90deg) scaleY(0.4);
  opacity: 0;
}

/*
  The entering element unrolls from the top edge — starts folded flat
  (rotateX 90° + scaleY squished) and springs to full size.
  cubic-bezier(0.34, 1.56, 0.64, 1) = slight overshoot for that "snap" feel.
*/
.nav-search-enter-active {
  transition:
    transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity   200ms ease-out;
  transform-origin: top center;
  backface-visibility: hidden;
  will-change: transform, opacity;
}
.nav-search-enter-from {
  transform: perspective(500px) rotateX(80deg) scaleY(0.2);
  opacity: 0;
}
.nav-search-enter-to {
  transform: perspective(500px) rotateX(0deg) scaleY(1);
  opacity: 1;
}
</style>
