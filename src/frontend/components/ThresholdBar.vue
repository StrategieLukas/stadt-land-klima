<template>
  <div class="select-none">
    <!-- Zone bar with marker -->
    <div class="relative">
      <!-- Gradient zones -->
      <div class="flex h-2.5 rounded-full overflow-hidden">
        <div
          v-for="zone in zones"
          :key="zone.color"
          :style="{ width: zone.width + '%', backgroundColor: ZONE_COLORS[zone.color] }"
          class="flex-shrink-0"
        />
      </div>

      <!-- Value marker -->
      <div
        v-if="markerPct !== null"
        class="absolute top-0 -translate-x-1/2"
        :style="{ left: markerPct + '%' }"
      >
        <!-- Triangle pointing down, sitting on the bar -->
        <div
          class="w-0 h-0 -mt-1.5"
          style="border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #1f2937;"
        />
      </div>
    </div>

    <!-- Threshold labels below the bar -->
    <div class="relative h-4 mt-0.5">
      <span
        v-for="label in thresholdLabels"
        :key="label.pos"
        class="absolute text-[9px] text-gray-400 -translate-x-1/2 leading-none"
        :style="{ left: label.pos + '%' }"
      >
        {{ label.text }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  thresholds: Record<string, number>
  value: number | null
  unit?: string
  isPercentage?: boolean
}>()

const ZONE_COLORS: Record<string, string> = {
  red:        '#E30613',
  orange:     '#F36633',
  yellow:     '#F7A600',
  lightgreen: '#8DC63F',
  darkgreen:  '#1EA64A',
}

// Normalize thresholds: if is_percentage and all values ≤ 1, treat as ratio scale → multiply by 100
const normalizedThresholds = computed(() => {
  const t = props.thresholds ?? {}
  const vals = Object.values(t).filter(x => typeof x === 'number' && x > 0)
  const isRatioScale = props.isPercentage && vals.length > 0 && Math.max(...vals) <= 1
  const scale = isRatioScale ? 100 : 1
  return {
    orange:     t.orange     != null ? t.orange     * scale : null,
    yellow:     t.yellow     != null ? t.yellow     * scale : null,
    lightgreen: t.lightgreen != null ? t.lightgreen * scale : null,
    darkgreen:  t.darkgreen  != null ? t.darkgreen  * scale : null,
  }
})

const normalizedValue = computed(() => {
  if (props.value === null || props.value === undefined) return null
  const t = props.thresholds ?? {}
  const vals = Object.values(t).filter(x => typeof x === 'number' && x > 0)
  const isRatioScale = props.isPercentage && vals.length > 0 && Math.max(...vals) <= 1
  return isRatioScale ? props.value * 100 : props.value
})

const axisMax = computed(() => {
  const nt = normalizedThresholds.value
  const highest = nt.darkgreen ?? nt.lightgreen ?? nt.yellow ?? nt.orange ?? 0
  return Math.max(highest * 1.4, normalizedValue.value ?? 0, 1)
})

// Build ordered zones from threshold breakpoints
const zones = computed(() => {
  const nt = normalizedThresholds.value
  const max = axisMax.value

  // Collect named breakpoints sorted by value
  const breaks: { val: number; color: string }[] = []
  if (nt.orange     != null) breaks.push({ val: nt.orange,     color: 'orange' })
  if (nt.yellow     != null) breaks.push({ val: nt.yellow,     color: 'yellow' })
  if (nt.lightgreen != null) breaks.push({ val: nt.lightgreen, color: 'lightgreen' })
  if (nt.darkgreen  != null) breaks.push({ val: nt.darkgreen,  color: 'darkgreen' })
  breaks.sort((a, b) => a.val - b.val)

  if (!breaks.length) return [{ color: 'red', width: 100 }]

  const raw: { start: number; end: number; color: string }[] = []
  // Red zone: 0 to first break
  raw.push({ start: 0, end: breaks[0].val, color: 'red' })
  // Zones between breaks
  for (let i = 0; i < breaks.length - 1; i++) {
    raw.push({ start: breaks[i].val, end: breaks[i + 1].val, color: breaks[i].color })
  }
  // Final zone: last break to axisMax
  raw.push({ start: breaks[breaks.length - 1].val, end: max, color: breaks[breaks.length - 1].color })

  return raw
    .filter(z => z.end > z.start)
    .map(z => ({ color: z.color, width: ((z.end - z.start) / max) * 100 }))
})

const markerPct = computed(() => {
  const v = normalizedValue.value
  if (v === null) return null
  return Math.min(Math.max((v / axisMax.value) * 100, 0), 100)
})

const thresholdLabels = computed(() => {
  const nt = normalizedThresholds.value
  const max = axisMax.value
  return (['orange', 'yellow', 'lightgreen', 'darkgreen'] as const)
    .filter(k => nt[k] != null)
    .map(k => ({
      pos: Math.min((nt[k]! / max) * 100, 99),
      text: nt[k]!.toLocaleString('de-DE', { maximumFractionDigits: 1 }),
    }))
})
</script>
