<template>
  <div class="blokkli-block-projects-carousel bg-localzero-yellow" :id="'block-' + uuid">
    <!-- Section header -->
    <div class="px-6 pt-10 pb-6">
      <p
        v-blokkli-editable:label
        class="text-xs font-semibold uppercase tracking-widest mb-3"
        v-text="props.label || 'Erfolgsprojekte'"
      />
      <h2
        v-blokkli-editable:heading
        class="text-3xl md:text-5xl font-bold leading-tight"
        v-text="props.heading || 'Überschrift'"
      />
    </div>

    <!-- Editor fallback -->
    <div v-if="isEditing" class="px-6 pb-10 text-sm text-black/50 italic">
      [Projektkarussell – {{ projects?.length ?? 0 }} Einträge geladen]
    </div>

    <!-- Carousel track (only in preview/production) -->
    <template v-else>
      <!-- Full-bleed wrapper: breaks out of any container's max-width -->
      <div class="carousel-bleed">
        <div
          ref="scrollEl"
          class="overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          :style="trackStyle"
          @scroll.passive="onScrollHandler"
        >
          <div class="flex gap-4" style="width: max-content">
            <!--
              Infinite loop: render [copy, real, copy] (3× the items).
              We start scrolled to the middle copy. When we drift into
              either clone zone we silently teleport back to the middle.
            -->
            <div
              v-for="(project, i) in infiniteItems"
              :key="i"
              class="flex-shrink-0 snap-start"
              :style="{ width: slideWidthPx + 'px' }"
            >
              <div class="bg-gray-300 overflow-hidden w-full" style="aspect-ratio: 4/3">
                <SmartImg
                  v-if="project.image?.id"
                  :assetId="project.image.id"
                  :isRaster="isRasterImage(project.image.type)"
                  :width="600"
                  :height="450"
                  fit="cover"
                  imgClass="object-cover w-full h-full"
                />
              </div>
              <p class="mt-2 text-sm font-semibold leading-snug">{{ project.title }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation row: ← dots → (arrows always active — endless scroll) -->
      <div
        v-if="projects && projects.length > 1"
        class="flex items-center justify-center gap-4 mt-6 px-6"
      >
        <button
          class="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-black text-white"
          aria-label="Zurück"
          @click="scrollBy(-1)"
        >
          <Icon icon="mdi:arrow-left" class="w-5 h-5" />
        </button>

        <div class="flex items-center gap-1.5 flex-wrap justify-center">
          <button
            v-for="(project, i) in projects"
            :key="i"
            class="rounded-full transition-all duration-200"
            :class="currentIndex === i ? 'w-3 h-3 bg-black' : 'w-2 h-2 bg-black/40'"
            :aria-label="`Projekt ${i + 1}`"
            @click="scrollToIndex(i)"
          />
        </div>

        <button
          class="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-black text-white"
          aria-label="Weiter"
          @click="scrollBy(1)"
        >
          <Icon icon="mdi:arrow-right" class="w-5 h-5" />
        </button>
      </div>

      <!-- Active project description + link -->
      <div class="px-6 pb-10 mt-4">
        <!-- Fixed-height description area so the block doesn't resize when switching slides -->
        <div :style="{ minHeight: descriptionHeight + 'px' }" ref="descriptionRef">
          <div v-if="activeProject">
            <p class="font-bold">{{ activeProject.title }}</p>
            <p class="text-sm mt-1 leading-relaxed">{{ truncatedAbstract }}</p>
            <NuxtLink
              :to="`/projects/${activeProject.slug}`"
              class="inline-block mt-2 text-sm font-semibold underline underline-offset-2"
            >Mehr lesen…</NuxtLink>
          </div>
        </div>
        <NuxtLink
          v-blokkli-editable:linkText
          to="/projects"
          class="flex-shrink-0 inline-flex items-center gap-1 font-semibold underline underline-offset-2 text-sm mt-3"
          v-text="props.linkText || 'Alle Erfolgsprojekte ansehen'"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { isRaster } from '~/shared/utils'

const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'projects_carousel',
  options: {
    limit: {
      type: 'radios',
      label: 'Anzahl Projekte',
      default: '10',
      options: {
        '5': '5',
        '10': '10',
        '20': '20',
        '50': '50',
      },
    },
  },
  editor: {
    addBehaviour: 'no-form',
    editTitle: () => 'Projektkarussell',
    mockProps: () => { return { label: 'Erfolgsprojekte', heading: 'Von anderen Lernen/Kopieren erlaubt!' } },
  },
})

const props = defineProps<{
  label?: string
  heading?: string
  linkText?: string
}>()

const { $directus, $readItems } = useNuxtApp()

const { data: projects } = await useAsyncData(
  `projects-carousel-${uuid}`,
  async () => {
    try {
      return await $directus.request(
        $readItems('articles' as any, {
          filter: { status: { _eq: 'published' } },
          fields: ['id', 'slug', 'title', 'abstract', { image: ['id', 'type'] }],
          sort: ['-date_created'],
          limit: parseInt(options.value.limit) || 10,
        }),
      ) as any[]
    } catch {
      return []
    }
  },
  { watch: [() => options.value.limit] },
)

function isRasterImage(type?: string): boolean {
  return isRaster(type)
}

// ─── Infinite carousel ────────────────────────────────────────────────────────
//
// Strategy: render [copy_A, real_items, copy_B] (3× the list).
// On mount, jump (instant) to the start of real_items (= offset * step).
// After each scroll settles, if the raw index has drifted into copy_A or copy_B,
// silently teleport back to the equivalent position in real_items.
// From the user's perspective it never ends.

const scrollEl = ref<HTMLElement | null>(null)
const descriptionRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
const currentIndex = ref(0)  // logical index within the real list
const descriptionHeight = ref(0)

const GAP_PX = 16
const SLIDES_VISIBLE = 3.3

// Triple list for cloning
const infiniteItems = computed(() => {
  const items = projects.value || []
  return [...items, ...items, ...items]
})

const realCount = computed(() => projects.value?.length ?? 0)

const slideWidthPx = computed(() => {
  if (!containerWidth.value) return 320
  const availableWidth = containerWidth.value - 48  // subtract px-6 on each side
  return Math.round((availableWidth - GAP_PX * Math.floor(SLIDES_VISIBLE)) / SLIDES_VISIBLE)
})

const trackStyle = computed(() => ({
  paddingLeft: '1.5rem',
  paddingRight: '1.5rem',
  boxSizing: 'border-box' as const,
}))

const activeProject = computed(() => projects.value?.[currentIndex.value] ?? null)

const truncatedAbstract = computed(() => {
  const abstract = activeProject.value?.abstract || ''
  return abstract.length > 250 ? abstract.substring(0, 250) + '…' : abstract
})

function getStep(): number {
  return slideWidthPx.value + GAP_PX
}

function getRawIndex(): number {
  const el = scrollEl.value
  if (!el) return realCount.value
  return Math.round(el.scrollLeft / getStep())
}

// Update the logical dot indicator during scroll
function updateCurrentIndex() {
  const n = realCount.value
  if (n === 0) return
  const raw = getRawIndex()
  currentIndex.value = ((raw - n) % n + n) % n
}

// Guard against re-entrancy when we silently set scrollLeft
let isTeleporting = false

function teleportIfNeeded() {
  const el = scrollEl.value
  const n = realCount.value
  if (!el || n === 0 || isTeleporting) return
  const raw = getRawIndex()
  if (raw < n || raw >= 2 * n) {
    isTeleporting = true
    // Map back into the middle copy
    const target = (((raw % n) + n) % n + n) * getStep()
    el.scrollLeft = target
    requestAnimationFrame(() => { isTeleporting = false })
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onScrollHandler() {
  if (isTeleporting) return
  updateCurrentIndex()
  // Debounce-based teleport (fallback for browsers without scrollend)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(teleportIfNeeded, 150)
}

function scrollBy(direction: 1 | -1) {
  const el = scrollEl.value
  if (!el) return
  el.scrollBy({ left: direction * getStep(), behavior: 'smooth' })
}

function scrollToIndex(logicalIndex: number) {
  const el = scrollEl.value
  if (!el) return
  el.scrollTo({ left: (realCount.value + logicalIndex) * getStep(), behavior: 'smooth' })
}

function updateContainerWidth() {
  const el = scrollEl.value
  if (!el) return
  containerWidth.value = el.clientWidth
}

// Place scroll at the start of the middle (real) copy
function initScroll() {
  const el = scrollEl.value
  if (!el || realCount.value === 0) return
  el.scrollLeft = realCount.value * getStep()
  currentIndex.value = 0
}

// Measure the tallest description across all projects so the block never
// resizes when the user flips between slides.
// Uses a temporary off-screen element so Vue's managed DOM is never touched.
function measureMaxDescriptionHeight() {
  const items = projects.value || []
  if (!items.length || !descriptionRef.value) return

  const probe = document.createElement('div')
  // Match the real container's width and styling but keep it invisible
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:' +
    descriptionRef.value.offsetWidth + 'px'
  document.body.appendChild(probe)

  let maxH = 0
  for (const project of items) {
    const abstract = project.abstract || ''
    const truncated = abstract.length > 250 ? abstract.substring(0, 250) + '\u2026' : abstract
    probe.innerHTML =
      `<p class="font-bold">${project.title}</p>` +
      `<p class="text-sm mt-1 leading-relaxed">${truncated}</p>` +
      `<a class="inline-block mt-2 text-sm font-semibold">Mehr lesen\u2026</a>`
    maxH = Math.max(maxH, probe.scrollHeight)
  }

  document.body.removeChild(probe)
  descriptionHeight.value = maxH
}


let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  updateContainerWidth()
  nextTick(() => {
    initScroll()
    measureMaxDescriptionHeight()
    const el = scrollEl.value
    if (!el) return
    // Native scrollend for clean teleporting (Chrome 114+, Firefox 109+)
    el.addEventListener('scrollend', teleportIfNeeded)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateContainerWidth()
        nextTick(() => {
          // Re-seat scroll position to current logical index after resize
          const scrollElVal = scrollEl.value
          if (scrollElVal && realCount.value > 0) {
            scrollElVal.scrollLeft = (realCount.value + currentIndex.value) * getStep()
          }
          measureMaxDescriptionHeight()
        })
      })
      resizeObserver.observe(el)
    }
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  scrollEl.value?.removeEventListener('scrollend', teleportIfNeeded)
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.blokkli-block-projects-carousel {
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
  Full-bleed: breaks out of any container max-width and fills the full viewport.
  The inner scroll div retains its own padding (px-6) so content aligns correctly.
*/
.carousel-bleed {
  position: relative;
  left: 50%;
  margin-left: -50vw;
  width: 100vw;
}
</style>
