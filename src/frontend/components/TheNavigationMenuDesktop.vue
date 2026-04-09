<template>
  <nav>
    <!-- Connected pill bar — real items are always rectangular; rounding lives in the end-caps only -->
    <ul class="flex items-stretch h-9 bg-gray-50 border border-gray-200 rounded-full">
      <!-- Left rounded end-cap: carries the l-full rounding, divider on right -->
      <li class="w-3 rounded-l-full border-r border-gray-200 flex-shrink-0"></li>
      <li
        v-for="item in safeItems"
        :key="item.id"
        class="relative flex items-stretch border-r border-gray-200"
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
          class="flex items-center gap-1.5 px-5 text-sm font-semibold whitespace-nowrap transition-colors"
          @click="closeMenu"
          :class="{
            'bg-olive-green text-white': item.link_type === 'page' && isActive(item),
            'text-gray-600 hover:bg-light-green/10 hover:text-gray-900': !(item.link_type === 'page' && isActive(item)),
          }"
        >
          <img v-if="item.image_id && imageUrlMap[item.image_id]" :src="imageUrlMap[item.image_id]" class="h-4 w-auto object-contain" alt="" />
          {{ item.label }}
        </component>

        <!-- Text-only label (no link, no children) -->
        <span
          v-else-if="!hasChildren(item) && item.link_type === 'none'"
          class="flex items-center gap-1.5 px-5 text-sm font-semibold text-gray-500 whitespace-nowrap"
        >
          <img v-if="item.image_id && imageUrlMap[item.image_id]" :src="imageUrlMap[item.image_id]" class="h-4 w-auto object-contain" alt="" />
          {{ item.label }}
        </span>

        <!-- Trigger with children — also navigates if item has a page slug -->
        <component
          v-else
          :is="item.link_type === 'page' && item.page_slug ? NuxtLink : 'div'"
          :to="item.link_type === 'page' && item.page_slug ? resolveHref(item) : undefined"
          class="flex items-center gap-1.5 px-5 text-sm font-semibold cursor-pointer whitespace-nowrap transition-colors"
          @click="item.link_type === 'page' && item.page_slug ? closeMenu() : undefined"
          :class="{
            'bg-olive-green text-white': anyChildActive(item),
            'text-gray-600 hover:bg-light-green/10 hover:text-gray-900': !anyChildActive(item),
          }"
        >
          <img v-if="item.image_id && imageUrlMap[item.image_id]" :src="imageUrlMap[item.image_id]" class="h-4 w-auto object-contain" alt="" />
          {{ item.label }}
          <svg class="h-3 w-3 opacity-50" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M1 1l5 5 5-5"/></svg>
        </component>

        <!-- Dropdown panel: directly touching the pill bar, hover managed by JS timer -->
        <div
          v-if="hasChildren(item)"
          v-show="openMenuId === item.id"
          class="absolute left-0 top-full bg-white rounded-b-xl shadow-xl z-50 border-t-2 border-t-light-green"
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
                class="relative h-32 rounded-lg overflow-hidden group/card block"
                @click="closeMenu"
                :class="{
                  'ring-2 ring-olive-green': child.link_type === 'page' && isActive(child),
                }"
              >
                <img :src="imageUrlMap[child.image_id]" class="w-full h-full object-cover transition-transform duration-200 group-hover/card:scale-105" alt="" />
                <!-- Gradient + label overlay -->
                <div class="absolute inset-x-0 bottom-0 pt-8 pb-2 px-2.5 bg-gradient-to-t from-black/70 to-transparent">
                  <div class="text-xs font-semibold text-white leading-snug" style="text-shadow: 0 1px 3px rgba(0,0,0,.5)">
                    {{ child.label }}
                  </div>
                  <div v-if="child.description" class="text-[10px] font-normal text-white/80 mt-0.5 leading-snug">{{ child.description }}</div>
                </div>
              </component>
            </div>

            <!-- Text-only children: vertical list, to the right of any image cards -->
            <div
              v-if="childrenWithoutImages(item).length > 0"
              class="flex flex-col min-w-[200px]"
              :class="{ 'border-l border-gray-100': hasImageChildren(item) }"
            >
              <component
                v-for="child in childrenWithoutImages(item)"
                :key="child.id"
                :is="child.link_type === 'page' ? NuxtLink : 'a'"
                :to="child.link_type === 'page' ? resolveHref(child) : undefined"
                :href="child.link_type === 'external' ? child.external_url : undefined"
                :target="child.link_type === 'external' ? (child.open_new_tab ? '_blank' : '_self') : undefined"
                :rel="child.link_type === 'external' ? 'noopener noreferrer' : undefined"
                class="flex items-start px-4 py-3 text-sm font-semibold border-b border-gray-50 last:border-b-0 transition-colors"
                @click="closeMenu"
                :class="{
                  'bg-light-green/20 text-olive-green': child.link_type === 'page' && isActive(child),
                  'text-gray-700 hover:bg-light-green/10 hover:text-gray-900': !(child.link_type === 'page' && isActive(child)),
                }"
              >
                <div class="min-w-0">
                  <div class="leading-snug">{{ child.label }}</div>
                  <div v-if="child.description" class="text-xs font-normal opacity-60 mt-0.5 leading-snug">{{ child.description }}</div>
                </div>
              </component>
            </div>
          </div>
        </div>
      </li>
      <!-- Right rounded end-cap -->
      <li class="w-3 rounded-r-full flex-shrink-0"></li>
    </ul>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, resolveComponent } from 'vue'
import { useRoute, useRuntimeConfig } from '#imports'

// Resolve NuxtLink once during setup — calling resolveComponent() in template ternaries
// does not work reliably in Nuxt 3 because the component registry may not be ready yet.
const NuxtLink = resolveComponent('NuxtLink')

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

const route = useRoute()
const config = useRuntimeConfig()

// Guard: prop default only fires for `undefined`, not `null`.
// Array.isArray also rejects any non-array truthy value (e.g. Directus Proxy objects).
const safeItems = computed(() => Array.isArray(props.items) ? props.items : [])

// Hover delay logic: 200ms grace period lets the mouse cross the small gap
// between the pill bar and the dropdown panel without dismissing it.
const openMenuId = ref(null)
let menuCloseTimer = null

function handleMenuEnter(id) {
  clearTimeout(menuCloseTimer)
  openMenuId.value = id
}

function handleMenuLeave() {
  menuCloseTimer = setTimeout(() => {
    openMenuId.value = null
  }, 200)
}

function closeMenu() {
  clearTimeout(menuCloseTimer)
  openMenuId.value = null
}

function resolveHref(item) {
  if (item.link_type === 'page') {
    const slug = (item.page_slug ?? '').replace(/^\/+/, '')
    return slug === '' ? '/' : `/${slug}`
  }
  return item.external_url || '#'
}

function isActive(item) {
  if (item.link_type !== 'page') return false
  // Strip leading/trailing slashes; an empty slug means no page is defined → never active
  const slug = (item.page_slug ?? '').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!slug) return false
  return route.path === `/${slug}` || route.path.startsWith(`/${slug}/`)
}

function hasChildren(item) {
  return Array.isArray(item.children) && item.children.length > 0
}

function anyChildActive(item) {
  return hasChildren(item) && item.children.some(child => isActive(child))
}

function hasImageChildren(item) {
  return (item.children || []).some(c => c.image_id)
}

function childrenWithImages(item) {
  return (item.children || []).filter(c => c.image_id)
}

function childrenWithoutImages(item) {
  return (item.children || []).filter(c => !c.image_id)
}

// Resolve image asset URLs for items that have image_id
const imageUrlMap = ref({})

onMounted(() => {
  const baseUrl = config.public.clientDirectusUrl || 'http://127.0.0.1:8081'
  const allItems = [
    ...safeItems.value,
    ...safeItems.value.flatMap(i => i.children || []),
  ]
  allItems.forEach(item => {
    if (item.image_id && !imageUrlMap.value[item.image_id]) {
      imageUrlMap.value[item.image_id] = `${baseUrl}/assets/${item.image_id}`
    }
  })
})
</script>
