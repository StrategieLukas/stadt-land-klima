<template>
  <div
    ref="fieldEl"
    class="blokkli-block-hex-honeyweb overflow-x-auto"
    :id="'block-' + uuid"
  >
    <BlokkliField
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

const fieldEl = ref<HTMLElement | null>(null)

/**
 * Apply inline styles to every direct child of the honeycomb container.
 * Inline styles have the highest CSS priority, so they win regardless of
 * scoped-CSS load order or any `width: 100%` the child component may declare.
 */
function applyLayout() {
  // fieldEl is the outer wrapper div. BlokkliField is a multi-root fragment,
  // so its $el would be a comment node — instead we use firstElementChild
  // of the wrapper to get the actual rendered container div.
  const wrapper = fieldEl.value
  if (!wrapper) return
  const container = wrapper.firstElementChild as HTMLElement | null
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

  // GAP: uniform visual gap between all hex neighbours (px).
  // For a flat-top honeycomb the diagonal edges are at 30°, so to get the
  // same perpendicular clearance on every side we need:
  //   vertical row step increase  : gv = GAP
  //   horizontal col step increase: gc = GAP × (√3 / 2)
  const GAP = 16
  const BORDER_EXT = 4  // ::before extends 4 px outside; offset positions by this
  const gv = GAP
  const gc = GAP * Math.sqrt(3) / 2
  const rowStep = hexH.value + gv
  const colStepFull = colStep.value + gc

  const n = children.length
  if (n === 0) return

  // Find the row count that produces the most square-ish bounding box.
  // Iterate over every possible maxRows (1..n), compute W and H for each, pick
  // the one whose aspect ratio is closest to 1:1.
  let bestMaxRows = 1
  let bestRatio = Infinity
  for (let rows = 1; rows <= n; rows++) {
    const cols = Math.ceil(n / rows)
    const W = (cols - 1) * colStepFull + hexW.value + 2 * BORDER_EXT
    // Measure the actual bottom-most pixel reached by any item.
    let maxBottom = 0
    for (let i = 0; i < n; i++) {
      const c = Math.floor(i / rows)
      const r = i % rows
      const bottom = r * rowStep + (c % 2 === 1 ? rowStep / 2 : 0) + hexH.value
      if (bottom > maxBottom) maxBottom = bottom
    }
    const H = maxBottom + 2 * BORDER_EXT
    const ratio = Math.max(W / H, H / W)
    if (ratio < bestRatio) {
      bestRatio = ratio
      bestMaxRows = rows
    }
  }

  const totalCols = Math.ceil(n / bestMaxRows)
  // Recompute actual container height for the chosen layout.
  let maxBottom = 0
  for (let i = 0; i < n; i++) {
    const c = Math.floor(i / bestMaxRows)
    const r = i % bestMaxRows
    const bottom = r * rowStep + (c % 2 === 1 ? rowStep / 2 : 0) + hexH.value
    if (bottom > maxBottom) maxBottom = bottom
  }
  const containerW = colStepFull * (totalCols - 1) + hexW.value + 2 * BORDER_EXT
  const containerH = maxBottom + 2 * BORDER_EXT
  container.style.position = 'relative'
  container.style.width = `${containerW}px`
  container.style.height = `${containerH}px`
  container.style.margin = '0 auto'
  children.forEach((child, i) => {
    const col = Math.floor(i / bestMaxRows)
    const row = i % bestMaxRows
    const left = col * colStepFull + BORDER_EXT
    const top = row * rowStep + (col % 2 === 1 ? rowStep / 2 : 0) + BORDER_EXT
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
