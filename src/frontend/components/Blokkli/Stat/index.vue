<template>
  <div class="blokkli-block-stat" :id="'block-' + uuid">
    <!-- Card layout -->
    <div
      v-if="options.layout === 'card'"
      class="rounded-xl p-6 text-center"
      :class="bgClass"
    >
      <div class="flex items-baseline justify-center gap-1 mb-2">
        <span
          v-blokkli-editable:value
          class="font-bold leading-none"
          :class="[valueSizeClass, textClass]"
          v-text="props.value"
        />
        <span
          v-if="props.unit || isEditing"
          v-blokkli-editable:unit
          class="text-xl font-semibold opacity-80"
          :class="textClass"
          v-text="props.unit"
        />
      </div>
      <p
        v-blokkli-editable:label
        class="font-semibold text-base uppercase tracking-wide opacity-90 mb-1"
        :class="textClass"
        v-text="props.label"
      />
      <p
        v-if="props.description || isEditing"
        v-blokkli-editable:description
        class="text-sm opacity-70 leading-relaxed"
        :class="textClass"
        v-text="props.description"
      />
    </div>

    <!-- Inline layout -->
    <div
      v-else-if="options.layout === 'inline'"
      class="flex items-center gap-6 py-4 pl-4"
      :class="borderLeftClass"
    >
      <div class="flex items-baseline gap-1 flex-shrink-0" :class="accentTextClass">
        <span
          v-blokkli-editable:value
          class="font-bold leading-none"
          :class="valueSizeClass"
          v-text="props.value"
        />
        <span
          v-if="props.unit || isEditing"
          v-blokkli-editable:unit
          class="text-lg font-semibold"
          v-text="props.unit"
        />
      </div>
      <div>
        <p
          v-blokkli-editable:label
          class="font-semibold text-sm uppercase tracking-wide mb-0.5"
          v-text="props.label"
        />
        <p
          v-if="props.description || isEditing"
          v-blokkli-editable:description
          class="text-sm text-gray leading-relaxed"
          v-text="props.description"
        />
      </div>
    </div>

    <!-- Minimal layout -->
    <div v-else class="py-2">
      <div class="flex items-baseline gap-1 mb-0.5" :class="accentTextClass">
        <span
          v-blokkli-editable:value
          class="font-bold"
          :class="valueSizeClass"
          v-text="props.value"
        />
        <span
          v-if="props.unit || isEditing"
          v-blokkli-editable:unit
          class="text-base"
          v-text="props.unit"
        />
      </div>
      <p
        v-blokkli-editable:label
        class="text-sm font-medium text-gray mb-0.5"
        v-text="props.label"
      />
      <p
        v-if="props.description || isEditing"
        v-blokkli-editable:description
        class="text-xs text-gray opacity-70"
        v-text="props.description"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'stat',
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
    layout: {
      type: 'radios',
      label: 'Layout',
      default: 'card',
      options: {
        card: 'Karte',
        inline: 'Inline',
        minimal: 'Minimal',
      },
    },
    valueSize: {
      type: 'radios',
      label: 'Zahlengröße',
      default: 'large',
      options: {
        medium: 'Mittel',
        large: 'Groß',
        jumbo: 'Riesig',
      },
    },
  },
  editor: {
    addBehaviour: 'editable:value',
    editTitle: (el) => el.textContent?.trim().slice(0, 20) || 'Kennzahl',
    mockProps: () => { return { value: '100%', unit: '', label: 'Kennzahl', description: '' } },
  },
})

const props = defineProps<{
  value?: string
  unit?: string
  label?: string
  description?: string
}>()

const colorMap: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  green: { bg: 'bg-ff-green', text: 'text-white', border: 'border-ff-green', accent: 'text-ff-green' },
  blue: { bg: 'bg-light-blue', text: 'text-white', border: 'border-light-blue', accent: 'text-light-blue' },
  dark: { bg: 'bg-stats-dark', text: 'text-white', border: 'border-stats-dark', accent: 'text-stats-dark' },
  orange: { bg: 'bg-orange', text: 'text-white', border: 'border-orange', accent: 'text-orange' },
  lime: { bg: 'bg-light-green', text: 'text-white', border: 'border-light-green', accent: 'text-light-green' },
  red: { bg: 'bg-red', text: 'text-white', border: 'border-red', accent: 'text-red' },
}

const currentColor = computed(() => colorMap[options.value.color] || colorMap.green)

const bgClass = computed(() => currentColor.value.bg)
const textClass = computed(() => currentColor.value.text)
const borderLeftClass = computed(() => `border-l-4 ${currentColor.value.border}`)
const accentTextClass = computed(() => currentColor.value.accent)

const valueSizeClass = computed(() => {
  const map: Record<string, string> = {
    medium: 'text-3xl',
    large: 'text-5xl',
    jumbo: 'text-7xl',
  }
  return map[options.value.valueSize] || 'text-5xl'
})
</script>

<style scoped>
.blokkli-block-stat {
  width: 100%;
}
</style>
