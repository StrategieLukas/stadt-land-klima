<template>
  <nav class="drawer drawer-side z-40">
    <label for="page-drawer" class="drawer-overlay" @click="closeDrawer"></label>
    <div class="flex min-h-full w-80 flex-col overflow-y-auto bg-white text-left font-semibold">
      <!-- Search bar -->
      <div class="border-gray-100 border-b px-4 py-3">
        <button
          class="bg-gray-50 text-gray-400 hover:bg-gray-100 flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm transition-colors"
          @click="
            openSearch();
            closeDrawer();
          "
          :aria-label="$t('generic.search')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <span>{{ $t("generic.search") }}…</span>
        </button>
      </div>

      <!-- Nav items from navigation_config -->
      <ul v-if="safeNavItems.length > 0" class="flex-1 pb-6 pt-2">
        <li v-for="item in safeNavItems" :key="item.id">
          <!-- Item with children: split row — label navigates, chevron expands -->
          <template v-if="hasChildren(item)">
            <div
              class="border-gray-100 hover:bg-gray-50 flex w-full items-center justify-between border-b transition-colors"
              :class="{ 'bg-light-green/10': anyChildActive(item) }"
            >
              <!-- Label: navigates if the item has a link -->
              <component
                v-if="item.link_type === 'page'"
                :is="NuxtLink"
                :to="resolveHref(item)"
                class="flex min-w-0 flex-1 items-center gap-2 px-5 py-3 text-sm font-semibold"
                :class="
                  isActive(item) ? 'text-olive-green' : anyChildActive(item) ? 'text-olive-green' : 'text-gray-800'
                "
                @click="closeDrawer"
              >
                <img
                  v-if="item.image_id && imageUrlMap[item.image_id]"
                  :src="imageUrlMap[item.image_id]"
                  class="h-4 w-auto flex-shrink-0 object-contain"
                  alt=""
                />
                <span>{{ navLabel(item) }}</span>
              </component>
              <component
                v-else-if="item.link_type === 'external'"
                :is="'a'"
                :href="item.external_url"
                :target="item.open_new_tab ? '_blank' : '_self'"
                rel="noopener noreferrer"
                class="text-gray-800 flex min-w-0 flex-1 items-center gap-2 px-5 py-3 text-sm font-semibold"
                @click="closeDrawer"
              >
                <img
                  v-if="item.image_id && imageUrlMap[item.image_id]"
                  :src="imageUrlMap[item.image_id]"
                  class="h-4 w-auto flex-shrink-0 object-contain"
                  alt=""
                />
                <span>{{ navLabel(item) }}</span>
              </component>
              <span v-else class="text-gray-800 flex min-w-0 flex-1 items-center gap-2 px-5 py-3 text-sm font-semibold">
                <img
                  v-if="item.image_id && imageUrlMap[item.image_id]"
                  :src="imageUrlMap[item.image_id]"
                  class="h-4 w-auto flex-shrink-0 object-contain"
                  alt=""
                />
                {{ navLabel(item) }}
              </span>
              <!-- Chevron: toggles accordion only -->
              <button
                class="text-gray-400 hover:text-gray-600 flex h-full w-12 flex-shrink-0 items-center justify-center py-3 transition-colors"
                :aria-label="expandedId === item.id ? $t('generic.collapse') : $t('generic.expand')"
                @click="toggleExpanded(item.id)"
              >
                <svg
                  class="h-4 w-4 transition-transform duration-200"
                  :class="expandedId === item.id ? 'rotate-180' : ''"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <!-- Children -->
            <Transition
              @before-enter="accordionBeforeEnter"
              @enter="accordionEnter"
              @after-enter="accordionAfterEnter"
              @before-leave="accordionBeforeLeave"
              @leave="accordionLeave"
              @after-leave="accordionAfterLeave"
            >
              <div v-if="expandedId === item.id" class="border-gray-100 border-b">
                <!-- Image children: 2-column grid -->
                <div v-if="hasImageChildren(item)" class="grid grid-cols-2 gap-2 px-4 py-3">
                  <component
                    v-for="child in childrenWithImages(item)"
                    :key="child.id"
                    :is="child.link_type === 'page' ? NuxtLink : 'a'"
                    :to="child.link_type === 'page' ? resolveHref(child) : undefined"
                    :href="child.link_type === 'external' ? child.external_url : undefined"
                    :target="child.link_type === 'external' ? (child.open_new_tab ? '_blank' : '_self') : undefined"
                    :rel="child.link_type === 'external' ? 'noopener noreferrer' : undefined"
                    class="relative block h-20 overflow-hidden rounded-lg"
                    :class="{ 'ring-2 ring-olive-green': child.link_type === 'page' && isActive(child) }"
                    @click="closeDrawer"
                  >
                    <img :src="imageUrlMap[child.image_id]" class="h-full w-full object-cover" alt="" />
                    <div class="absolute inset-x-0 bottom-0 bg-stats-dark px-2 pb-1.5 pt-1.5">
                      <div class="text-xs font-semibold leading-snug text-white">{{ navLabel(child) }}</div>
                    </div>
                  </component>
                </div>

                <!-- Text-only children -->
                <template v-for="(child, index) in childrenWithoutImages(item)" :key="child.id">
                  <div v-if="index > 0" class="border-gray-100 ml-7 border-t"></div>
                  <component
                    :is="child.link_type === 'page' ? NuxtLink : 'a'"
                    :to="child.link_type === 'page' ? resolveHref(child) : undefined"
                    :href="child.link_type === 'external' ? child.external_url : undefined"
                    :target="child.link_type === 'external' ? (child.open_new_tab ? '_blank' : '_self') : undefined"
                    :rel="child.link_type === 'external' ? 'noopener noreferrer' : undefined"
                    class="flex flex-col px-7 py-2.5 text-sm transition-colors"
                    :class="{
                      'bg-light-green/10 text-olive-green': child.link_type === 'page' && isActive(child),
                      'text-gray-700 hover:bg-gray-50': !(child.link_type === 'page' && isActive(child)),
                    }"
                    @click="closeDrawer"
                  >
                    <span class="flex items-center gap-1.5 font-semibold leading-snug">
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
                      {{ navLabel(child) }}
                    </span>
                    <span v-if="child.description" class="text-gray-400 mt-0.5 text-xs font-normal leading-snug">{{
                      navDescription(child)
                    }}</span>
                  </component>
                </template>
              </div>
            </Transition>
          </template>

          <!-- Simple link -->
          <component
            v-else-if="item.link_type !== 'none'"
            :is="item.link_type === 'page' ? NuxtLink : 'a'"
            :to="item.link_type === 'page' ? resolveHref(item) : undefined"
            :href="item.link_type === 'external' ? item.external_url : undefined"
            :target="item.link_type === 'external' ? (item.open_new_tab ? '_blank' : '_self') : undefined"
            :rel="item.link_type === 'external' ? 'noopener noreferrer' : undefined"
            class="border-gray-100 flex w-full items-center gap-2 border-b px-5 py-3 text-sm font-semibold transition-colors"
            :class="{
              'bg-light-green/10 text-olive-green': item.link_type === 'page' && isActive(item),
              'text-gray-800 hover:bg-gray-50': !(item.link_type === 'page' && isActive(item)),
            }"
            @click="closeDrawer"
          >
            <img
              v-if="item.image_id && imageUrlMap[item.image_id]"
              :src="imageUrlMap[item.image_id]"
              class="h-4 w-auto flex-shrink-0 object-contain"
              alt=""
            />
            <svg
              v-if="item.link_type === 'external'"
              xmlns="http://www.w3.org/2000/svg"
              class="text-gray-500 h-3.5 w-3.5 flex-shrink-0"
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
            {{ navLabel(item) }}
          </component>

          <!-- Label-only (no link, no children) -->
          <span
            v-else
            class="text-gray-400 border-gray-100 flex w-full items-center gap-2 border-b px-5 py-3 text-sm font-semibold"
          >
            <img
              v-if="item.image_id && imageUrlMap[item.image_id]"
              :src="imageUrlMap[item.image_id]"
              class="h-4 w-auto flex-shrink-0 object-contain"
              alt=""
            />
            {{ navLabel(item) }}
          </span>
        </li>
      </ul>

      <!-- Fallback: flat pages list (when navItems is empty) -->
      <ul v-else class="flex-1 py-2">
        <li v-for="page in pages" :key="page.id">
          <NuxtLink
            :to="'/' + page.slug"
            class="text-gray-800 border-gray-100 hover:bg-gray-50 flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold transition-colors"
            @click="closeDrawer"
          >
            <span>→</span> {{ navLabel(page, "name") }}
          </NuxtLink>
        </li>
      </ul>

      <!-- Bottom: Login + Donate -->
      <div class="border-gray-100 flex gap-3 border-t px-4 pb-40 pt-5">
        <LoginButton class="flex-1" @click="closeDrawer" />
        <DonateButton class="flex-1" @click="closeDrawer" />
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, resolveComponent } from "vue";
import { useRuntimeConfig } from "#imports";
import { useSearchPalette } from "~/composables/useSearchPalette.js";
import translatedNavigationLabel from "~/shared/translatedNavigationLabel.js";

const NuxtLink = resolveComponent("NuxtLink");

const { $t } = useNuxtApp();
const route = useRoute();
const config = useRuntimeConfig();
const { closeDrawer } = useDrawer();
const { open: openSearch } = useSearchPalette();
const navLabel = (item, field = "label") => translatedNavigationLabel(item, $t, field);
const navDescription = (item) => translatedNavigationLabel(item, $t, "description");

const props = defineProps({
  pages: { type: Array, default: () => [] },
  navItems: { type: Array, default: () => [] },
});

const safeNavItems = computed(() => (Array.isArray(props.navItems) ? props.navItems : []));

// Accordion
const expandedId = ref(null);
function toggleExpanded(id) {
  expandedId.value = expandedId.value === id ? null : id;
}

// Accordion slide animation
function accordionBeforeEnter(el) {
  el.style.overflow = "hidden";
  el.style.maxHeight = "0";
}
function accordionEnter(el, done) {
  const height = el.scrollHeight;
  el.getBoundingClientRect(); // force reflow
  el.style.transition = "max-height 0.25s ease";
  el.style.maxHeight = height + "px";
  el.addEventListener("transitionend", done, { once: true });
}
function accordionAfterEnter(el) {
  el.style.transition = "";
  el.style.overflow = "";
  el.style.maxHeight = "";
}
function accordionBeforeLeave(el) {
  el.style.maxHeight = el.scrollHeight + "px";
  el.style.overflow = "hidden";
}
function accordionLeave(el, done) {
  el.getBoundingClientRect(); // force reflow
  el.style.transition = "max-height 0.25s ease";
  el.style.maxHeight = "0";
  el.addEventListener("transitionend", done, { once: true });
}
function accordionAfterLeave(el) {
  el.style.transition = "";
  el.style.overflow = "";
  el.style.maxHeight = "";
}

// Image URL resolution (same pattern as TheNavigationMenuDesktop)
const imageUrlMap = ref({});
onMounted(() => {
  const baseUrl = config.public.clientDirectusUrl;
  const allItems = [...safeNavItems.value];
  allItems.forEach((item) => {
    if (item.image_id) imageUrlMap.value[item.image_id] = `${baseUrl}/assets/${item.image_id}`;
    (item.children || []).forEach((child) => {
      if (child.image_id) imageUrlMap.value[child.image_id] = `${baseUrl}/assets/${child.image_id}`;
    });
  });
});

function resolveHref(item) {
  if (item.link_type === "page") {
    const slug = (item.page_slug ?? "").replace(/^\/+/, "");
    return slug === "" ? "/" : `/${slug}`;
  }
  return item.external_url || "#";
}

function isActive(item) {
  if (item.link_type !== "page") return false;
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
</script>
