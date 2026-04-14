<template>
  <!-- Root is a plain block div — nothing here has overflow/transform/will-change
       so the header's sticky top-0 resolves against the viewport scroll container. -->
  <div class="flex flex-col min-h-screen text-neutral font-sans">

    <!-- ── Header: lives ABOVE the DaisyUI drawer so sticky always works ── -->
    <div v-if="hydrated">
      <div v-if="isDesktop">
        <the-header-desktop
          :pages="pages.filter((page) => includes(page.menus, 'main'))"
          :municipalities="publishedMunicipalities"
          :nav-items="navigationConfig?.header_items || []"
        />
      </div>
      <div v-else>
        <the-header-mobile />
      </div>
    </div>
    <!-- Spacer that reserves the height of the fixed header.
         Mobile: none (mobile header is sticky, not fixed). Desktop: driven by ResizeObserver via useHeaderHeight(). -->
    <div
      v-if="isDesktop && hydrated"
      class="flex-shrink-0"
      :style="`height: ${headerHeight}px`"
    ></div>

    <!-- ── DaisyUI drawer: wraps sidebar + main content only (no header) ── -->
    <div class="drawer flex-1">
      <input id="page-drawer" type="checkbox" class="drawer-toggle" ref="drawerToggle" />

      <div
        class="drawer-content flex flex-col text-neutral font-sans min-w-0"
        style="overflow-x: clip"
        @click="closeDrawerOnOutsideClick"
      >
        <!-- Main Content -->
        <main class="flex grow flex-col px-2 py-4 bg-mild-white min-w-0">
          <div class="mx-auto w-full max-w-screen-xl flex flex-col min-w-0">
            <slot />
          </div>
        </main>

        <div v-if="hydrated">
          <div v-if="isDesktop" class="bg-mild-white">
            <the-footer-desktop :nav-items="navigationConfig?.footer_columns || []" />
          </div>
          <div v-if="!isDesktop" class="bg-mild-white">
            <the-footer-mobile :nav-items="navigationConfig?.footer_columns || []" />
          </div>
        </div>
        <div v-else>
          <div class="bg-mild-white opacity-0">
            <div class="h-20"><!-- Footer placeholder --></div>
          </div>
        </div>
      </div>

      <!-- Drawer Side (Menu) -->
      <the-drawer-side
        :pages="pages.filter((page) => includes(page.menus, 'main'))"
        :nav-items="navigationConfig?.header_items || []"
        class="z-[9999]"
      />
    </div>

    <!-- Dock (Small mobile only) -->
    <div class="fixed bottom-0 left-0 right-0 z-[10000] block sm:hidden">
      <the-dock :pages="pages.filter((page) => includes(page.menus, 'dock'))" />
    </div>

    <!-- Global search command palette (Cmd+K) -->
    <TheSearchCommandPalette />
  </div>
</template>



<script setup>

import lodash from "lodash";
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useHeaderHeight } from '~/composables/useHeaderHeight.js'
const { includes } = lodash;
const { $directus, $readItems, $readSingleton } = useNuxtApp();
const { plausibleAnalyticsUrl, plausibleAnalyticsDomain } = useRuntimeConfig().public;
const route = useRoute();
const { closeDrawer, syncDrawerState } = useDrawer();
const hydrated = ref(false)
const isDesktop = ref(false)
const headerHeight = useHeaderHeight()
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
  const checkDesktop = () => window.innerWidth >= 640
  isDesktop.value = checkDesktop()
  
  // Media query for more reliable detection
  const mq = window.matchMedia('(min-width: 640px)')
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
