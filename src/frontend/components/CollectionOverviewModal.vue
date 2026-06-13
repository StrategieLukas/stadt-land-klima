<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-[100] bg-black/40 flex flex-col justify-end"
      @click.self="$emit('close')"
    >
      <!-- Sheet -->
      <div
        class="bg-white rounded-t-2xl flex flex-col overflow-hidden"
        style="max-height: 92vh"
      >
        <!-- Sticky header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-none">
          <h2 class="font-bold text-gray-900 text-base">Alle Datensätze</h2>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Schließen"
            @click="$emit('close')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Sector filter chips -->
        <div class="flex items-center gap-2 px-5 py-3 overflow-x-auto no-scrollbar flex-none border-b border-gray-100">
          <button
            class="flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
            :class="activeFilter === null ? 'bg-[#006e94] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="activeFilter = null"
          >
            Alle ({{ collections.length }})
          </button>
          <button
            v-for="sector in availableSectors"
            :key="sector.key"
            class="flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
            :class="activeFilter === sector.key ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            :style="activeFilter === sector.key ? `background: ${sector.color}` : ''"
            @click="activeFilter = sector.key"
          >
            {{ sector.label }} ({{ sector.count }})
          </button>
        </div>

        <!-- Scrollable grid -->
        <div class="overflow-y-auto flex-1 px-4 py-4">
          <template v-for="sector in sectorsToShow" :key="sector.key">
            <h3
              class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-4 first:mt-0"
            >
              {{ sector.label }}
            </h3>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-2">
              <button
                v-for="col in sector.collections"
                :key="col.id"
                class="text-left bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#006e94]/30 transition-all overflow-hidden"
                @click="selectCollection(col.id)"
              >
                <!-- Cover image -->
                <div class="relative h-24 bg-gray-100 overflow-hidden">
                  <img
                    v-if="col.cover_image_url"
                    :src="col.cover_image_url"
                    :alt="t(col.title)"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full"
                    :style="`background: linear-gradient(135deg, ${SECTOR_COLORS[col.sector?.toLowerCase() ?? 'other'] ?? SECTOR_COLORS.other}18, ${SECTOR_COLORS[col.sector?.toLowerCase() ?? 'other'] ?? SECTOR_COLORS.other}35)`"
                  />
                  <span
                    class="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide text-white"
                    :style="`background: ${SECTOR_COLORS[col.sector?.toLowerCase() ?? 'other'] ?? SECTOR_COLORS.other}`"
                  >
                    {{ sector.label }}
                  </span>
                </div>
                <!-- Title -->
                <div class="p-3">
                  <p class="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">
                    {{ t(col.title) }}
                  </p>
                </div>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { Collection } from '~/types/slz-api'
import { useSlzLocale } from '~/composables/useSlzLocale'

const SECTOR_COLORS: Record<string, string> = {
  energy:      '#F59E0B',
  transport:   '#3B82F6',
  agriculture: '#10B981',
  management:  '#006e94',
  other:       '#6B7280',
}

const props = defineProps<{
  collections: Collection[]
  areaSlug: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', collectionId: string): void
}>()

const { t } = useSlzLocale()
const activeFilter = ref<string | null>(null)

function sectorKey(col: Collection) {
  return col.sector?.toLowerCase() ?? 'other'
}

function sectorLabel(col: Collection) {
  const sl = col.sector_label
  if (!sl) return col.sector ?? ''
  if (typeof sl === 'string') return sl
  return t(sl as Record<string, string>)
}

// Build unique sector list (ordered by appearance)
const availableSectors = computed(() => {
  const seen = new Map<string, { key: string; label: string; color: string; count: number }>()
  for (const col of props.collections) {
    const key = sectorKey(col)
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        label: sectorLabel(col),
        color: SECTOR_COLORS[key] ?? SECTOR_COLORS.other,
        count: 0,
      })
    }
    seen.get(key)!.count++
  }
  return [...seen.values()]
})

const sectorsToShow = computed(() => {
  const filtered = activeFilter.value
    ? availableSectors.value.filter(s => s.key === activeFilter.value)
    : availableSectors.value

  return filtered.map(s => ({
    ...s,
    collections: props.collections.filter(c => sectorKey(c) === s.key),
  }))
})

function selectCollection(id: string) {
  emit('select', id)
  emit('close')
}

// Body scroll lock
onMounted(() => { document.body.style.overflow = 'hidden' })
onBeforeUnmount(() => { document.body.style.overflow = '' })
</script>
