<template>
  <div class="drawer">
    <!-- Drawer Toggle Checkbox (Hidden) -->
    <input id="page-drawer" type="checkbox" class="drawer-toggle" ref="drawerToggle" />

    <div 
      class="drawer-content flex flex-col min-h-screen text-neutral font-sans min-w-0 overflow-x-hidden"
      @click="closeDrawerOnOutsideClick"
    >
      <!-- Only render the appropriate header based on the viewport -->
      <div>
        <div v-if="hydrated">
          <!-- Desktop Header -->
          <div v-if="isDesktop">
            <the-header-desktop
              :pages="pages.filter((page) => includes(page.menus, 'main'))"
              :municipalities="publishedMunicipalities"
              :nav-items="navigationConfig?.header_items || []"
            />
          </div>

          <!-- Mobile Header -->
          <div v-else>
            <the-header-mobile :municipalities="publishedMunicipalities" />
          </div>
        </div>
        <div v-else class="mb-3 bg-white px-2 py-4 shadow">
          <!-- Placeholder space to prevent layout shift during hydration -->
          <div class="mx-auto flex w-full max-w-screen-xl flex-col items-center gap-x-8 lg:flex-row lg:items-end">
            <div class="h-32 w-auto opacity-0"><!-- Logo placeholder --></div>
            <div class="flex-1 opacity-0"><!-- Search placeholder --></div>
          </div>
        </div>
      </div>

      <!-- Sticky nav bar (desktop only) — sits between the old header and main content -->
      <div
        v-if="hydrated && isDesktop"
        class="sticky top-0 z-50 h-12 flex items-stretch transition-shadow"
        :class="scrolled ? 'bg-mid-gray/85 backdrop-blur-md shadow-md' : 'bg-mid-gray'"
      >
        <!-- Nav items — flex-1 so the search bar stays on the right -->
        <TheNavigationMenuDesktop
          :items="navigationConfig?.header_items || []"
          :pages="pages.filter((p) => includes(p.menus, 'main'))"
          class="flex-1 min-w-0"
        />

        <!-- Inline search bar — opens Cmd+K palette, visually aligned with palette input -->
        <button
          class="flex items-center gap-2 mx-3 my-1.5 px-3 rounded bg-white/10 hover:bg-white/15 text-white/70 hover:text-white text-sm transition-colors flex-shrink-0"
          style="min-width: 220px"
          @click="openSearch"
          aria-label="Suche öffnen (Strg+K)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <span class="flex-1 text-left">Suchen…</span>
          <kbd class="text-xs opacity-40 font-mono border border-white/20 rounded px-1.5 py-0.5">⌘K</kbd>
        </button>
      </div>

        <!-- Main Content (always rendered) -->
        <main class="flex grow flex-col px-2 py-4 bg-mild-white min-w-0">
          <div class="mx-auto w-full max-w-screen-xl flex flex-col min-w-0">
            <slot />
          </div>
        </main>


      <div v-if="hydrated" class="pb-[84px] lg:pb-0">
        <!-- Footer (Desktop version) -->
        <div v-if="isDesktop" class="bg-mild-white">
          <the-footer-desktop
            :pages="pages.filter((page) => includes(page.menus, 'footer'))"
            :nav-items="navigationConfig?.footer_columns || []"
          />
        </div>

        <!-- Footer (Mobile version) -->
        <div v-if="!isDesktop" class="bg-mild-white">
          <the-footer-mobile
            :pages="pages.filter((page) => includes(page.menus, 'footer'))"
          />
        </div>
      </div>
      <div v-else class="pb-[84px] lg:pb-0">
        <!-- Footer placeholder to prevent layout shift -->
        <div class="bg-mild-white opacity-0">
          <div class="h-20"><!-- Footer placeholder --></div>
        </div>
      </div>
    </div>

    <!-- Drawer Side (Menu) - unified for both mobile and desktop -->
    <the-drawer-side
      :pages="pages.filter((page) => includes(page.menus, 'main'))"
      class="z-[9999]"
    />

    <!-- Dock (Mobile version - always visible, sticky) -->
    <div class="fixed bottom-0 left-0 right-0 z-50 block lg:hidden z-[10000]">
      <the-dock :pages="pages.filter((page) => includes(page.menus, 'dock'))" />
    </div>

    <!-- Global search command palette (Cmd+K) -->
    <TheSearchCommandPalette />
  </div>
</template>



<script setup>

import lodash from "lodash";
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
const { includes } = lodash;
const { $directus, $readItems, $readSingleton } = useNuxtApp();
const { plausibleAnalyticsUrl, plausibleAnalyticsDomain } = useRuntimeConfig().public;
const route = useRoute();
const { closeDrawer, syncDrawerState } = useDrawer();
const { open: openSearch } = useSearchPalette();

const hydrated = ref(false)
const isDesktop = ref(false)
const scrolled = ref(false)
const drawerToggle = ref(null)
let cleanup = null

// Close drawer when clicking outside
const closeDrawerOnOutsideClick = (event) => {
  // Only close if drawer is open and click is not on drawer toggle button
  if (drawerToggle.value && drawerToggle.value.checked) {
    const drawerSide = document.querySelector('.drawer-side')
    const drawerToggleButton = document.querySelector('label[for="page-drawer"]')
    
    // Check if click is outside drawer and not on toggle button
    if (drawerSide && !drawerSide.contains(event.target) && 
        (!drawerToggleButton || !drawerToggleButton.contains(event.target))) {
      closeDrawer()
    }
  }
}

// Handle escape key
const handleEscapeKey = (event) => {
  if (event.key === 'Escape' && drawerToggle.value && drawerToggle.value.checked) {
    closeDrawer()
  }
}

onMounted(() => {
  hydrated.value = true
  
  // Initial desktop state detection
  const checkDesktop = () => window.innerWidth >= 1024
  isDesktop.value = checkDesktop()
  
  // Media query for more reliable detection
  const mq = window.matchMedia('(min-width: 1024px)')
  const update = () => {
    const wasDesktop = isDesktop.value
    isDesktop.value = mq.matches
    
    // If desktop state changed, force layout recalculation
    if (wasDesktop !== isDesktop.value) {
      nextTick(() => {
        window.dispatchEvent(new Event('resize'))
        // Force reflow
        document.body.offsetHeight
      })
    }
  }
  
  // Listen to both media query changes and resize events
  mq.addEventListener('change', update)
  window.addEventListener('resize', update)
  
  // Track scroll for sticky nav backdrop
  const onScroll = () => { scrolled.value = window.scrollY > 8 }
  window.addEventListener('scroll', onScroll, { passive: true })

  // Add escape key listener
  document.addEventListener('keydown', handleEscapeKey)
  
  // Monitor drawer checkbox changes to sync state
  const drawerCheckbox = document.getElementById('page-drawer')
  if (drawerCheckbox) {
    drawerCheckbox.addEventListener('change', syncDrawerState)
  }
  
  // Initial update
  update()
  
  // Store cleanup function
  cleanup = () => {
    mq.removeEventListener('change', update)
    window.removeEventListener('resize', update)
    window.removeEventListener('scroll', onScroll)
    document.removeEventListener('keydown', handleEscapeKey)
    if (drawerCheckbox) {
      drawerCheckbox.removeEventListener('change', syncDrawerState)
    }
  }
})

onUnmounted(() => {
  if (cleanup) cleanup()
})


const { data: pages } = await useAsyncData("pages", () => {
  return $directus.request($readItems("pages", { sort: "sort_order", limit: -1 }));
});

const { data: publishedMunicipalities } = await useAsyncData("municipalities", () => {
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

const { data: navigationConfig } = await useAsyncData("navigation_config", () => {
  return $directus.request($readSingleton("navigation_config")).catch(() => null);
});

//MetaTags
const description = ref("Stadt.Land.Klima!  Description");
useHead({
  titleTemplate: "%s - Stadt.Land.Klima!",
  meta: [
    {
      name: "description",
      content: description,
    },
  ],
  link: [{ rel: "icon", type: "image/png", href: "/favicon.png" }],
  script: [
    plausibleAnalyticsUrl && plausibleAnalyticsDomain
      ? {
          defer: true,
          "data-domain": plausibleAnalyticsDomain,
          src: plausibleAnalyticsUrl + "/js/script.js",
        }
      : {},
  ],
});
//
</script>

<style>
/* Ensure consistent layout regardless of hydration state */
.drawer-content {
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
}

/* Force main content to be properly centered */
main {
  width: 100%;
  box-sizing: border-box;
}

main > div {
  width: 100%;
  max-width: 1280px; /* max-w-screen-xl */
  margin: 0 auto;
  box-sizing: border-box;
}

/* Prevent layout shifts during hydration */
@media (max-width: 1023px) {
  .pb-\[84px\] {
    padding-bottom: 84px;
  }
}

@media (min-width: 1024px) {
  .lg\:pb-0 {
    padding-bottom: 0;
  }
}
</style>
