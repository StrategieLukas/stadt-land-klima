<template>
  <div class="dock dock-xl border-gray-200 flex items-center justify-around border-t bg-white text-black">
    <button
      v-for="page in pages"
      :key="page.id"
      :class="{ 'dock-active': isPageActive(page.slug) }"
      @click="
        followLink(page.slug);
        closeDrawer();
      "
      class="flex min-h-[48px] min-w-0 flex-col items-center justify-end py-3"
    >
      <div class="size-[3em]">
        <div v-html="page.icon_svg"></div>
      </div>
      <span class="dock-label max-w-full truncate text-center font-heading text-sm">{{ navLabel(page, "name") }}</span>
    </button>

    <button
      id="page-drawer-toggle"
      @click="toggleDrawer"
      :class="{ 'dock-active': isDrawerOpen }"
      class="flex min-h-[48px] min-w-0 flex-col items-center justify-end py-3"
    >
      <svg class="size-[3em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="dock-label max-w-full truncate text-center font-heading text-sm">{{ $t("generic.menu") }}</span>
    </button>
  </div>
</template>

<script setup>
import { defineProps } from "vue";
import translatedNavigationLabel from "~/shared/translatedNavigationLabel.js";
const { $t } = useNuxtApp();
const route = useRoute();
const props = defineProps(["pages"]);
const navLabel = (item, field = "label") => translatedNavigationLabel(item, $t, field);

// Use the shared drawer state
const { isDrawerOpen, toggleDrawer, closeDrawer } = useDrawer();

const isPageActive = (slug) => {
  const normalized = slug === "index" ? "" : slug;
  const path = normalized === "" ? "/" : `/${normalized}`;
  return route.path === path || route.path.startsWith(`${path}/`);
};

const followLink = (pageSlug) => {
  const nuxtApp = useNuxtApp();
  const path = !pageSlug || pageSlug === "index" ? "/" : "/" + pageSlug;
  nuxtApp.$router.push(path);
};
</script>

<style scoped>
.dock-active {
  color: #afca0b !important;
}

.dock-active svg {
  color: #afca0b !important;
}
</style>
