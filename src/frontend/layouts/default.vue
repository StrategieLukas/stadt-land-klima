<template>
  <div class="flex">
    <div class="bg-gray-200 drawer text-neutral">
      <input id="page-drawer" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content flex h-full min-h-screen flex-col items-stretch">
        <the-drawer-side-toggle></the-drawer-side-toggle>
        <the-header></the-header>
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
      <the-drawer-side
        :pages="
          pages.filter((page) => {
            return includes(page.menus, 'main');
          })
        "
      ></the-drawer-side>
    </div>
  </div>
</template>
<script setup>
import lodash from "lodash";
import WavingBanner from "~/components/WavingBanner.vue";
const { includes } = lodash;
const { $directus, $readItems, $appEnv } = useNuxtApp();

const { data: pages } = await useAsyncData("pages", () => {
  return $directus.request($readItems("pages", { limit: -1 }));
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
