<template>
  <div class="bg-gray-50 rounded-xl p-4 flex flex-col justify-center gap-1 min-h-[140px]">
    <template v-if="loading">
      <div class="h-10 w-24 bg-gray-200 rounded animate-pulse" />
      <div class="h-3 w-16 bg-gray-200 rounded animate-pulse mt-1" />
    </template>
    <template v-else>
      <div
        class="text-4xl font-black tabular-nums leading-none"
        :style="{ color: kpiColor }"
      >
        {{ kpiDisplayValue }}
      </div>
      <div v-if="unitText" class="text-xs text-gray-500 mt-0.5">
        {{ unitText }}<template v-if="element.population_normalized"> / 1 000 Einw.</template>
      </div>
      <div v-if="labelText" class="text-xs text-gray-400 leading-snug">
        {{ labelText }}
      </div>
      <ThresholdBar
        v-if="kpiValue !== null && hasThresholds"
        :thresholds="element.thresholds!"
        :value="kpiValue"
        :unit="unitText"
        :is-percentage="element.is_percentage"
        class="mt-2"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSlzLocale } from '~/composables/useSlzLocale'
import type { RenderElement, CollectionSummary } from '~/types/slz-api'

const props = defineProps<{
  element: RenderElement
  collectionSlug: string
  ars: string
  baseUrl: string
  population?: number | null
}>()

const { t } = useSlzLocale()

const loading  = ref(false)
const aggregate = ref<Record<string, unknown> | null>(null)

const unitText  = computed(() => t(props.element.unit))
const labelText = computed(() => t(props.element.label))
const hasThresholds = computed(() => {
  const th = props.element.thresholds
  return !!th && Object.keys(th).length > 0
})

const kpiRawValue = computed(() => {
  if (!props.element.field || !aggregate.value) return null
  const v = aggregate.value[props.element.field]
  return typeof v === 'number' ? v : null
})

const kpiValue = computed(() => {
  const raw = kpiRawValue.value
  if (raw === null) return null
  if (props.element.population_normalized && props.population) {
    return (raw / props.population) * 1000
  }
  return raw
})

const kpiDisplayValue = computed(() => {
  const v = kpiValue.value
  if (v === null || v === undefined) return '—'
  if (props.element.is_percentage) {
    const th = props.element.thresholds ?? {}
    const vals = Object.values(th).filter(x => typeof x === 'number' && x > 0)
    const isRatioScale = vals.length > 0 && Math.max(...vals) <= 1
    const pct = isRatioScale ? v * 100 : v
    return `${pct.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
  }
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`
  if (v >= 10_000)    return v.toLocaleString('de-DE')
  if (!Number.isInteger(v)) return v.toLocaleString('de-DE', { maximumFractionDigits: 1 })
  return v.toLocaleString('de-DE')
})

const kpiColor = computed(() => {
  const v = kpiValue.value
  const th = props.element.thresholds ?? {}
  if (v === null || !Object.keys(th).length) return '#006e94'
  if (th.darkgreen  != null && v >= th.darkgreen)  return '#1EA64A'
  if (th.lightgreen != null && v >= th.lightgreen) return '#8DC63F'
  if (th.yellow     != null && v >= th.yellow)     return '#F7A600'
  if (th.orange     != null && v >= th.orange)     return '#F36633'
  return '#E30613'
})

onMounted(async () => {
  if (!props.ars || !props.collectionSlug) return
  loading.value = true
  try {
    const data = await $fetch<CollectionSummary>(
      `${props.baseUrl}/api/collections/${props.collectionSlug}/summary/`,
      { params: { area: props.ars } },
    )
    aggregate.value = (data?.aggregate as Record<string, unknown>) ?? null
  } catch (_) {
    // Silently fail — display '—'
  } finally {
    loading.value = false
  }
})
</script>
