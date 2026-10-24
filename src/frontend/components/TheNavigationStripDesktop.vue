<template>
  <nav
    ref="navRef"
    class="border-t border-gray-200 bg-gray-50 dark:border-(--slk-border) dark:bg-(--slk-surface-subdued)"
  >
    <ul class="mx-auto flex w-full max-w-(--breakpoint-xl) flex-wrap items-stretch justify-center px-2">
      <li
        v-for="item in safeItems"
        :key="item.id"
        class="relative flex min-h-10 items-stretch whitespace-nowrap"
        @mouseenter="hasChildren(item) && handleMenuEnter(item.id)"
        @mouseleave="hasChildren(item) && handleMenuLeave()"
      >
        <!-- Simple link (no children) -->
        <component
          :is="item.link_type === 'page' ? NuxtLink : 'a'"
          v-if="!hasChildren(item) && item.link_type !== 'none'"
          :to="item.link_type === 'page' ? resolveHref(item) : undefined"
          :href="item.link_type === 'external' ? item.external_url : undefined"
          :target="item.link_type === 'external' ? (item.open_new_tab ? '_blank' : '_self') : undefined"
          :rel="item.link_type === 'external' ? 'noopener noreferrer' : undefined"
          class="nav-item nav-px flex items-center text-sm font-semibold text-gray-600 dark:text-(--slk-text)"
          :class="{ 'nav-item--active': item.link_type === 'page' && isActive(item) }"
          @click="closeMenu"
        >
          <span>{{ navLabel(item) }}</span>
        </component>

        <!-- Text-only label (no link, no children) -->
        <span
          v-else-if="!hasChildren(item) && item.link_type === 'none'"
          class="nav-px flex items-center text-sm font-semibold text-gray-400 dark:text-(--slk-text-subtle)"
        >
          <span>{{ navLabel(item) }}</span>
        </span>

        <!-- Trigger with children -->
        <!-- Wrapper owns the hover background so it spans both label and chevron -->
        <div
          v-if="hasChildren(item)"
          class="group/trigger nav-item flex items-stretch"
          :class="{ 'nav-item--active': isActive(item) || anyChildActive(item) || openMenuId === item.id }"
        >
          <!-- Label part: navigates (NuxtLink) or toggles dropdown (button) -->
          <component
            :is="item.link_type === 'page' && item.page_slug ? NuxtLink : 'button'"
            :to="item.link_type === 'page' && item.page_slug ? resolveHref(item) : undefined"
            :type="!(item.link_type === 'page' && item.page_slug) ? 'button' : undefined"
            class="nav-pl flex cursor-pointer items-center pr-1 text-sm font-semibold text-gray-600 group-hover/trigger:text-gray-900 dark:text-(--slk-text) dark:group-hover/trigger:text-(--slk-text-strong)"
            @click="item.link_type === 'page' && item.page_slug ? closeMenu() : toggleMenu(item.id)"
          >
            <span>{{ navLabel(item) }}</span>
          </component>
          <!-- Chevron button: toggles dropdown on click/touch -->
          <button
            type="button"
            class="nav-pr flex cursor-pointer items-center pl-1 text-gray-600 group-hover/trigger:text-olive-green dark:text-(--slk-text) dark:group-hover/trigger:text-(--slk-olive-green)"
            :aria-expanded="openMenuId === item.id"
            :aria-label="$t('navigation.submenu_for', { ':label': navLabel(item) })"
            @click.stop="toggleMenu(item.id)"
          >
            <svg
              class="h-3 w-3 shrink-0 opacity-60"
              viewBox="0 0 12 8"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M1 1l5 5 5-5" />
            </svg>
          </button>
        </div>

        <!-- Dropdown panel -->
        <div
          v-if="hasChildren(item)"
          v-show="openMenuId === item.id"
          class="absolute top-full left-0 z-10001 overflow-hidden rounded-b-xl border border-t-2 border-gray-200 border-t-light-green bg-white shadow-lg dark:border-(--slk-border) dark:bg-(--slk-surface) dark:shadow-[0_8px_24px_var(--slk-shadow-color)]"
          @mouseenter="handleMenuEnter(item.id)"
          @mouseleave="handleMenuLeave()"
        >
          <div class="flex">
            <!-- Image children: large cards side-by-side -->
            <div v-if="hasImageChildren(item)" class="grid grid-cols-[160px_160px] gap-2 p-3">
              <component
                :is="child.link_type === 'page' ? NuxtLink : 'a'"
                v-for="child in childrenWithImages(item)"
                :key="child.id"
                :to="child.link_type === 'page' ? resolveHref(child) : undefined"
                :href="child.link_type === 'external' ? child.external_url : undefined"
                :target="child.link_type === 'external' ? (child.open_new_tab ? '_blank' : '_self') : undefined"
                :rel="child.link_type === 'external' ? 'noopener noreferrer' : undefined"
                class="group/card relative block h-32 overflow-hidden rounded-lg"
                @click="closeMenu"
              >
                <img
                  :src="imageUrlMap[child.image_id ?? '']"
                  class="h-full w-full object-cover transition-transform duration-200 group-hover/card:scale-105"
                  alt=""
                />
                <div
                  class="slk-nav-image-overlay absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2.5 pt-8 pb-2"
                >
                  <div
                    class="text-xs leading-snug font-semibold text-white"
                    style="text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5)"
                  >
                    {{ navLabel(child) }}
                  </div>
                  <div
                    v-if="child.description"
                    class="mt-0.5 text-[10px] leading-snug font-normal text-white"
                    style="text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5)"
                  >
                    {{ navDescription(child) }}
                  </div>
                </div>
              </component>
            </div>

            <!-- Text-only children: vertical list -->
            <div
              v-if="childrenWithoutImages(item).length > 0"
              class="flex min-w-[200px] flex-col"
              :class="{ 'border-l border-gray-100 dark:border-(--slk-border)': hasImageChildren(item) }"
            >
              <component
                :is="child.link_type === 'page' ? NuxtLink : 'a'"
                v-for="child in childrenWithoutImages(item)"
                :key="child.id"
                :to="child.link_type === 'page' ? resolveHref(child) : undefined"
                :href="child.link_type === 'external' ? child.external_url : undefined"
                :target="child.link_type === 'external' ? (child.open_new_tab ? '_blank' : '_self') : undefined"
                :rel="child.link_type === 'external' ? 'noopener noreferrer' : undefined"
                class="flex items-start border-b border-gray-50 px-4 py-3 text-sm font-semibold transition-colors last:border-b-0 dark:border-(--slk-border)"
                :class="{
                  'bg-solid-light-green-20 text-olive-green dark:bg-(--slk-green-tint) dark:text-(--slk-olive-green)':
                    child.link_type === 'page' && isActive(child),
                  'text-gray-700 hover:bg-solid-light-green-10 hover:text-gray-900 dark:text-(--slk-text-muted) dark:hover:bg-(--slk-surface-muted) dark:hover:text-(--slk-text-strong)':
                    !(child.link_type === 'page' && isActive(child)),
                }"
                @click="closeMenu"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 leading-snug">
                    <svg
                      v-if="child.link_type === 'external'"
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3 w-3 shrink-0 text-gray-500 dark:text-(--slk-text-muted)"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    {{ navLabel(child) }}
                  </div>
                  <div v-if="child.description" class="mt-0.5 text-xs leading-snug font-normal opacity-60">
                    {{ navDescription(child) }}
                  </div>
                </div>
              </component>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { NavigationItem } from "~/types/components/navigation";

import { ref, computed, onMounted, onUnmounted, resolveComponent } from "vue";
import { useRoute, useRuntimeConfig } from "#imports";
import translatedNavigationLabel from "~/shared/translatedNavigationLabel";

const NuxtLink = resolveComponent("NuxtLink");
const { $translateDynamic, $t } = useNuxtApp();

const props = defineProps({
  items: {
    type: Array as PropType<NavigationItem[] | undefined>,
    default: () => [],
  },
});

const route = useRoute();
const config = useRuntimeConfig();
const navLabel = (item: NavigationItem) => translatedNavigationLabel(item, $translateDynamic);
const navDescription = (item: NavigationItem) => translatedNavigationLabel(item, $translateDynamic, "description");

const safeItems = computed(() => (Array.isArray(props.items) ? props.items : []));

const navRef = ref<HTMLElement | null>(null);
const openMenuId = ref<string | number | null>(null);
let menuCloseTimer: ReturnType<typeof setTimeout> | undefined;

function handleMenuEnter(id: string | number) {
  clearTimeout(menuCloseTimer);
  openMenuId.value = id;
}

function handleMenuLeave() {
  menuCloseTimer = setTimeout(() => {
    openMenuId.value = null;
  }, 200);
}

function closeMenu() {
  clearTimeout(menuCloseTimer);
  openMenuId.value = null;
}

function toggleMenu(id: string | number) {
  clearTimeout(menuCloseTimer);
  openMenuId.value = openMenuId.value === id ? null : id;
}

function handleOutsideClick(event: MouseEvent) {
  if (!(event.target instanceof Node)) return;
  if (navRef.value && !navRef.value.contains(event.target)) {
    closeMenu();
  }
}

function resolveHref(item: NavigationItem) {
  if (item.link_type === "page") {
    const slug = (item.page_slug ?? "").replace(/^\/+/, "");
    return slug === "" ? "/" : `/${slug}`;
  }
  return item.external_url || "#";
}

function isActive(item: NavigationItem) {
  if (item.link_type !== "page") return false;
  const slug = (item.page_slug ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!slug) return false;
  return route.path === `/${slug}` || route.path.startsWith(`/${slug}/`);
}

function hasChildren(item: NavigationItem) {
  return Array.isArray(item.children) && item.children.length > 0;
}

function anyChildActive(item: NavigationItem) {
  return hasChildren(item) && (item.children ?? []).some((child) => isActive(child));
}

function hasImageChildren(item: NavigationItem) {
  return (item.children || []).some((c) => c.image_id);
}

function childrenWithImages(item: NavigationItem) {
  return (item.children || []).filter((c) => c.image_id);
}

function childrenWithoutImages(item: NavigationItem) {
  return (item.children || []).filter((c) => !c.image_id);
}

const imageUrlMap = ref<Record<string, string>>({});

onMounted(() => {
  const baseUrl = config.public.clientDirectusUrl || "http://127.0.0.1:8081";
  const allItems = [...safeItems.value, ...safeItems.value.flatMap((i) => i.children || [])];
  allItems.forEach((item) => {
    if (item.image_id && !imageUrlMap.value[item.image_id]) {
      imageUrlMap.value[item.image_id] = `${baseUrl}/assets/${item.image_id}`;
    }
  });
  document.addEventListener("click", handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener("click", handleOutsideClick);
});
</script>

<style scoped>
/* Responsive horizontal padding — tightens as the viewport narrows */
.nav-px {
  padding-left: 1rem;
  padding-right: 1rem;
}
@media (max-width: 1024px) {
  .nav-px {
    padding-left: 0.625rem;
    padding-right: 0.625rem;
  }
}
@media (max-width: 800px) {
  .nav-px {
    padding-left: 0.375rem;
    padding-right: 0.375rem;
  }
}

/* Split padding for label (nav-pl) and chevron button (nav-pr) */
.nav-pl {
  padding-left: 1rem;
}
.nav-pr {
  padding-right: 1rem;
}
@media (max-width: 1024px) {
  .nav-pl {
    padding-left: 0.625rem;
  }
  .nav-pr {
    padding-right: 0.625rem;
  }
}
@media (max-width: 800px) {
  .nav-pl {
    padding-left: 0.375rem;
  }
  .nav-pr {
    padding-right: 0.375rem;
  }
}

.nav-item {
  white-space: nowrap;
}
.nav-item {
  transition:
    background 150ms ease,
    color 150ms ease;
  border-bottom: 2px solid var(--slk-surface-subdued);
}
.nav-item:hover {
  background: var(--slk-green-tint);
  color: var(--slk-olive-green);
  border-bottom-color: var(--slk-accent-green);
}
.nav-item--active {
  background: var(--slk-green-tint);
  color: var(--slk-olive-green);
  border-bottom-color: var(--slk-accent-green);
}
.nav-item--active:hover {
  background: var(--slk-surface-muted);
}
</style>
