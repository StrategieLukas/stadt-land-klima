<template>
  <nav class="drawer drawer-side z-40">
    <label for="page-drawer" class="drawer-overlay" @click="closeDrawer"></label>
    <div class="flex flex-col min-h-full w-80 bg-white font-semibold text-left overflow-y-auto">

      <!-- Nav items from navigation_config -->
      <ul v-if="safeNavItems.length > 0" class="flex-1 py-2">
        <li v-for="item in safeNavItems" :key="item.id">
          <!-- Item with children: accordion trigger -->
          <template v-if="hasChildren(item)">
            <button
              class="flex items-center justify-between w-full px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
              :class="{ 'text-olive-green': anyChildActive(item) }"
              @click="toggleExpanded(item.id)"
            >
              <div class="flex items-center gap-2 min-w-0">
                <img v-if="item.image_id && imageUrlMap[item.image_id]" :src="imageUrlMap[item.image_id]" class="h-4 w-auto object-contain flex-shrink-0" alt="" />
                <span>{{ item.label }}</span>
              </div>
              <svg
                class="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200"
                :class="expandedId === item.id ? 'rotate-180' : ''"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Children -->
            <div v-show="expandedId === item.id" class="bg-gray-50 border-b border-gray-100">
              <!-- Image children: horizontal scroll strip -->
              <div v-if="hasImageChildren(item)" class="flex gap-2 px-4 py-3 overflow-x-auto">
                <component
                  v-for="child in childrenWithImages(item)"
                  :key="child.id"
                  :is="child.link_type === 'page' ? NuxtLink : 'a'"
                  :to="child.link_type === 'page' ? resolveHref(child) : undefined"
                  :href="child.link_type === 'external' ? child.external_url : undefined"
                  :target="child.link_type === 'external' ? (child.open_new_tab ? '_blank' : '_self') : undefined"
                  :rel="child.link_type === 'external' ? 'noopener noreferrer' : undefined"
                  class="relative w-28 h-20 rounded-lg overflow-hidden flex-shrink-0 block"
                  :class="{ 'ring-2 ring-olive-green': child.link_type === 'page' && isActive(child) }"
                  @click="closeDrawer"
                >
                  <img :src="imageUrlMap[child.image_id]" class="w-full h-full object-cover" alt="" />
                  <div class="absolute inset-x-0 bottom-0 pt-4 pb-1.5 px-2 bg-gradient-to-t from-black/70 to-transparent">
                    <div class="text-xs font-semibold text-white leading-snug" style="text-shadow: 0 1px 3px rgba(0,0,0,.5)">{{ child.label }}</div>
                  </div>
                </component>
              </div>

              <!-- Text-only children -->
              <component
                v-for="child in childrenWithoutImages(item)"
                :key="child.id"
                :is="child.link_type === 'page' ? NuxtLink : 'a'"
                :to="child.link_type === 'page' ? resolveHref(child) : undefined"
                :href="child.link_type === 'external' ? child.external_url : undefined"
                :target="child.link_type === 'external' ? (child.open_new_tab ? '_blank' : '_self') : undefined"
                :rel="child.link_type === 'external' ? 'noopener noreferrer' : undefined"
                class="flex flex-col px-7 py-2.5 text-sm border-b border-gray-100 last:border-b-0 transition-colors"
                :class="{
                  'text-olive-green bg-light-green/10': child.link_type === 'page' && isActive(child),
                  'text-gray-700 hover:bg-gray-100': !(child.link_type === 'page' && isActive(child)),
                }"
                @click="closeDrawer"
              >
                <span class="font-semibold leading-snug">{{ child.label }}</span>
                <span v-if="child.description" class="text-xs font-normal text-gray-400 mt-0.5 leading-snug">{{ child.description }}</span>
              </component>
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
            class="flex items-center gap-2 w-full px-5 py-3 text-sm font-semibold border-b border-gray-100 transition-colors"
            :class="{
              'text-olive-green bg-light-green/10': item.link_type === 'page' && isActive(item),
              'text-gray-800 hover:bg-gray-50': !(item.link_type === 'page' && isActive(item)),
            }"
            @click="closeDrawer"
          >
            <img v-if="item.image_id && imageUrlMap[item.image_id]" :src="imageUrlMap[item.image_id]" class="h-4 w-auto object-contain flex-shrink-0" alt="" />
            {{ item.label }}
          </component>

          <!-- Label-only (no link, no children) -->
          <span
            v-else
            class="flex items-center gap-2 w-full px-5 py-3 text-sm font-semibold text-gray-400 border-b border-gray-100"
          >
            <img v-if="item.image_id && imageUrlMap[item.image_id]" :src="imageUrlMap[item.image_id]" class="h-4 w-auto object-contain flex-shrink-0" alt="" />
            {{ item.label }}
          </span>
        </li>
      </ul>

      <!-- Fallback: flat pages list (when navItems is empty) -->
      <ul v-else class="flex-1 py-2">
        <li v-for="page in pages" :key="page.id">
          <NuxtLink
            :to="'/' + page.slug"
            class="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-gray-800 border-b border-gray-100 hover:bg-gray-50 transition-colors"
            @click="closeDrawer"
          >
            <span>→</span> {{ page.name }}
          </NuxtLink>
        </li>
      </ul>

      <!-- Bottom: Login + Donate -->
      <div class="border-t border-gray-100 pt-3 pb-[96px] space-y-1">
        <a
          href="/backend"
          class="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-orange hover:bg-orange/5 transition-colors"
          @click="closeDrawer"
        >
          <span>→</span> {{ $t('generic.log_in') }}
        </a>
        <a
          href="https://www.betterplace.org/de/projects/157241-stadt-land-klima-bringe-kommunalen-klimaschutz-voran"
          class="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-orange hover:bg-orange/5 transition-colors"
          @click="closeDrawer"
        >
          <span>→</span> {{ $t('donate.label') }}
          <img src="~/assets/icons/icon_hand_holding_heart.svg" class="h-4 w-auto" />
        </a>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, resolveComponent } from 'vue'
import { useRuntimeConfig } from '#imports'

const NuxtLink = resolveComponent('NuxtLink')

const { $t } = useNuxtApp()
const route = useRoute()
const config = useRuntimeConfig()
const { closeDrawer } = useDrawer()

const props = defineProps({
  pages: { type: Array, default: () => [] },
  navItems: { type: Array, default: () => [] },
})

const safeNavItems = computed(() => Array.isArray(props.navItems) ? props.navItems : [])

// Accordion
const expandedId = ref(null)
function toggleExpanded(id) {
  expandedId.value = expandedId.value === id ? null : id
}

// Image URL resolution (same pattern as TheNavigationMenuDesktop)
const imageUrlMap = ref({})
onMounted(() => {
  const baseUrl = config.public.clientDirectusUrl
  const allItems = [...safeNavItems.value]
  allItems.forEach(item => {
    if (item.image_id) imageUrlMap.value[item.image_id] = `${baseUrl}/assets/${item.image_id}`
    ;(item.children || []).forEach(child => {
      if (child.image_id) imageUrlMap.value[child.image_id] = `${baseUrl}/assets/${child.image_id}`
    })
  })
})

function resolveHref(item) {
  if (item.link_type === 'page') {
    const slug = (item.page_slug ?? '').replace(/^\/+/, '')
    return slug === '' ? '/' : `/${slug}`
  }
  return item.external_url || '#'
}

function isActive(item) {
  if (item.link_type !== 'page') return false
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
</script>
