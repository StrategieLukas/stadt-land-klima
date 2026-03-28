<template>
  <div class="blokkli-block-progress-bar">
    <!-- Label row -->
    <div class="flex items-center justify-between gap-2 mb-2">
      <span
        v-blokkli-editable:label
        class="text-sm font-semibold"
        v-text="props.label"
      />
      <span
        v-if="options.showValue"
        class="text-sm font-bold tabular-nums"
        :class="accentTextClass"
      >{{ displayValue }}</span>
    </div>

    <!-- Track -->
    <div
      class="w-full rounded-full overflow-hidden"
      :class="[trackBgClass, trackHeightClass]"
    >
      <div
        class="rounded-full transition-[width] duration-700 ease-out"
        :class="[barBgClass, trackHeightClass]"
        :style="{ width: `${clampedValue}%` }"
        role="progressbar"
        :aria-valuenow="clampedValue"
        aria-valuemin="0"
        aria-valuemax="100"
      />
    </div>

    <!-- Optional description -->
    <p
      v-if="props.description || isEditing"
      v-blokkli-editable:description
      class="text-xs text-gray opacity-70 mt-1.5 leading-relaxed"
      v-text="props.description"
    />
  </div>
</template>

<script setup lang="ts">
const { options, isEditing } = defineBlokkli({
  bundle: 'progress_bar',
  options: {
    color: {
      type: 'radios',
      label: 'Farbe',
      default: 'green',
      displayAs: 'colors',
      options: {
        green: { label: 'Grün', hex: '#1da64a' },
        blue: { label: 'Blau', hex: '#16bae7' },
        dark: { label: 'Dunkelblau', hex: '#006e94' },
        orange: { label: 'Orange', hex: '#f39200' },
        lime: { label: 'Hellgrün', hex: '#AFCA0B' },
        red: { label: 'Rot', hex: '#e30613' },
      },
    },
    size: {
      type: 'radios',
      label: 'Größe',
      default: 'medium',
      options: {
        small: 'Klein',
        medium: 'Mittel',
        large: 'Groß',
      },
    },
    showValue: {
      type: 'checkbox',
      label: 'Wert anzeigen',
      default: true,
    },
    trackStyle: {
      type: 'radios',
      label: 'Hintergrund',
      default: 'light',
      options: {
        light: 'Hell',
        muted: 'Grau',
      },
    },
  },
  editor: {
    addBehaviour: 'editable:label',
    editTitle: (el) => el.textContent?.trim().slice(0, 40) || 'Fortschrittsbalken',
    mockProps: () => { return { label: 'Fortschritt', value: '72', unit: '%', description: '' } },
  },
})

const props = defineProps<{
  label?: string
  value?: string
  unit?: string
  description?: string
}>()

const clampedValue = computed(() => {
  const v = parseFloat(props.value || '0')
  return Math.min(100, Math.max(0, isNaN(v) ? 0 : v))
})

const displayValue = computed(() => {
  return `${props.value || '0'}${props.unit || '%'}`
})

const colorMap: Record<string, { bar: string; text: string }> = {
  green: { bar: 'bg-ff-green', text: 'text-ff-green' },
  blue: { bar: 'bg-light-blue', text: 'text-light-blue' },
  dark: { bar: 'bg-stats-dark', text: 'text-stats-dark' },
  orange: { bar: 'bg-orange', text: 'text-orange' },
  lime: { bar: 'bg-light-green', text: 'text-light-green' },
  red: { bar: 'bg-red', text: 'text-red' },
}

const currentColor = computed(() => colorMap[options.value.color] || colorMap.green)
const barBgClass = computed(() => currentColor.value.bar)
const accentTextClass = computed(() => currentColor.value.text)

const trackBgClass = computed(() =>
  options.value.trackStyle === 'muted' ? 'bg-gray-300' : 'bg-gray-100',
)

const trackHeightClass = computed(() => {
  const map: Record<string, string> = {
    small: 'h-2',
    medium: 'h-4',
    large: 'h-6',
  }
  return map[options.value.size] || 'h-4'
})
</script>

<style scoped>
.blokkli-block-progress-bar {
  width: 100%;
}
</style>
