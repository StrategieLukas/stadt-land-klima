<template>
  <div class="flex flex-col min-h-screen text-neutral">
    
    <template v-if="isMobile === null">
      <!-- Show nothing until client knows window size -->
    </template>

    <template v-else-if="isMobile">
      <!-- Mobile Layout -->
      <div class="drawer">
        <input id="page-drawer" type="checkbox" class="drawer-toggle" />
        <div class="drawer-content flex flex-col min-h-screen">
          <the-drawer-side-toggle />
          <the-header-mobile />
          <main class="flex grow flex-col bg-white px-2 py-4">
            <div class="mx-auto w-full max-w-screen-xl">
              <slot />
            </div>
          </main>
          <the-footer
            :pages="pages.filter((page) => includes(page.menus, 'footer'))"
          />
        </div>
        <the-drawer-side
          :pages="pages.filter((page) => includes(page.menus, 'main'))"
        />
      </div>
    </template>

    <template v-else>
      <!-- Desktop Layout -->
      <the-header-desktop :pages="pages" />
      <main class="flex grow flex-col bg-white px-2 py-4">
        <div class="mx-auto w-full max-w-screen-xl">
          <slot />
        </div>
      </main>
      <the-footer
        :pages="pages.filter((page) => includes(page.menus, 'footer'))"
      />
    </template>

  </div>
</template>



<script setup>

// Determine if we are in a mobile or desktop design
import { ref, computed, onMounted, onUnmounted } from 'vue';

const windowWidth = ref(null); // <- null initially

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(() => {
  updateWindowWidth();
  window.addEventListener('resize', updateWindowWidth);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth);
});

const isMobile = computed(() => {
  if (windowWidth.value === null || windowWidth.value === 0) return null; // no decision yet
  return windowWidth.value < 1024;
});


// Rest of logic
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
