<template>
  <nav class="flex justify-center h-full">
    <ul class="flex h-full z-50">
      <li
        v-for="item in items"
        :key="item.id"
        class="relative h-full group"
      >
        <!-- Simple link (no children) -->
        <component
          v-if="!hasChildren(item) && item.link_type !== 'none'"
          :is="item.link_type === 'page' ? resolveComponent('NuxtLink') : 'a'"
          :to="item.link_type === 'page' ? resolveHref(item) : undefined"
          :href="item.link_type === 'external' ? item.external_url : undefined"
          :target="item.link_type === 'external' ? (item.open_new_tab ? '_blank' : '_self') : undefined"
          :rel="item.link_type === 'external' ? 'noopener noreferrer' : undefined"
          class="flex items-center justify-center gap-2 px-6 text-white font-bold h-full transition-colors"
          :class="{
            'bg-light-green': item.link_type === 'page' && isActive(item),
            'hover:bg-gray': !isActive(item),
          }"
        >
          <img v-if="item.image_id && imageUrlMap[item.image_id]" :src="imageUrlMap[item.image_id]" class="h-5 w-auto object-contain" alt="" />
          {{ item.label }}
        </component>

        <!-- Text-only label (no link, no children) -->
        <span
          v-else-if="!hasChildren(item) && item.link_type === 'none'"
          class="flex items-center justify-center gap-2 px-6 text-white font-bold h-full"
        >
          <img v-if="item.image_id && imageUrlMap[item.image_id]" :src="imageUrlMap[item.image_id]" class="h-5 w-auto object-contain" alt="" />
          {{ item.label }}
        </span>

        <!-- Trigger with children -->
        <div
          v-else
          class="flex items-center justify-center gap-2 px-6 text-white font-bold h-full cursor-pointer transition-colors"
          :class="{
            'bg-light-green': anyChildActive(item),
            'hover:bg-gray': !anyChildActive(item),
          }"
        >
          <img v-if="item.image_id && imageUrlMap[item.image_id]" :src="imageUrlMap[item.image_id]" class="h-5 w-auto object-contain" alt="" />
          {{ item.label }}
          <svg class="h-3 w-3 opacity-70" viewBox="0 0 12 8" fill="currentColor"><path d="M1 1l5 5 5-5"/></svg>
        </div>

        <!-- Dropdown panel -->
        <div
          v-if="hasChildren(item)"
          class="absolute left-0 top-full min-w-[220px] bg-white shadow-lg hidden group-hover:block z-50 border-t-2 border-light-green"
        >
          <component
            v-for="child in item.children"
            :key="child.id"
            :is="child.link_type === 'page' ? resolveComponent('NuxtLink') : 'a'"
            :to="child.link_type === 'page' ? resolveHref(child) : undefined"
            :href="child.link_type === 'external' ? child.external_url : undefined"
            :target="child.link_type === 'external' ? (child.open_new_tab ? '_blank' : '_self') : undefined"
            :rel="child.link_type === 'external' ? 'noopener noreferrer' : undefined"
            class="flex items-start gap-3 px-4 py-3 font-bold border-b border-gray-100 last:border-b-0 transition-colors"
            :class="{
              'bg-light-green text-white hover:bg-olive-green': child.link_type === 'page' && isActive(child),
              'bg-mid-gray text-white hover:bg-gray': !(child.link_type === 'page' && isActive(child)),
            }"
          >
            <img v-if="child.image_id && imageUrlMap[child.image_id]" :src="imageUrlMap[child.image_id]" class="h-6 w-6 object-contain flex-shrink-0 mt-0.5" alt="" />
            <div class="min-w-0">
              <div class="text-sm leading-snug">{{ child.label }}</div>
              <div v-if="child.description" class="text-xs font-normal opacity-80 mt-0.5 leading-snug">{{ child.description }}</div>
            </div>
          </component>
        </div>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { computed, ref, onMounted, resolveComponent } from 'vue'
import { useRoute, useRuntimeConfig } from '#imports'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

const route = useRoute()
const config = useRuntimeConfig()

function resolveHref(item) {
  if (item.link_type === 'page') return `/${item.page_slug}`
  return item.external_url || '#'
}

function isActive(item) {
  if (item.link_type !== 'page') return false
  const fullPath = `/${item.page_slug}`
  return route.path === fullPath || route.path.startsWith(fullPath + '/')
}

function hasChildren(item) {
  return Array.isArray(item.children) && item.children.length > 0
}

function anyChildActive(item) {
  return hasChildren(item) && item.children.some(child => isActive(child))
}

// Resolve image asset URLs for items that have image_id
const imageUrlMap = ref({})

onMounted(() => {
  const baseUrl = config.public.clientDirectusUrl || 'http://127.0.0.1:8081'
  const allItems = [
    ...props.items,
    ...props.items.flatMap(i => i.children || []),
  ]
  allItems.forEach(item => {
    if (item.image_id && !imageUrlMap.value[item.image_id]) {
      imageUrlMap.value[item.image_id] = `${baseUrl}/assets/${item.image_id}`
    }
  })
})
</script>
