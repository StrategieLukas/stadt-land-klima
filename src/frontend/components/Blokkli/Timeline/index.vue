<template>
  <div class="blokkli-block-timeline" :id="'block-' + uuid">
    <h2
      v-if="props.title || isEditing"
      v-blokkli-editable:title
      class="text-2xl font-bold mb-8"
      v-text="props.title"
    />
    <div
      class="relative"
      :class="{
        'timeline-alternating': options.layout === 'alternating',
        'timeline-right': options.layout === 'right',
      }"
    >
      <!-- Vertical line -->
      <div
        class="absolute top-2 bottom-2 w-0.5"
        :class="[lineClass, linePositionClass]"
      />
      <BlokkliField
        name="items"
        :list="props.items || []"
        tag="div"
        :class="options.layout !== 'alternating' ? 'flex flex-col' : ''"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FieldListItem } from '#blokkli/types'

const { options, isEditing, uuid } = defineBlokkli({
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
        right: 'Rechtsbündig',
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

const linePositionClass = computed(() => {
  const l = options.value.layout
  if (l === 'alternating') return 'left-1/2 -translate-x-1/2'
  if (l === 'right') return 'right-4'
  return 'left-4'
})

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

/* ===== Alternating layout ===== */
/* Odd items: LEFT side — content right-aligned, dot on centre line */
.timeline-alternating :deep(.blokkli-block-timeline-item:nth-child(odd)) {
  width: 50%;
  padding-left: 0 !important;
  padding-right: 3.5rem;
  text-align: right;
}
.timeline-alternating :deep(.blokkli-block-timeline-item:nth-child(odd) .timeline-item-dot) {
  left: auto !important;
  right: -1rem; /* dot centre = item.right + 1rem − 1rem = 50% ✓ */
}
/* Even items: RIGHT side — content left-aligned, dot on centre line */
.timeline-alternating :deep(.blokkli-block-timeline-item:nth-child(even)) {
  width: 50%;
  margin-left: 50%;
  padding-left: 3.5rem !important;
  padding-right: 0;
  text-align: left;
}
.timeline-alternating :deep(.blokkli-block-timeline-item:nth-child(even) .timeline-item-dot) {
  left: -1rem !important; /* dot centre = item.left − 1rem + 1rem = 50% ✓ */
}

/* ===== Right layout: line on the right, all content left side ===== */
.timeline-right :deep(.blokkli-block-timeline-item) {
  padding-left: 0 !important;
  padding-right: 3.5rem;
  text-align: right;
}
.timeline-right :deep(.blokkli-block-timeline-item .timeline-item-dot) {
  left: auto !important;
  right: 0; /* dot centre = container.right − 1rem = right-4 line centre ✓ */
}
</style>
