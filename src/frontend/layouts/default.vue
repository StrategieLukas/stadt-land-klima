<template>
  <div class="drawer">
    <!-- Drawer Toggle Checkbox (Hidden) -->
    <input id="page-drawer" type="checkbox" class="drawer-toggle" />

    <div class="drawer-content flex flex-col min-h-screen text-neutral font-sans">
    <!-- Only render the appropriate header based on the viewport -->
    <div>
      <div v-if="hydrated">
        <!-- Desktop Header -->
        <div v-if="isDesktop">
          <the-header-desktop :pages="pages.filter((page) => includes(page.menus, 'main'))" :municipalities="publishedMunicipalities" />
        </div>

        <!-- Mobile Header -->
        <div v-else>
          <div class="drawer">
            <input id="page-drawer" type="checkbox" class="drawer-toggle" />
            <div class="drawer-content flex flex-col">
              <the-drawer-side-toggle />
              <the-header-mobile :municipalities="publishedMunicipalities" />
            </div>
            <the-drawer-side
              :pages="pages.filter((page) => includes(page.menus, 'main'))"
            />
          </div>
        </div>
      </div>
      <div v-else>
        <!-- blank space to keep layout stable for hydration -->
      </div>
    </div>

      <!-- Main Content (always rendered) -->
      <main class="flex grow flex-col px-2 py-4 bg-mild-white">
        <div class="mx-auto w-full max-w-screen-xl flex flex-col">
          <slot />
        </div>
      </main>


    <div v-if="hydrated">
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


    <!-- Drawer Side (Menu) -->
    <the-drawer-side
      :pages="pages.filter((page) => includes(page.menus, 'main'))"
    />

    <!-- Dock (Mobile version - always visible, sticky) -->
    <div class="fixed bottom-0 left-0 right-0 z-50 block lg:hidden">
      <the-dock :pages="pages.filter((page) => includes(page.menus, 'dock'))" />
    </div>

  </div>
</template>



<script setup>

import lodash from "lodash";
import { ref, onMounted } from 'vue'
const { includes } = lodash;
const { $directus, $readItems, $plausibleAnalyticsUrl, $plausibleAnalyticsDomain } = useNuxtApp();

const hydrated = ref(false)
const isDesktop = ref(false)

onMounted(() => {
  hydrated.value = true
  const mq = window.matchMedia('(min-width: 1024px)')
  const update = () => (isDesktop.value = mq.matches)
  mq.addEventListener('change', update)
  update()
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
