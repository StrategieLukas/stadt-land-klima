<template>
  <NuxtLink
    :to="`/data/${areaSlug}/${collection.id}`"
    class="group flex-none w-64 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#006e94]/30 transition-all duration-200 overflow-hidden flex flex-col snap-start"
  >
    <!-- Cover image / placeholder -->
    <div class="relative h-32 bg-gray-100 overflow-hidden flex-none">
      <img
        v-if="collection.cover_image_url"
        :src="collection.cover_image_url"
        :alt="t(collection.title)"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center"
        :style="`background: linear-gradient(135deg, ${sectorColor}18, ${sectorColor}35)`"
      >
        <img
          v-if="sectorIcon"
          :src="sectorIcon"
          class="w-10 h-10 opacity-30"
          :alt="sectorLabel"
        />
        <div v-else class="w-10 h-10 rounded-full" :style="`background: ${sectorColor}25`" />
      </div>
      <!-- Sector badge -->
      <span
        v-if="sectorLabel"
        class="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide text-white"
        :style="`background: ${sectorColor}`"
      >{{ sectorLabel }}</span>
    </div>

    <!-- Text body -->
    <div class="flex flex-col flex-1 p-4 min-h-0">
      <h3 class="font-bold text-gray-900 text-sm leading-snug mb-1 line-clamp-2 group-hover:text-[#006e94] transition-colors">
        {{ t(collection.title) }}
      </h3>
      <p
        v-if="description"
        class="text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1"
      >{{ description }}</p>
    </div>

    <!-- Footer arrow -->
    <div class="flex items-center justify-end px-4 pb-3">
      <span class="text-xs text-[#006e94] font-medium group-hover:translate-x-0.5 transition-transform">
        Erkunden →
      </span>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Collection } from '~/types/slz-api'
import { useSlzLocale } from '~/composables/useSlzLocale'
import sectorImages from '~/shared/sectorImages.js'

const SECTOR_COLORS: Record<string, string> = {
  energy:      '#F59E0B',
  transport:   '#3B82F6',
  agriculture: '#10B981',
  management:  '#006e94',
  other:       '#6B7280',
}

const props = defineProps<{
  collection: Collection
  areaSlug: string
  sectorLabel?: string
  sectorKey?: string
}>()

const { t } = useSlzLocale()

const description = computed(() =>
  props.collection.description?.['de-DE'] || props.collection.description?.['en-US'] || ''
)

const sectorColor = computed(() =>
  SECTOR_COLORS[props.sectorKey ?? 'other'] ?? SECTOR_COLORS.other
)

const sectorIcon = computed(() =>
  props.sectorKey ? (sectorImages as Record<string, string>)[props.sectorKey] ?? null : null
)
</script>
