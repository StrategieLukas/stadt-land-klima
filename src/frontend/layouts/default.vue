<template>
  <!-- Root is a plain block div — nothing here has overflow/transform/will-change
       so the header's sticky top-0 resolves against the viewport scroll container. -->
  <div class="flex min-h-screen flex-col font-sans text-neutral">
    <!-- ── Header: lives ABOVE the DaisyUI drawer so sticky always works ── -->
    <!-- Desktop header: rendered immediately in SSR (isDesktop defaults to true via useState).
         This eliminates the post-hydration lag where main content appeared before the nav bar.
         Mobile header: client-only, appears after hydration (mobile users see a brief swap,
         but desktop users — the majority — get instant, SSR-rendered navigation). -->
    <the-header-desktop
      v-if="!hydrated || isDesktop"
      :pages="pages ? pages.filter((page) => includes(page.menus, 'main')) : []"
      :municipalities="publishedMunicipalities || []"
      :nav-items="navigationConfig?.header_items || []"
    />
    <the-header-mobile v-if="hydrated && !isDesktop" />
    <!-- Spacer that reserves the height of the fixed header.
         Split into two CSS-driven divs so the correct height is applied even
         pre-hydration, when isDesktop JS defaults to true on every device. -->
    <!-- Mobile (<sm): always 64px via CSS only -->
    <div class="h-16 flex-shrink-0 sm:hidden"></div>
    <!-- Desktop (≥sm): JS-driven height, hidden on mobile via CSS -->
    <div class="hidden flex-shrink-0 sm:block" :style="`height: ${headerSpacerHeight}px`"></div>

    <!-- ── DaisyUI drawer: wraps sidebar + main content only (no header) ── -->
    <div class="drawer flex-1">
      <input id="page-drawer" type="checkbox" class="drawer-toggle" ref="drawerToggle" />

      <div
        class="drawer-content flex min-w-0 flex-col font-sans text-neutral"
        style="overflow-x: clip"
        @click="closeDrawerOnOutsideClick"
      >
        <!-- Main Content -->
        <main class="flex min-w-0 grow flex-col bg-mild-white px-2">
          <div class="mx-auto flex w-full min-w-0 max-w-screen-xl flex-col">
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

      <!-- Drawer Side (Menu) — desktop only; mobile uses TheMenuSheet below -->
      <the-drawer-side
        v-if="isDesktop"
        :pages="pages.filter((page) => includes(page.menus, 'main'))"
        :nav-items="navigationConfig?.header_items || []"
        class="z-[9999]"
      />
    </div>

    <!-- Dock (Small mobile only) -->
    <div class="fixed bottom-0 left-0 right-0 z-[10000] block sm:hidden">
      <the-dock :pages="pages.filter((page) => includes(page.menus, 'dock'))" />
    </div>

    <!-- Mobile: backdrop blur (below sticky header, above page content) -->
    <Transition name="slk-fade">
      <div
        v-if="!isDesktop && hydrated && isDrawerOpen"
        class="slk-modal-backdrop fixed inset-0 z-[49] sm:hidden"
        @click="closeDrawer"
      />
    </Transition>

    <!-- Mobile: bottom sheet navigation -->
    <Transition name="slk-sheet">
      <TheMenuSheet
        v-if="!isDesktop && hydrated && isDrawerOpen"
        :pages="pages.filter((page) => includes(page.menus, 'main'))"
        :nav-items="navigationConfig?.header_items || []"
      />
    </Transition>

    <!-- Global search command palette (Cmd+K) -->
    <TheSearchCommandPalette />
  </div>
</template>

<script setup>
import lodash from "lodash";
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useHeaderHeight, useHeaderSpacerHeight } from "~/composables/useHeaderHeight.js";
const { includes } = lodash;
const { $directus, $locale, $readItems, $readSingleton } = useNuxtApp();
const { plausibleAnalyticsUrl, plausibleAnalyticsDomain } = useRuntimeConfig().public;
const route = useRoute();
const { isDrawerOpen, closeDrawer, syncDrawerState } = useDrawer();
const hydrated = ref(false);
// useState (not ref) so server and client share the same initial value → no hydration
// mismatch. Default true = render the desktop header in SSR so it's in the HTML
// immediately, eliminating the post-hydration nav-bar lag for desktop users.
const isDesktop = useState("layout-isDesktop", () => true);
const headerHeight = useHeaderHeight();
const headerSpacerHeight = useHeaderSpacerHeight();
const drawerToggle = ref(null);
let cleanup = null;

// Close drawer when clicking outside
const closeDrawerOnOutsideClick = (event) => {
  // Only close if drawer is open and click is not on drawer toggle button
  if (drawerToggle.value && drawerToggle.value.checked) {
    const drawerSide = document.querySelector(".drawer-side");
    const drawerToggleButton = document.querySelector('label[for="page-drawer"]');

    // Check if click is outside drawer and not on toggle button
    if (
      drawerSide &&
      !drawerSide.contains(event.target) &&
      (!drawerToggleButton || !drawerToggleButton.contains(event.target))
    ) {
      closeDrawer();
    }
  }
};

// Handle escape key
const handleEscapeKey = (event) => {
  if (event.key === "Escape" && drawerToggle.value && drawerToggle.value.checked) {
    closeDrawer();
  }
};

onMounted(() => {
  hydrated.value = true;

  // Initial desktop state detection
  const checkDesktop = () => window.innerWidth >= 640;
  isDesktop.value = checkDesktop();

  // Media query for more reliable detection
  const mq = window.matchMedia("(min-width: 640px)");
  const update = () => {
    const wasDesktop = isDesktop.value;
    isDesktop.value = mq.matches;

    // If desktop state changed, force layout recalculation
    if (wasDesktop !== isDesktop.value) {
      nextTick(() => {
        window.dispatchEvent(new Event("resize"));
        // Force reflow
        document.body.offsetHeight;
      });
    }
  };

  // Listen to both media query changes and resize events
  mq.addEventListener("change", update);
  window.addEventListener("resize", update);

  // Add escape key listener
  document.addEventListener("keydown", handleEscapeKey);

  // Monitor drawer checkbox changes to sync state
  const drawerCheckbox = document.getElementById("page-drawer");
  if (drawerCheckbox) {
    drawerCheckbox.addEventListener("change", syncDrawerState);
  }

  // Initial update
  update();

  // Store cleanup function
  cleanup = () => {
    mq.removeEventListener("change", update);
    window.removeEventListener("resize", update);
    document.removeEventListener("keydown", handleEscapeKey);
    if (drawerCheckbox) {
      drawerCheckbox.removeEventListener("change", syncDrawerState);
    }
  };
});

onUnmounted(() => {
  if (cleanup) cleanup();
});

// getCachedData: serve from SSR payload on client-side navigations instead of
// re-fetching Directus on every page change. These datasets change rarely.
const cachedPayload = (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key];

const { data: pages } = await useAsyncData(
  "pages",
  () => $directus.request($readItems("pages", { sort: "sort_order", limit: -1 })),
  { getCachedData: cachedPayload },
);

const { data: publishedMunicipalities } = await useAsyncData(
  "municipalities",
  () =>
    $directus.request(
      $readItems("municipalities", {
        fields: ["slug", "name"],
        sort: "name",
        filter: { status: { _eq: "published" } },
        limit: -1,
      }),
    ),
  { getCachedData: cachedPayload },
);

const { data: navigationConfig } = await useAsyncData(
  "navigation_config",
  () => $directus.request($readSingleton("navigation_config")).catch(() => null),
  { getCachedData: cachedPayload },
);

//MetaTags
const description = ref("Stadt.Land.Klima!  Description");
useHead({
  htmlAttrs: {
    lang: $locale,
  },
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

/* Mobile menu sheet slide-up transition */
.slk-sheet-enter-active,
.slk-sheet-leave-active {
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
.slk-sheet-enter-from,
.slk-sheet-leave-to {
  transform: translateY(100%);
}
.slk-sheet-enter-to,
.slk-sheet-leave-from {
  transform: translateY(0);
}

/* Mobile backdrop fade transition */
.slk-fade-enter-active,
.slk-fade-leave-active {
  transition: opacity 200ms ease;
}
.slk-fade-enter-from,
.slk-fade-leave-to {
  opacity: 0;
}
</style>
