<template>
  <!-- Bottom sheet: fixed above the dock, slides up via parent Transition -->
  <div
    class="fixed left-0 right-0 z-[9999] flex flex-col rounded-t-2xl bg-white shadow-2xl"
    style="bottom: 80px; max-height: 65vh; overflow: hidden"
    aria-modal="true"
    role="dialog"
  >
    <!-- Easter egg: pull-to-reveal SLK flower -->
    <div
      class="flex flex-shrink-0 items-center justify-center overflow-hidden"
      :style="{
        height: eggHeight + 'px',
        transition: isAnimatingBack ? 'height 0.4s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
      }"
    >
      <svg
        viewBox="-1 2 112 120"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        :style="{
          width: '80px',
          height: '80px',
          flexShrink: '0',
          transformOrigin: 'center',
          transform: `rotate(${flowerRotation}deg)`,
          transition: isAnimatingBack ? 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
        }"
      >
        <path
          fill-rule="evenodd"
          fill="#AFCA0B"
          d="M70.6,20.9c0-9.2-8-16.6-16.6-16.6s-16.6,7.4-16.6,16.6c0,1.7-0.4,3.6,2.1,10c1.4,3.5,14.5,26.6,14.5,26.6s13.1-23,14.5-26.6C71,24.5,70.6,22.7,70.6,20.9zM54,28.5c-3.9,0-7.1-3.2-7.1-7.3c0-4,3.2-7.3,7.1-7.3c3.9,0,7.1,3.2,7.1,7.3C61.1,25.2,57.9,28.5,54,28.5z"
        />
        <path
          fill-rule="evenodd"
          fill="#AFCA0B"
          d="M95.3,55.5c7.9-4.6,10.4-15.2,6.1-22.7s-14.8-10.7-22.7-6.1c-1.5,0.9-3.3,1.4-7.6,6.8c-2.3,2.9-15.7,25.9-15.7,25.9s26.5-0.1,30.3-0.7C92.4,57.7,93.8,56.4,95.3,55.5zM80.5,44.9c-2-3.4-0.8-7.8,2.7-9.8c3.5-2,7.9-0.9,9.9,2.6c2,3.4,0.8,7.8-2.7,9.8C86.9,49.5,82.5,48.3,80.5,44.9z"
        />
        <path
          fill-rule="evenodd"
          fill="#AFCA0B"
          d="M37.3,99.7c0,9.2,8,16.6,16.6,16.6s16.6-7.4,16.6-16.6c0-1.7,0.4-3.6-2.1-10c-1.4-3.5-14.5-26.6-14.5-26.6s-13.1,23-14.5,26.6C36.9,96.1,37.3,98,37.3,99.7zM53.9,92.2c3.9,0,7.1,3.2,7.1,7.3c0,4-3.2,7.3-7.1,7.3c-3.9,0-7.1-3.2-7.1-7.3C46.8,95.4,50,92.2,53.9,92.2z"
        />
        <path
          fill-rule="evenodd"
          fill="#AFCA0B"
          d="M29.2,26.7c-7.9-4.6-18.4-1.4-22.7,6.1s-1.9,18.1,6.1,22.7c1.5,0.9,2.9,2.2,9.7,3.2c3.7,0.5,30.3,0.7,30.3,0.7S39.2,36.5,36.8,33.5C32.5,28.1,30.7,27.6,29.2,26.7zM27.4,44.9c-2,3.4-6.4,4.6-9.9,2.6c-3.5-2-4.7-6.4-2.7-9.8c2-3.4,6.4-4.6,9.9-2.6C28.2,37,29.4,41.4,27.4,44.9z"
        />
        <path
          fill-rule="evenodd"
          fill="#AFCA0B"
          d="M12.6,65.2C4.6,69.7,2.2,80.4,6.5,87.9c4.3,7.5,14.8,10.7,22.7,6.1c1.5-0.9,3.3-1.4,7.6-6.8c2.3-2.9,15.7-25.9,15.7-25.9S26,61.4,22.2,62C15.5,63,14.1,64.3,12.6,65.2zM27.4,75.8c2,3.4,0.8,7.8-2.7,9.8c-3.5,2-7.9,0.9-9.9-2.6c-2-3.4-0.8-7.8,2.7-9.8C21,71.2,25.4,72.4,27.4,75.8z"
        />
      </svg>
    </div>

    <!-- Drag handle pill -->
    <div
      class="flex flex-shrink-0 cursor-grab touch-none select-none justify-center pb-1 pt-3"
      @touchstart="onEggDragStart"
      @touchmove.prevent="onEggDragMove"
      @touchend="onEggDragEnd"
      @touchcancel="onEggDragEnd"
    >
      <div class="bg-gray-300 h-1 w-10 rounded-full"></div>
    </div>

    <!-- Login, donate, and language selection -->
    <div class="flex flex-shrink-0 flex-col gap-3 px-4 pb-3 pt-2">
      <div class="flex gap-3">
        <LoginButton class="flex-1" @click="closeDrawer" />
        <DonateButton class="flex-1" @click="closeDrawer" />
      </div>
      <LanguageSelector variant="header" class="self-center" />
    </div>

    <!-- Divider -->
    <div class="border-gray-100 flex-shrink-0 border-t"></div>

    <!-- Scrollable nav items -->
    <div class="flex-1 overflow-y-auto overscroll-contain pb-4">
      <!-- Nav items from navigation_config -->
      <ul v-if="safeNavItems.length > 0" class="py-1">
        <li v-for="item in safeNavItems" :key="item.id">
          <!-- Item with children: split row — label navigates, chevron expands -->
          <template v-if="hasChildren(item)">
            <div
              class="border-gray-100 hover:bg-gray-50 flex w-full items-center justify-between border-b transition-colors"
              :class="{ 'bg-light-green/10': anyChildActive(item) }"
            >
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
              <!-- Chevron toggle -->
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
            <div v-show="expandedId === item.id" class="border-gray-100 border-b">
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
                  <div
                    class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4"
                  >
                    <div
                      class="text-xs font-semibold leading-snug text-white"
                      style="text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5)"
                    >
                      {{ navLabel(child) }}
                    </div>
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

      <!-- Fallback: flat pages list -->
      <ul v-else class="py-1">
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, resolveComponent } from "vue";
import { useRuntimeConfig } from "#imports";
import translatedNavigationLabel from "~/shared/translatedNavigationLabel.js";

const NuxtLink = resolveComponent("NuxtLink");

const { $t } = useNuxtApp();
const route = useRoute();
const config = useRuntimeConfig();
const { closeDrawer } = useDrawer();
const navLabel = (item, field = "label") => translatedNavigationLabel(item, $t, field);
const navDescription = (item) => translatedNavigationLabel(item, $t, "description");

// Easter egg: pull-to-reveal SLK flower
const eggHeight = ref(0);
const eggStartY = ref(0);
const isAnimatingBack = ref(false);
let eggHapticFired = false;
let eggResetTimer = null;

const flowerRotation = computed(() => eggHeight.value * 3);

function onEggDragStart(e) {
  if (eggResetTimer) {
    clearTimeout(eggResetTimer);
    eggResetTimer = null;
  }
  isAnimatingBack.value = false;
  eggStartY.value = e.touches[0].clientY;
  eggHapticFired = false;
}

function onEggDragMove(e) {
  const delta = e.touches[0].clientY - eggStartY.value;
  if (delta <= 0) {
    eggHeight.value = 0;
    return;
  }
  eggHeight.value = Math.min(delta, 160);
  if (!eggHapticFired && eggHeight.value >= 60) {
    eggHapticFired = true;
    if (navigator.vibrate) navigator.vibrate(10);
  }
}

function onEggDragEnd() {
  isAnimatingBack.value = true;
  eggHeight.value = 0;
  eggResetTimer = setTimeout(() => {
    isAnimatingBack.value = false;
    eggResetTimer = null;
  }, 420);
}

onBeforeUnmount(() => {
  if (eggResetTimer) clearTimeout(eggResetTimer);
});

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

// Image URL resolution
const imageUrlMap = ref({});
onMounted(() => {
  const baseUrl = config.public.clientDirectusUrl;
  safeNavItems.value.forEach((item) => {
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
