<!--
  BreadcrumbItem — a breadcrumb link with an optional sibling-area dropdown.

  Props:
    label        display text
    href         link target (when isCurrent=false, this is where clicking the label goes)
    isCurrent    true for the last (active) crumb — bold, no arrow
    siblingLevel administrative level of siblings to fetch (2 = Bundesländer, 4 = Kreise)
    arsPrefix    first N chars of ARS to scope sibling search (empty = fetch all at that level)
    currentArs   ARS of the currently-active area (highlighted in dropdown)
-->
<template>
  <div ref="container" class="relative">
    <!-- Label / toggle button -->
    <button
      type="button"
      class="flex items-center gap-0.5 transition-colors leading-none"
      :class="isCurrent
        ? 'font-semibold text-gray-800 cursor-default'
        : 'text-gray-500 hover:text-[#006e94]'"
      @click="toggle"
    >
      <NuxtLink
        v-if="!isCurrent && href"
        :to="href"
        class="hover:text-[#006e94] transition-colors"
        @click.stop
      >{{ label }}</NuxtLink>
      <span v-else>{{ label }}</span>
      <!-- Down-arrow shown for all non-current crumbs when dropdown is available -->
      <svg
        v-if="siblingLevel"
        class="w-2.5 h-2.5 opacity-40 ml-0.5 transition-transform duration-150"
        :class="open ? 'rotate-180' : ''"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown -->
    <div
      v-if="open"
      class="absolute top-full left-0 mt-1.5 z-[500] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden min-w-[180px] max-h-[60vh] overflow-y-auto"
    >
      <div v-if="loading" class="px-4 py-3 text-xs text-gray-400 animate-pulse">Wird geladen…</div>
      <template v-else>
        <NuxtLink
          v-for="sibling in siblings"
          :key="sibling.ars"
          :to="`/data/${toSlug(sibling.prefix, sibling.name)}`"
          class="flex items-baseline gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
          :class="sibling.ars === currentArs ? 'bg-[#006e94]/5 text-[#006e94] font-semibold' : 'text-gray-700'"
          @click="open = false"
        >
          <span class="text-gray-400 text-[10px] shrink-0">{{ sibling.prefix }}</span>
          <span>{{ sibling.name }}</span>
        </NuxtLink>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { areaToSlug } from '~/composables/useAreaBySlug.js'

const props = defineProps({
  label:       { type: String, required: true },
  href:        { type: String, default: null },
  isCurrent:   { type: Boolean, default: false },
  siblingLevel:{ type: Number, default: null },
  arsPrefix:   { type: String, default: '' },
  currentArs:  { type: String, default: null },
})

const toSlug = areaToSlug

const container = ref(null)
const open      = ref(false)
const loading   = ref(false)
const siblings  = ref([])

async function fetchSiblings() {
  if (siblings.value.length || !props.siblingLevel) return
  loading.value = true
  try {
    const params = new URLSearchParams({ level: String(props.siblingLevel) })
    if (props.arsPrefix) params.set('arsPrefix', props.arsPrefix)
    const data = await $fetch(`/api/area-children?${params}`)
    siblings.value = data ?? []
  } catch {
    siblings.value = []
  } finally {
    loading.value = false
  }
}

async function toggle() {
  if (!props.siblingLevel) return
  if (!open.value) {
    open.value = true
    await fetchSiblings()
  } else {
    open.value = false
  }
}

// Close on outside click
function onOutside(e) {
  if (container.value && !container.value.contains(e.target)) {
    open.value = false
  }
}
onMounted(() => document.addEventListener('click', onOutside, { passive: true }))
onBeforeUnmount(() => document.removeEventListener('click', onOutside))
</script>
