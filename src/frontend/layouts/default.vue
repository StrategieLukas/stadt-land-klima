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
            <the-header-desktop :pages="pages.filter((page) => includes(page.menus, 'main'))" :municipalities="publishedMunicipalities" />
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
      v-if="isDesktop"
      :pages="pages.filter((page) => includes(page.menus, 'main'))"
      class="z-[9999]"
    />

    <!-- Mobile Menu Modal (replaces drawer on mobile) -->
    <MobileMenuModal
      v-if="!isDesktop"
      :is-open="isMobileMenuOpen"
      :pages="pages.filter((page) => includes(page.menus, 'main'))"
      @close="closeMobileMenu"
    />

    <!-- Dock (Mobile version - always visible, sticky) -->
    <div class="fixed bottom-0 left-0 right-0 z-50 block lg:hidden z-[10000]">
      <the-dock :pages="pages.filter((page) => includes(page.menus, 'dock'))" />
    </div>

  </div>
</template>



<script setup>

import lodash from "lodash";
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
const { includes } = lodash;
const { $directus, $readItems, $plausibleAnalyticsUrl, $plausibleAnalyticsDomain } = useNuxtApp();
const route = useRoute();
const { closeDrawer, syncDrawerState, isDrawerOpen } = useDrawer();

const hydrated = ref(false)
const isDesktop = ref(false)
const drawerToggle = ref(null)
let cleanup = null

// Mobile menu state (for modal-based mobile menu)
const isMobileMenuOpen = computed(() => !isDesktop.value && isDrawerOpen.value)
const closeMobileMenu = () => {
  closeDrawer()
}

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
    $plausibleAnalyticsUrl && $plausibleAnalyticsDomain
      ? {
          defer: true,
          "data-domain": $plausibleAnalyticsDomain,
          src: $plausibleAnalyticsUrl + "/js/script.js",
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
