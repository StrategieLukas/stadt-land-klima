<template>
  <div class="flex flex-col min-h-screen text-neutral font-sans">

    <!-- Always render both headers, control visibility with Tailwind -->
    <div>
      <!-- Mobile Header -->
      <div class="block lg:hidden">
        <div class="drawer">
          <input id="page-drawer" type="checkbox" class="drawer-toggle" />
          <div class="drawer-content flex flex-col">
            <the-drawer-side-toggle />
            <the-header-mobile />
          </div>
          <the-drawer-side
            :pages="pages.filter((page) => includes(page.menus, 'main'))"
          />
        </div>
      </div>

      <!-- Desktop Header -->
      <div class="hidden lg:block">
        <the-header-desktop :pages="pages" />
      </div>
    </div>

    <!-- Main Content (always rendered) -->
    <main class="flex grow flex-col bg-white px-2 py-4">
      <div class="mx-auto w-full max-w-screen-xl flex flex-col">
        <slot />
      </div>
    </main>

    <!-- Footer (Mobile version) -->
     <div class="block lg:hidden">
        <the-footer-mobile
        :pages="pages.filter((page) => includes(page.menus, 'footer'))"
      />
     </div>

     <!-- Footer (Desktop version) -->
     <div class="hidden lg:block">
      <the-footer-desktop
        :pages="pages.filter((page) => includes(page.menus, 'footer'))"
      />
     </div>

  </div>
</template>



<script setup>

import lodash from "lodash";
import { watch } from "vue";

const { locale } = useI18n();
const { includes } = lodash;
const { $directus, $readItems, $appEnv, $plausibleAnalyticsUrl, $plausibleAnalyticsDomain } = useNuxtApp();

const fetchPages = async () => {
  return $directus.request(
    $readItems("pages", {
      sort: "sort_order",
      fields: ["*", "translations.*"],
      deep: {
        translations: {
          _filter: {
            languages_code: { _eq: locale.value },
          },
        },
      },
      limit: -1,
    }),
  );
};

const { data: pages } = await useAsyncData("pages", fetchPages);

watch(
  locale,
  async () => {
    pages.value = await fetchPages();
  },
  { immediate: false },
);
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
