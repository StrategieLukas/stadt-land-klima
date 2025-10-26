<template>
  <div class="drawer">
    <!-- Drawer Toggle Checkbox (Hidden) -->
    <input id="page-drawer" type="checkbox" class="drawer-toggle" />

    <!-- Drawer Content (Main Page Content) -->
    <div class="drawer-content flex flex-col min-h-screen text-neutral font-sans">
      <!-- Always render both headers, control visibility with Tailwind -->
      <div>
        <!-- Mobile Header -->
        <div class="block lg:hidden">
          <the-header-mobile
            :pages="pages.filter((page) => includes(page.menus, 'main'))"
          />
        </div>

        <!-- Desktop Header -->
        <div class="hidden lg:block">
          <the-header-desktop
            :pages="pages.filter((page) => includes(page.menus, 'main'))"
          />
        </div>
      </div>

      <!-- Main Content (always rendered) -->
      <main class="flex grow flex-col px-2 py-4 bg-mild-white">
        <div class="mx-auto w-full max-w-screen-xl flex flex-col">
          <slot />
        </div>
      </main>

      <!-- Footer (Mobile version) -->
      <div class="block lg:hidden bg-mild-white">
        <the-footer-mobile
          :pages="pages.filter((page) => includes(page.menus, 'footer'))"
        />
        <div class="h-[48px]"></div> <!-- Spacer to accommodate the dock height -->
      </div>

      <!-- Footer (Desktop version) -->
      <div class="hidden lg:block bg-mild-white">
        <the-footer-desktop
          :pages="pages.filter((page) => includes(page.menus, 'footer'))"
        />
      </div>
    </div>

    <!-- Drawer Side (Menu) -->
    <the-drawer-side
      :pages="pages.filter((page) => includes(page.menus, 'main'))"
    />

    <!-- Dock (Mobile version - always visible, sticky) -->
    <div class="fixed bottom-0 left-0 right-0 z-[2000] block lg:hidden">
      <the-dock :pages="pages.filter((page) => includes(page.menus, 'dock'))" />
    </div>
  </div>
</template>



<script setup>

import lodash from "lodash";
const { includes } = lodash;
const { $directus, $readItems, $appEnv, $plausibleAnalyticsUrl, $plausibleAnalyticsDomain } = useNuxtApp();

const { data: pages } = await useAsyncData("pages", () => {
  return $directus.request($readItems("pages", { sort: "sort_order", limit: -1 }));
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
