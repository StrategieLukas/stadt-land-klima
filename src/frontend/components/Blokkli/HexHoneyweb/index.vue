<template>
  <div
    class="blokkli-block-hex-honeyweb overflow-x-auto"
    :id="'block-' + uuid"
  >
    <BlokkliField
      ref="fieldEl"
      name="hexagons"
      :list="props.hexagons || []"
      tag="div"
      :class="isEditing ? 'hex-edit-wrap' : 'hex-honeycomb'"
    />
  </div>
</template>

<script setup lang="ts">
import type { FieldListItem } from '#blokkli/types'

const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'hex_grid',
  options: {
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
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: () => 'Honeyweb',
    mockProps: () => { return { hexagons: [] } },
  },
})

const props = defineProps<{
  hexagons?: FieldListItem[]
}>()

/**
 * Flat-top hexagon math:
 *   W = 2r  (circumradius r)
 *   H = √3·r  (bounding-box height of one hex)
 *   Horizontal column step = 1.5r = 0.75W  (adjacent columns share one side)
 *   Odd columns offset down by H/2
 *
 * hexagons are ordered COLUMN-MAJOR (3 rows per column, up to 5 columns = 15 hexagons).
 */
const hexR = computed(() => {
  const map: Record<string, number> = { small: 55, medium: 75, large: 95 }
  return map[options.value.size] ?? 75
})
const hexW = computed(() => hexR.value * 2)
const hexH = computed(() => hexR.value * Math.sqrt(3))
const colStep = computed(() => hexR.value * 1.5)

/** Return pixel {left, top} for the nth item (0-based), column-major. */
function hexPos(i: number) {
  const col = Math.floor(i / 3)
  const row = i % 3
  return {
    left: col * colStep.value,
    top: row * hexH.value + (col % 2 === 1 ? hexH.value / 2 : 0),
  }
}

const fieldEl = ref<InstanceType<typeof import('vue').Component> | null>(null)

/**
 * Apply inline styles to every direct child of the honeycomb container.
 * Inline styles have the highest CSS priority, so they win regardless of
 * scoped-CSS load order or any `width: 100%` the child component may declare.
 */
function applyLayout() {
  // BlokkliField renders as a <div> — $el gives us that element.
  const container = (fieldEl.value as any)?.$el as HTMLElement | undefined
  if (!container) return
  const children = Array.from(container.children) as HTMLElement[]

  if (isEditing) {
    // Editor: just give every child a fixed size so the clip-path hex renders
    // correctly inside the flex-wrap. Positioning is handled by flex.
    children.forEach((child) => {
      child.style.width = `${hexW.value}px`
      child.style.height = `${hexH.value}px`
      child.style.position = ''
      child.style.left = ''
      child.style.top = ''
    })
    return
  }

  const totalCols = Math.ceil(children.length / 3)
  const containerW = colStep.value * (totalCols - 1) + hexW.value
  const containerH = hexH.value * 3 + hexH.value / 2  // even cols 0..2H, odd cols 0.5..2.5H
  container.style.position = 'relative'
  container.style.width = `${containerW}px`
  container.style.height = `${containerH}px`
  container.style.margin = '0 auto'
  children.forEach((child, i) => {
    const { left, top } = hexPos(i)
    child.style.position = 'absolute'
    child.style.width = `${hexW.value}px`
    child.style.height = `${hexH.value}px`
    child.style.left = `${left}px`
    child.style.top = `${top}px`
  })
}

onMounted(applyLayout)
watch([() => props.hexagons?.length, hexR], () => nextTick(applyLayout))
</script>

<style scoped>
.blokkli-block-hex-honeyweb {
  width: 100%;
  overflow-x: auto;
}

/* ── Editor mode ─────────────────────────────────────────────────────── */
/* Flex-wrap so hexagons get fixed dimensions and the clip-path hex shape is visible */
.hex-edit-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
}

/* ── Preview mode ────────────────────────────────────────────────────── */
/* Container dimensions and child positions are set imperatively by applyLayout().
 * No CSS positioning rules needed here — JS inline styles win unconditionally. */
.hex-honeycomb {
  /* applyLayout() sets position:relative, width, height, margin via inline style */
}
</style>
