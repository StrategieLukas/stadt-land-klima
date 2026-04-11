<template>
  <div
    ref="rootEl"
    class="blokkli-block-carousel"
    :id="'block-' + uuid"
  >
    <!--
      Always full-bleed (breaks out of article max-width like the projects carousel).
      peek=true:  active slide centred with symmetric padding, adjacent slides visible on both sides.
      peek=false: left-aligned scroll, next slide peeks in from the right only.
      Editor:     plain vertical list so drag/drop works.
    -->
    <div :class="!isEditing ? 'carousel-bleed' : ''">
      <div
        ref="scrollEl"
        :class="isEditing
          ? ''
          : 'overflow-x-auto snap-x snap-mandatory scrollbar-hide'"
        :style="trackStyle"
        @scroll="onScroll"
      >
        <!-- --slide-w is set on scrollEl itself (in trackStyle) and inherits to all descendants. -->
        <BlokkliField
          name="slides"
          :list="props.slides || []"
          tag="div"
          :class="isEditing
            ? 'flex flex-col gap-4'
            : ['carousel-slides flex', gapClass]"
        />
      </div>
    </div>

    <!-- Controls: ← dots → in one row below the slides -->
    <div
      v-if="!isEditing && (options.showArrows || (options.showDots && dotCount > 1))"
      class="flex items-center justify-center gap-3 mt-4"
    >
      <button
        v-if="options.showArrows"
        class="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white shadow transition-opacity"
        :class="canScrollLeft ? 'opacity-100' : 'opacity-30 cursor-default'"
        aria-label="Zurück"
        @click="scrollBy(-1)"
      >
        <Icon icon="mdi:chevron-left" class="w-5 h-5 text-gray" />
      </button>

      <div v-if="options.showDots && dotCount > 1" class="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          v-for="i in dotCount"
          :key="i"
          class="rounded-full transition-all duration-200"
          :class="currentDot === i - 1
            ? [activeDotClass, 'w-3 h-3']
            : [inactiveDotClass, 'w-2 h-2']"
          :aria-label="`Slide ${i}`"
          @click="scrollToIndex(i - 1)"
        />
      </div>

      <button
        v-if="options.showArrows"
        class="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white shadow transition-opacity"
        :class="canScrollRight ? 'opacity-100' : 'opacity-30 cursor-default'"
        aria-label="Weiter"
        @click="scrollBy(1)"
      >
        <Icon icon="mdi:chevron-right" class="w-5 h-5 text-gray" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { FieldListItem } from '#blokkli/types'

const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'carousel',
  options: {
    peek: {
      type: 'checkbox',
      label: 'Aktive Folie zentrieren',
      default: true,
      group: 'Folien',
    },
    slideWidth: {
      type: 'radios',
      label: 'Breite der Folien',
      default: '100',
      group: 'Folien',
      options: {
        '100': '1 Spalte (100%)',
        '50': '2 Spalten (50%)',
        '33': '3 Spalten (33%)',
        '25': '4 Spalten (25%)',
      },
    },
    gap: {
      type: 'radios',
      label: 'Abstand',
      default: 'medium',
      group: 'Folien',
      options: {
        none: 'Kein',
        small: 'Klein',
        medium: 'Mittel',
        large: 'Groß',
      },
    },
    accentColor: {
      type: 'radios',
      label: 'Akzentfarbe',
      default: 'green',
      displayAs: 'colors',
      group: 'Navigation',
      options: {
        green: { label: 'Grün', hex: '#1da64a' },
        blue: { label: 'Blau', hex: '#16bae7' },
        dark: { label: 'Dunkelblau', hex: '#006e94' },
        orange: { label: 'Orange', hex: '#f39200' },
      },
    },
    showArrows: {
      type: 'checkbox',
      label: 'Navigationspfeile',
      default: true,
      group: 'Navigation',
    },
    showDots: {
      type: 'checkbox',
      label: 'Punkte-Navigation',
      default: true,
      group: 'Navigation',
    },
    autoplay: {
      type: 'radios',
      label: 'Autoplay',
      default: '0',
      group: 'Navigation',
      options: {
        '0': 'Aus',
        '3': '3s',
        '5': '5s',
        '8': '8s',
        '10': '10s',
      },
    },
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: () => 'Karussell',
    mockProps: () => { return { slides: [] } },
  },
})

const props = defineProps<{
  slides?: FieldListItem[]
}>()

const scrollEl = ref<HTMLElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)
const articleWidth = ref(0)      // article column width (rootEl) — for slide sizing
const scrollContainerWidth = ref(0) // actual scroll container width (100vw in bleed mode) — for centering
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
const currentDot = ref(0)
let autoplayTimer: ReturnType<typeof setInterval> | null = null
let resizeObserver: ResizeObserver | null = null

const slideCount = computed(() => props.slides?.length || 0)
// One dot per slide
const dotCount = computed(() => slideCount.value)

const GAP_PX: Record<string, number> = { none: 0, small: 8, medium: 16, large: 32 }
const gapClass = computed(() => {
  const map: Record<string, string> = { none: 'gap-0', small: 'gap-2', medium: 'gap-4', large: 'gap-8' }
  return map[options.value.gap] || 'gap-4'
})

// Number of slides visible across the article column width.
const nSlides = computed(() => Math.round(100 / (parseInt(options.value.slideWidth) || 100)))

// Slide width in pixels: divide the article column width by n columns minus gaps.
const slideWidthPx = computed(() => {
  if (!articleWidth.value) return 300
  const gap = GAP_PX[options.value.gap] ?? 16
  const n = nSlides.value
  return Math.round((articleWidth.value - gap * (n - 1)) / n)
})

// Centre-padding: shift the active slide to the middle of the SCROLL CONTAINER
// (which is 100vw in bleed mode, not the article column width).
const peekPx = computed(() =>
  Math.max(0, Math.round((scrollContainerWidth.value - slideWidthPx.value) / 2)),
)

// Applied to the scroll container.
// Also sets --slide-w and --snap-align so they inherit to all descendants.
// peek=true:  symmetric padding, snap-align: center — browser centres each slide.
// peek=false: 1.5rem left-edge padding (aligns with article column), snap-align: start,
//             scrollPaddingLeft so the browser's snap port matches our 1.5rem padding.
const trackStyle = computed(() => {
  if (isEditing || !scrollContainerWidth.value) return {}
  const slideW = slideWidthPx.value + 'px'
  if (!options.value.peek) {
    return {
      '--slide-w': slideW,
      '--snap-align': 'start',
      paddingLeft: '1.5rem',
      paddingRight: '1.5rem',
      scrollPaddingLeft: '1.5rem',
      boxSizing: 'border-box' as const,
    }
  }
  const p = peekPx.value + 'px'
  return {
    '--slide-w': slideW,
    '--snap-align': 'center',
    paddingLeft: p,
    paddingRight: p,
    boxSizing: 'border-box' as const,
  }
})

const activeDotClass = computed(() => {
  const map: Record<string, string> = {
    green: 'bg-ff-green',
    blue: 'bg-light-blue',
    dark: 'bg-stats-dark',
    orange: 'bg-orange',
  }
  return map[options.value.accentColor] || 'bg-ff-green'
})

const inactiveDotClass = computed(() => {
  const map: Record<string, string> = {
    green: 'bg-ff-green/30',
    blue: 'bg-light-blue/30',
    dark: 'bg-stats-dark/30',
    orange: 'bg-orange/30',
  }
  return map[options.value.accentColor] || 'bg-ff-green/30'
})

// Distance to scroll in order to advance exactly one slide.
// scrollToIndex(i) = i * scrollStep is mathematically correct given the padding approach.
function getScrollStep(): number {
  return slideWidthPx.value + (GAP_PX[options.value.gap] ?? 16)
}

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 1
  canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
  const step = getScrollStep()
  currentDot.value = step > 0 ? Math.round(el.scrollLeft / step) : 0
}

function scrollBy(direction: 1 | -1) {
  const next = Math.max(0, Math.min(slideCount.value - 1, currentDot.value + direction))
  scrollToIndex(next)
}

function scrollToIndex(index: number) {
  const el = scrollEl.value
  if (!el) return
  // scrollLeft = i * step correctly centres slide i when peek padding is symmetric.
  // With scroll-snap-align: center and symmetric paddingLeft/paddingRight, the CSS
  // snap point for slide i IS i * step — no need for getBoundingClientRect.
  el.scrollTo({ left: index * getScrollStep(), behavior: 'smooth' })
}

function updateContainerWidth() {
  // rootEl = article-flow element → used for slide sizing (column fractions)
  if (rootEl.value) articleWidth.value = rootEl.value.clientWidth
  // scrollEl = full-bleed 100vw container → used for centering padding
  if (scrollEl.value) scrollContainerWidth.value = scrollEl.value.clientWidth
  onScroll()
}

function startAutoplay() {
  stopAutoplay()
  const seconds = parseInt(options.value.autoplay)
  if (!seconds || isEditing) return
  autoplayTimer = setInterval(() => {
    const next = currentDot.value + 1
    scrollToIndex(next >= slideCount.value ? 0 : next)
  }, seconds * 1000)
}

function stopAutoplay() {
  if (autoplayTimer !== null) {
    clearInterval(autoplayTimer)
    autoplayTimer = null
  }
}

watch(() => options.value.autoplay, startAutoplay)
watch(() => options.value.slideWidth, () => nextTick(updateContainerWidth))
watch(() => options.value.peek, () => nextTick(updateContainerWidth))

onMounted(() => {
  updateContainerWidth()
  startAutoplay()
  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateContainerWidth)
    resizeObserver.observe(rootEl.value)
  }
})

onUnmounted(() => {
  stopAutoplay()
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.blokkli-block-carousel {
  width: 100%;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/*
  Style each blokkli item wrapper inside the slides field.
  Anchored on the native root element (.blokkli-block-carousel has the Vue scope ID).
  BlokkliField renders a wrapper div without the scope ID, so we cannot anchor on
  .carousel-slides directly — use a descendant :deep() selector instead.
*/
.blokkli-block-carousel :deep(.carousel-slides) {
  /* Must grow to fit all slides so scrollEl can actually scroll horizontally. */
  width: max-content;
}

.blokkli-block-carousel :deep(.carousel-slides > *) {
  flex: 0 0 var(--slide-w, 300px);
  min-width: 0;
  scroll-snap-align: var(--snap-align, center);
}

/*
  Peek mode: break out of any max-width container to fill the full viewport.
  The inner scroll div still controls its own padding so content aligns correctly.
*/
.carousel-bleed {
  position: relative;
  left: 50%;
  margin-left: -50vw;
  width: 100vw;
}
</style>
