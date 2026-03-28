<template>
  <div class="blokkli-block-timeline-item relative pl-12 pb-10">
    <!-- Dot on the line -->
    <div
      class="absolute left-0 top-1.5 w-8 h-8 rounded-full flex items-center justify-center z-10"
      :class="dotBgClass"
    >
      <Icon v-if="options.icon" :icon="options.icon" class="w-4 h-4 text-white" />
      <div v-else class="w-3 h-3 rounded-full bg-white opacity-80" />
    </div>

    <!-- Date / label -->
    <span
      v-if="props.date || isEditing"
      v-blokkli-editable:date
      class="text-xs font-bold uppercase tracking-widest mb-1 block"
      :class="accentTextClass"
      v-text="props.date"
    />

    <!-- Title -->
    <h3
      v-blokkli-editable:title
      class="text-lg font-bold text-black mb-2 leading-snug"
      v-text="props.title"
    />

    <!-- Description -->
    <p
      v-if="props.description || isEditing"
      v-blokkli-editable:description
      class="text-sm text-gray leading-relaxed"
      v-text="props.description"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const { options, isEditing } = defineBlokkli({
  bundle: 'timeline_item',
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
      },
    },
    icon: {
      type: 'text',
      label: 'Icon (z.B. mdi:star)',
      default: '',
      inputType: 'text',
    },
  },
  editor: {
    addBehaviour: 'editable:title',
    editTitle: (el) => el.textContent?.trim().slice(0, 40) || 'Zeitstrahl-Eintrag',
    mockProps: () => { return { date: '2024', title: 'Meilenstein', description: 'Beschreibung des Ereignisses...' } },
  },
})

const props = defineProps<{
  date?: string
  title?: string
  description?: string
}>()

const colorMap: Record<string, { bg: string; text: string }> = {
  green: { bg: 'bg-ff-green', text: 'text-ff-green' },
  blue: { bg: 'bg-light-blue', text: 'text-light-blue' },
  dark: { bg: 'bg-stats-dark', text: 'text-stats-dark' },
  orange: { bg: 'bg-orange', text: 'text-orange' },
  lime: { bg: 'bg-light-green', text: 'text-light-green' },
}

const currentColor = computed(() => colorMap[options.value.color] || colorMap.green)
const dotBgClass = computed(() => currentColor.value.bg)
const accentTextClass = computed(() => currentColor.value.text)
</script>

<style scoped>
.blokkli-block-timeline-item {
  width: 100%;
}
</style>
