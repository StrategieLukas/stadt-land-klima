<template>
  <div class="blokkli-block-carousel" :id="'block-' + uuid">
    <!--
      Single BlokkliField — always mounted so blokkli tracks the field consistently.
      In preview: scroll container with centering padding (peek effect).
      In editor:  plain vertical list so drag/drop works.
    -->
    <div
      ref="scrollEl"
      :class="isEditing
        ? ''
        : 'overflow-x-auto snap-x snap-mandatory scrollbar-hide'"
      :style="trackStyle"
      @scroll="onScroll"
    >
      <BlokkliField
        name="slides"
        :list="props.slides || []"
        tag="div"
        :class="isEditing
          ? 'flex flex-col gap-4'
          : ['carousel-slides flex', gapClass]"
        :style="isEditing ? {} : { '--slide-w': slideWidthPx + 'px' }"
      />
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
            : 'bg-gray-300 w-2 h-2'"
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
    slideWidth: {
      type: 'radios',
      label: 'Breite der Folien',
      default: '70',
      options: {
        '50': '50%',
        '60': '60%',
        '70': '70%',
        '80': '80%',
        '100': '100% (kein Peek)',
      },
    },
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
    showArrows: {
      type: 'checkbox',
      label: 'Navigationspfeile',
      default: true,
    },
    showDots: {
      type: 'checkbox',
      label: 'Punkte-Navigation',
      default: true,
    },
    gap: {
      type: 'radios',
      label: 'Abstand',
      default: 'medium',
      options: {
        none: 'Kein',
        small: 'Klein',
        medium: 'Mittel',
        large: 'Groß',
      },
    },
    autoplay: {
      type: 'radios',
      label: 'Autoplay',
      default: '0',
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
const containerWidth = ref(0)
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

// Slide width in pixels, derived from container width and the chosen percentage.
const slideWidthPx = computed(() =>
  Math.round(containerWidth.value * (parseInt(options.value.slideWidth) || 70) / 100),
)
// Padding on each side of the track so the first and last slide snap to center.
const peekPx = computed(() =>
  Math.max(0, Math.round((containerWidth.value - slideWidthPx.value) / 2)),
)

// Applied to the scroll container: padding creates the centering peek effect.
const trackStyle = computed(() => {
  if (isEditing || !containerWidth.value) return {}
  const p = peekPx.value + 'px'
  return {
    paddingLeft: p,
    paddingRight: p,
    // scrollPaddingLeft tells the browser where snapped content starts
    scrollPaddingLeft: p,
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
  const el = scrollEl.value
  if (!el) return
  el.scrollBy({ left: direction * getScrollStep(), behavior: 'smooth' })
}

function scrollToIndex(index: number) {
  const el = scrollEl.value
  if (!el) return
  el.scrollTo({ left: index * getScrollStep(), behavior: 'smooth' })
}

function updateContainerWidth() {
  const el = scrollEl.value
  if (!el) return
  containerWidth.value = el.clientWidth
  onScroll()
}

function startAutoplay() {
  stopAutoplay()
  const seconds = parseInt(options.value.autoplay)
  if (!seconds || isEditing) return
  autoplayTimer = setInterval(() => {
    const el = scrollEl.value
    if (!el) return
    if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
      scrollToIndex(0)
    } else {
      scrollBy(1)
    }
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

onMounted(() => {
  updateContainerWidth()
  startAutoplay()
  if (scrollEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateContainerWidth)
    resizeObserver.observe(scrollEl.value)
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
  Uses the CSS custom property --slide-w set via :style on BlokkliField.
  scroll-snap-align: center ensures the active slide snaps to the middle of the viewport.
*/
.carousel-slides > :deep(*) {
  flex: 0 0 var(--slide-w, 300px);
  min-width: 0;
  scroll-snap-align: center;
}
</style>
