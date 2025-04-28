<template>
  <div class="flex">
    <div class="bg-gray-200 text-neutral w-full">
      <input id="page-drawer" type="checkbox" class="drawer-toggle hidden" />
      <div class="flex min-h-screen flex-col items-stretch">

        <!-- Mobile Header -->
        <div class="block lg:hidden">
          <the-drawer-side-toggle/>
          <the-header-mobile />
        </div>

        <!-- Desktop Header -->
        <div class="hidden lg:block">
          <the-header-desktop :pages="pages" />
        </div>

        <main class="flex grow flex-col bg-white px-2 py-4">
          <div class="mx-auto w-full max-w-screen-xl">
            <slot />
          </div>
        </main>

        <the-footer
          :pages="
            pages.filter((page) => {
              return includes(page.menus, 'footer');
            })
          "
        />

      </div>

      <!-- Drawer Side: Only for Mobile -->
      <div class="lg:hidden">
        <the-drawer-side
          :pages="
            pages.filter((page) => {
              return includes(page.menus, 'main');
            })
          "
        />
      </div>

    </div>
  </div>
</template>


<script setup>

import lodash from "lodash";
const { includes } = lodash;
const { $directus, $readItems, $appEnv } = useNuxtApp();

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
    $appEnv === "production"
      ? {
          defer: true,
          "data-domain": "stadt-land-klima.de",
          src: "https://plausible.anzui.dev/js/script.js",
        }
      : {},
  ],
});
//
</script>
