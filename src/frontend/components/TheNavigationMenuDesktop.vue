<template>
  <nav ref="navRef">
    <!-- Connected pill bar — real items are always rectangular; rounding lives in the end-caps only -->
    <ul class="bg-gray-50 border-gray-200 flex h-9 items-stretch rounded-full border">
      <!-- Left rounded end-cap: carries the l-full rounding, divider on right -->
      <li class="border-gray-200 w-3 flex-shrink-0 rounded-l-full border-r"></li>
      <li
        v-for="item in safeItems"
        :key="item.id"
        class="border-gray-200 relative flex items-stretch border-r"
        @mouseenter="hasChildren(item) && handleMenuEnter(item.id)"
        @mouseleave="hasChildren(item) && handleMenuLeave()"
      >
        <!-- Simple link (no children) -->
        <component
          v-if="!hasChildren(item) && item.link_type !== 'none'"
          :is="item.link_type === 'page' ? NuxtLink : 'a'"
          :to="item.link_type === 'page' ? resolveHref(item) : undefined"
          :href="item.link_type === 'external' ? item.external_url : undefined"
          :target="item.link_type === 'external' ? (item.open_new_tab ? '_blank' : '_self') : undefined"
          :rel="item.link_type === 'external' ? 'noopener noreferrer' : undefined"
          class="flex items-center gap-1.5 whitespace-nowrap px-3 text-sm font-semibold transition-colors"
          @click="closeMenu"
          :title="item.label"
          :class="{
            'bg-olive-green text-white': item.link_type === 'page' && isActive(item),
            'text-gray-600 hover:text-gray-900 hover:bg-light-green/10': !(item.link_type === 'page' && isActive(item)),
          }"
        >
          <img
            v-if="item.image_id && imageUrlMap[item.image_id]"
            :src="imageUrlMap[item.image_id]"
            class="h-5 w-auto object-contain"
            :alt="item.label"
          />
          <template v-else>
            <svg
              v-if="item.link_type === 'external'"
              xmlns="http://www.w3.org/2000/svg"
              class="text-gray-500 h-3 w-3 flex-shrink-0"
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
            <span class="text-xs font-semibold">{{ item.label }}</span>
          </template>
          <span v-if="item.image_id && imageUrlMap[item.image_id]" class="sr-only">{{ item.label }}</span>
        </component>

        <!-- Text-only label (no link, no children) -->
        <span
          v-else-if="!hasChildren(item) && item.link_type === 'none'"
          class="text-gray-500 flex items-center gap-1.5 whitespace-nowrap px-3 text-sm font-semibold"
          :title="item.label"
        >
          <img
            v-if="item.image_id && imageUrlMap[item.image_id]"
            :src="imageUrlMap[item.image_id]"
            class="h-5 w-auto object-contain"
            :alt="item.label"
          />
          <span v-else class="text-xs">{{ item.label }}</span>
          <span v-if="item.image_id && imageUrlMap[item.image_id]" class="sr-only">{{ item.label }}</span>
        </span>

        <!-- Trigger with children — also navigates if item has a page slug -->
        <!-- Wrapper owns the hover background so it spans both label and chevron -->
        <div
          v-if="hasChildren(item)"
          class="group/trigger flex items-stretch transition-colors"
          :class="{
            'bg-olive-green': anyChildActive(item),
            'hover:bg-light-green/10': !anyChildActive(item),
          }"
        >
          <!-- Label part: navigates (NuxtLink) or toggles dropdown (button) -->
          <component
            :is="item.link_type === 'page' && item.page_slug ? NuxtLink : 'button'"
            :to="item.link_type === 'page' && item.page_slug ? resolveHref(item) : undefined"
            :type="!(item.link_type === 'page' && item.page_slug) ? 'button' : undefined"
            class="flex cursor-pointer items-center gap-1.5 whitespace-nowrap pl-3 pr-1 text-sm font-semibold transition-colors"
            @click="item.link_type === 'page' && item.page_slug ? closeMenu() : toggleMenu(item.id)"
            :title="item.label"
            :class="{
              'text-white': anyChildActive(item),
              'text-gray-600 group-hover/trigger:text-gray-900': !anyChildActive(item),
            }"
          >
            <img
              v-if="item.image_id && imageUrlMap[item.image_id]"
              :src="imageUrlMap[item.image_id]"
              class="h-5 w-auto object-contain"
              :alt="item.label"
            />
            <span v-else class="text-xs font-semibold">{{ item.label }}</span>
            <span v-if="item.image_id && imageUrlMap[item.image_id]" class="sr-only">{{ item.label }}</span>
          </component>
          <!-- Chevron button: toggles dropdown on click/touch -->
          <button
            type="button"
            class="flex cursor-pointer items-center pl-0.5 pr-3 transition-colors"
            :class="{
              'text-white hover:text-white/80': anyChildActive(item),
              'text-gray-600 group-hover/trigger:text-gray-900': !anyChildActive(item),
            }"
            @click.stop="toggleMenu(item.id)"
            :aria-expanded="openMenuId === item.id"
            :aria-label="item.label + ' Untermenü'"
          >
            <svg class="h-3 w-3 opacity-50" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M1 1l5 5 5-5" />
            </svg>
          </button>
        </div>

        <!-- Dropdown panel: directly touching the pill bar, hover managed by JS timer -->
        <div
          v-if="hasChildren(item)"
          v-show="openMenuId === item.id"
          class="absolute left-0 top-full z-50 rounded-b-xl border-t-2 border-t-light-green bg-white shadow-xl"
          @mouseenter="handleMenuEnter(item.id)"
          @mouseleave="handleMenuLeave()"
        >
          <div class="flex">
            <!-- Image children: large cards side-by-side -->
            <div v-if="hasImageChildren(item)" class="grid grid-cols-[160px_160px] gap-2 p-3">
              <component
                v-for="child in childrenWithImages(item)"
                :key="child.id"
                :is="child.link_type === 'page' ? NuxtLink : 'a'"
                :to="child.link_type === 'page' ? resolveHref(child) : undefined"
                :href="child.link_type === 'external' ? child.external_url : undefined"
                :target="child.link_type === 'external' ? (child.open_new_tab ? '_blank' : '_self') : undefined"
                :rel="child.link_type === 'external' ? 'noopener noreferrer' : undefined"
                class="group/card relative block h-32 overflow-hidden rounded-lg"
                @click="closeMenu"
                :class="{
                  'ring-2 ring-olive-green': child.link_type === 'page' && isActive(child),
                }"
              >
                <img
                  :src="imageUrlMap[child.image_id]"
                  class="h-full w-full object-cover transition-transform duration-200 group-hover/card:scale-105"
                  alt=""
                />
                <!-- Label overlay -->
                <div class="absolute inset-x-0 bottom-0 bg-stats-dark px-2.5 pb-2 pt-2">
                  <div class="text-xs font-semibold leading-snug text-white">
                    {{ child.label }}
                  </div>
                  <div v-if="child.description" class="mt-0.5 text-[10px] font-normal leading-snug text-white">
                    {{ child.description }}
                  </div>
                </div>
              </component>
            </div>

            <!-- Text-only children: vertical list, to the right of any image cards -->
            <div
              v-if="childrenWithoutImages(item).length > 0"
              class="flex min-w-[200px] flex-col"
              :class="{ 'border-gray-100 border-l': hasImageChildren(item) }"
            >
              <component
                v-for="child in childrenWithoutImages(item)"
                :key="child.id"
                :is="child.link_type === 'page' ? NuxtLink : 'a'"
                :to="child.link_type === 'page' ? resolveHref(child) : undefined"
                :href="child.link_type === 'external' ? child.external_url : undefined"
                :target="child.link_type === 'external' ? (child.open_new_tab ? '_blank' : '_self') : undefined"
                :rel="child.link_type === 'external' ? 'noopener noreferrer' : undefined"
                class="border-gray-50 flex items-start border-b px-4 py-3 text-sm font-semibold transition-colors last:border-b-0"
                @click="closeMenu"
                :class="{
                  'bg-light-green/20 text-olive-green': child.link_type === 'page' && isActive(child),
                  'text-gray-700 hover:text-gray-900 hover:bg-light-green/10': !(
                    child.link_type === 'page' && isActive(child)
                  ),
                }"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 leading-snug">
                    <svg
                      v-if="child.link_type === 'external'"
                      xmlns="http://www.w3.org/2000/svg"
                      class="text-gray-500 h-3 w-3 flex-shrink-0"
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
                    {{ child.label }}
                  </div>
                  <div v-if="child.description" class="mt-0.5 text-xs font-normal leading-snug opacity-60">
                    {{ child.description }}
                  </div>
                </div>
              </component>
            </div>
          </div>
        </div>
      </li>
      <!-- Right rounded end-cap -->
      <li class="w-3 flex-shrink-0 rounded-r-full"></li>
    </ul>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, resolveComponent } from "vue";
import { useRoute, useRuntimeConfig } from "#imports";

// Resolve NuxtLink once during setup — calling resolveComponent() in template ternaries
// does not work reliably in Nuxt 3 because the component registry may not be ready yet.
const NuxtLink = resolveComponent("NuxtLink");

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});

const route = useRoute();
const config = useRuntimeConfig();

// Guard: prop default only fires for `undefined`, not `null`.
// Array.isArray also rejects any non-array truthy value (e.g. Directus Proxy objects).
const safeItems = computed(() => (Array.isArray(props.items) ? props.items : []));

// Hover delay logic: 200ms grace period lets the mouse cross the small gap
// between the pill bar and the dropdown panel without dismissing it.
const navRef = ref(null);
const openMenuId = ref(null);
let menuCloseTimer = null;

function handleMenuEnter(id) {
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

function toggleMenu(id) {
  clearTimeout(menuCloseTimer);
  openMenuId.value = openMenuId.value === id ? null : id;
}

function handleOutsideClick(event) {
  if (navRef.value && !navRef.value.contains(event.target)) {
    closeMenu();
  }
}

function resolveHref(item) {
  if (item.link_type === "page") {
    const slug = (item.page_slug ?? "").replace(/^\/+/, "");
    return slug === "" ? "/" : `/${slug}`;
  }
  return item.external_url || "#";
}

function isActive(item) {
  if (item.link_type !== "page") return false;
  // Strip leading/trailing slashes; an empty slug means no page is defined → never active
  const slug = (item.page_slug ?? "").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!slug) return false;
  return route.path === `/${slug}` || route.path.startsWith(`/${slug}/`);
}

function hasChildren(item) {
  return Array.isArray(item.children) && item.children.length > 0;
}

function anyChildActive(item) {
  return hasChildren(item) && item.children.some((child) => isActive(child));
}

function hasImageChildren(item) {
  return (item.children || []).some((c) => c.image_id);
}

function childrenWithImages(item) {
  return (item.children || []).filter((c) => c.image_id);
}

function childrenWithoutImages(item) {
  return (item.children || []).filter((c) => !c.image_id);
}

// Resolve image asset URLs for items that have image_id
const imageUrlMap = ref({});

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
