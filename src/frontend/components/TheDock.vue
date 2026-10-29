<template>
  <div class="slk-dock flex items-center justify-around border-t">
    <button
      v-for="page in navigationPages"
      :key="page.id"
      :class="{ 'slk-dock-active': isPageActive(page.slug) }"
      :aria-current="isPageActive(page.slug) ? 'page' : undefined"
      class="flex min-h-[48px] min-w-0 flex-col items-center justify-end py-3"
      @click="
        followLink(page.slug);
        closeDrawer();
      "
    >
      <div class="size-[3em]" aria-hidden="true">
        <!-- eslint-disable-next-line vue/no-v-html -- navigationPages sanitizes CMS icons through sanitizeSvg. -->
        <div class="h-full w-full [&_svg]:h-full [&_svg]:w-full" v-html="page.icon_svg"></div>
      </div>
      <span class="slk-dock-label max-w-full truncate text-center font-heading text-sm">{{
        navLabel(page, "name")
      }}</span>
    </button>

    <button
      id="page-drawer-toggle"
      :class="{ 'slk-dock-active': isDrawerOpen }"
      class="flex min-h-[48px] min-w-0 flex-col items-center justify-end py-3"
      @click="toggleDrawer"
    >
      <svg class="size-[3em]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="slk-dock-label max-w-full truncate text-center font-heading text-sm">{{ $t("generic.menu") }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { NavigationPage } from "~/types/components/navigation";
import { defineProps, computed } from "vue";
import translatedNavigationLabel from "~/shared/translatedNavigationLabel";
import { sanitizeSvg } from "~/utils/sanitizeHtml";

const { $translateDynamic, $t } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const _props = defineProps<{ pages?: NavigationPage[] | undefined }>();
const navLabel = (item: NavigationPage, field: "name" | "label" = "label") =>
  translatedNavigationLabel(item, $translateDynamic, field);

const sanitizedPages = computed(() => {
  if (!_props.pages) return [];
  return _props.pages.map((page) => ({
    ...page,
    icon_svg: sanitizeSvg(page.icon_svg),
  }));
});

const navigationPages = computed(() => sanitizedPages.value);

// Use the shared drawer state
const { isDrawerOpen, toggleDrawer, closeDrawer } = useDrawer();

const isPageActive = (slug: string) => {
  const normalized = slug === "index" ? "" : slug;
  const path = normalized === "" ? "/" : `/${normalized}`;
  return route.path === path || route.path.startsWith(`${path}/`);
};

const followLink = (pageSlug: string) => {
  const path = !pageSlug || pageSlug === "index" ? "/" : "/" + pageSlug;
  void router.push(path);
};
</script>

<style scoped>
.slk-dock {
  background-color: var(--slk-surface);
  border-color: var(--slk-border);
  color: var(--slk-text-strong);
}

.slk-dock-active {
  color: var(--slk-accent-green);
}

/* CMS SVGs can carry fixed paint attributes; preserve unpainted geometry. */
.slk-dock :deep(svg:not([fill])) {
  fill: currentColor;
}

.slk-dock :deep([fill]:not([fill="none"]):not([fill="transparent"])) {
  fill: currentColor;
}

.slk-dock :deep([stroke]:not([stroke="none"]):not([stroke="transparent"])) {
  stroke: currentColor;
}
</style>
