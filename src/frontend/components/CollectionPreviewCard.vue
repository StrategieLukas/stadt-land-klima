<template>
  <div
    :data-collection-id="collection.id"
    class="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white"
  >
    <!-- Card header: sector color strip + title -->
    <div
      class="px-5 pt-4 pb-3 flex items-start justify-between gap-3"
      :style="`border-left: 4px solid ${sectorColor}`"
    >
      <div class="min-w-0">
        <span
          class="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide text-white mb-1.5"
          :style="`background: ${sectorColor}`"
        >{{ sectorDisplay }}</span>
        <h3 class="font-bold text-gray-900 text-base leading-snug">{{ t(collection.title) }}</h3>
        <p v-if="collectionDescription" class="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
          {{ collectionDescription }}
        </p>
      </div>
    </div>

    <!-- Step-0 preview: KPI + map -->
    <div class="px-5 pb-4">
      <div v-if="kpiEl0 || mapEl0" class="grid gap-4" :class="kpiEl0 && mapEl0 ? 'grid-cols-5' : 'grid-cols-1'">
        <!-- KPI column -->
        <div v-if="kpiEl0" :class="mapEl0 ? 'col-span-2' : 'col-span-1'">
          <KPICard
            :element="kpiEl0"
            :collection-slug="collection.id"
            :ars="ars"
            :base-url="baseUrl"
            :population="population"
          />
        </div>
        <!-- Map column -->
        <div v-if="mapEl0 && mapEl0.vegalite_spec" :class="kpiEl0 ? 'col-span-3' : 'col-span-1'" style="height: 280px">
          <ClientOnly>
            <VegaChart :spec="mapEl0.vegalite_spec" />
          </ClientOnly>
        </div>
      </div>
      <div
        v-else-if="step0Description"
        class="text-sm text-gray-600 leading-relaxed py-2"
      >
        {{ step0Description }}
      </div>
    </div>

    <!-- Expand / collapse toggle -->
    <div class="px-5 pb-4 flex items-center justify-between">
      <button
        v-if="!expanded"
        class="inline-flex items-center gap-1.5 text-sm text-[#006e94] font-medium hover:underline transition-colors"
        :disabled="expandLoading"
        @click="expand"
      >
        <template v-if="expandLoading">
          <SlkFlowerSpinner :size="14" />
          Wird geladen…
        </template>
        <template v-else>
          Alle {{ stepCount }} Schritte anzeigen
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </template>
      </button>
      <NuxtLink
        :to="`/data/${areaSlug}/${collection.id}`"
        class="text-xs text-gray-400 hover:text-[#006e94] transition-colors ml-auto"
      >
        Eigene Seite →
      </NuxtLink>
    </div>

    <!-- Expanded steps (all narrative steps) -->
    <div v-if="expanded" class="border-t border-gray-100">
      <div class="px-5">
        <JourneyStep
          v-for="step in renderSteps"
          :key="step.index"
          :step="step"
          :collection="collection"
          :ars="ars"
          :base-url="baseUrl"
          :population="population"
        />
      </div>
      <div class="px-5 pb-5 pt-2">
        <button
          class="inline-flex items-center gap-1.5 text-sm text-[#006e94] font-medium hover:underline"
          @click="expanded = false"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
          Weniger anzeigen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Collection } from '~/types/slz-api'
import { useSlzLocale } from '~/composables/useSlzLocale'
import { useCollectionRender } from '~/composables/useCollectionRender'
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
  ars: string
  baseUrl: string
  population?: number | null
}>()

const { t } = useSlzLocale()
const { steps: renderSteps, loading: expandLoading, loadFromRender } = useCollectionRender(props.baseUrl)

const expanded     = ref(false)
const stepsLoaded  = ref(false)

const sectorKey = computed(() => {
  const s = props.collection.sector
  if (!s) return 'other'
  return s.toLowerCase()
})

const sectorColor = computed(() =>
  SECTOR_COLORS[sectorKey.value] ?? SECTOR_COLORS.other
)

const sectorDisplay = computed(() => {
  const sl = props.collection.sector_label
  if (!sl) return props.collection.sector ?? ''
  if (typeof sl === 'string') return sl
  return t(sl as Record<string, string>)
})

const collectionDescription = computed(() =>
  props.collection.description?.['de-DE'] || props.collection.description?.['en-US'] || ''
)

const step0Elements = computed(() =>
  props.collection.render_elements.filter(e => (e.step ?? 0) === 0)
)

const kpiEl0 = computed(() =>
  step0Elements.value.find(e => e.type === 'kpi') ?? null
)

const mapEl0 = computed(() =>
  step0Elements.value.find(e => e.type === 'map' && e.vegalite_spec) ?? null
)

const step0Description = computed(() => {
  const step0 = props.collection.narrative_steps?.[0]
  return step0 ? t(step0.description) : ''
})

const stepCount = computed(() =>
  props.collection.narrative_steps?.length ?? 0
)

async function expand() {
  if (!stepsLoaded.value) {
    await loadFromRender(props.collection.id, props.ars)
    stepsLoaded.value = true
  }
  expanded.value = true
}
</script>
