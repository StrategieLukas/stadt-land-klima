<template>
  <div class="blokkli-block-timeline">
    <h2
      v-if="props.title || isEditing"
      v-blokkli-editable:title
      class="text-2xl font-bold mb-8"
      v-text="props.title"
    />
    <div class="relative">
      <!-- Vertical line -->
      <div
        class="absolute top-2 bottom-2 w-0.5"
        :class="[lineClass, options.layout === 'alternating' ? 'left-1/2 -translate-x-1/2' : 'left-4']"
      />
      <BlokkliField
        name="items"
        :list="props.items || []"
        tag="div"
        class="flex flex-col"
        :class="options.layout === 'alternating' ? 'gap-0' : 'gap-0'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FieldListItem } from '#blokkli/types'

const { options, isEditing } = defineBlokkli({
  bundle: 'timeline',
  options: {
    accentColor: {
      type: 'radios',
      label: 'Akzentfarbe',
      default: 'green',
      displayAs: 'colors',
      options: {
        green: { label: 'Grün', hex: '#1da64a' },
        blue: { label: 'Blau', hex: '#16bae7' },
        dark: { label: 'Dunkelblau', hex: '#006e94' },
        orange: { label: 'Orange', hex: '#f39200' },
      },
    },
    layout: {
      type: 'radios',
      label: 'Layout',
      default: 'left',
      options: {
        left: 'Linksbündig',
        alternating: 'Abwechselnd',
      },
    },
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: () => 'Zeitstrahl',
    mockProps: () => { return { title: 'Zeitstrahl', items: [] } },
  },
})

const props = defineProps<{
  title?: string
  items?: FieldListItem[]
}>()

const lineClass = computed(() => {
  const map: Record<string, string> = {
    green: 'bg-ff-green',
    blue: 'bg-light-blue',
    dark: 'bg-stats-dark',
    orange: 'bg-orange',
  }
  return map[options.value.accentColor] || 'bg-ff-green'
})
</script>

<style scoped>
.blokkli-block-timeline {
  width: 100%;
  padding: 1rem 0;
}
</style>
