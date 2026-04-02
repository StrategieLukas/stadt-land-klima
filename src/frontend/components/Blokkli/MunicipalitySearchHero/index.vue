<template>
  <div class="blokkli-block-municipality-search-hero" :id="'block-' + uuid">
    <section
      class="relative overflow-hidden flex items-center justify-center"
      :class="bgClass"
      style="min-height: 85vh"
    >
      <!-- Word cloud background (client-only, pointer-events-none) -->
      <ClientOnly>
        <div
          v-if="wordItems.length"
          class="absolute inset-0 overflow-hidden pointer-events-none select-none"
          aria-hidden="true"
        >
          <span
            v-for="(item, i) in wordItems"
            :key="item.id"
            class="absolute leading-none font-semibold whitespace-nowrap"
            :style="item.style"
          >{{ item.name }}</span>
        </div>
      </ClientOnly>

      <!-- Centre search card -->
      <div class="relative z-10 w-full max-w-xl mx-auto px-4 py-12 flex flex-col items-center text-center">
        <div class="w-full rounded-2xl px-6 py-8 sm:px-10 sm:py-10" :class="cardClass">
          <h2
            v-if="props.title || isEditing"
            v-blokkli-editable:title
            class="text-2xl sm:text-3xl font-bold mb-3 leading-tight"
            :class="titleClass"
            v-text="props.title"
          />
          <p
            v-if="props.subtitle || isEditing"
            v-blokkli-editable:subtitle
            class="mb-6 text-sm sm:text-base"
            :class="subtitleClass"
            v-text="props.subtitle"
          />
          <AdministrativeAreaSearchBar base-path="/stats" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'

// ─── Rating → hex colour map (inline so they work in dynamic inline styles) ───
const RATING_HEX: Record<string, string> = {
  'rating-4': '#1EA64A',
  'rating-3': '#AFCA0B',
  'rating-2': '#FFD400',
  'rating-1': '#F39200',
  'rating-0': '#E30613',
  'rating-na': '#9D9D9C',
}

function scoreToHex(scoreTotal: number | null | undefined): string {
  if (scoreTotal == null) return RATING_HEX['rating-na']
  const s = Number(scoreTotal)
  if (s >= 80) return RATING_HEX['rating-4']
  if (s >= 60) return RATING_HEX['rating-3']
  if (s >= 40) return RATING_HEX['rating-2']
  if (s >= 20) return RATING_HEX['rating-1']
  if (s >= 0)  return RATING_HEX['rating-0']
  return RATING_HEX['rating-na']
}

// ─── Blokkli block definition ─────────────────────────────────────────────────
const { options, isEditing, uuid } = defineBlokkli({
  bundle: 'municipality_search_hero',
  options: {
    title: {
      type: 'text',
      label: 'Überschrift',
      default: 'Gemeinde finden',
    },
    subtitle: {
      type: 'text',
      label: 'Unterzeile',
      default: 'Suche deine Gemeinde und entdecke deren Klimaschutz-Bewertung.',
    },
    background: {
      type: 'radios',
      label: 'Hintergrundfarbe',
      default: 'light',
      options: {
        light: 'Hell (Grau)',
        dark: 'Dunkel (Schiefer)',
        brand: 'Markenfarbe (Teal)',
      },
    },
  },
  editor: {
    addBehaviour: 'editable:title',
    editTitle: (el) => el.querySelector('h2')?.textContent || 'Gemeinde-Suche',
    mockProps: () => { return { title: 'Gemeinde finden', subtitle: 'Suche deine Gemeinde und entdecke deren Klimaschutz-Bewertung.' } },
  },
})

const props = defineProps<{
  title?: string
  subtitle?: string
}>()

const bgClass = computed(() => {
  const map: Record<string, string> = {
    light: 'bg-slate-100',
    dark: 'bg-slate-900',
    brand: 'bg-stats-dark',
  }
  return map[options.value.background] || 'bg-slate-100'
})

const isLight = computed(() => options.value.background === 'light')

const cardClass = computed(() =>
  isLight.value
    ? 'bg-white border border-gray-200 shadow-xl'
    : 'backdrop-blur-md bg-black/50 border border-white/10 shadow-2xl',
)
const titleClass = computed(() => isLight.value ? 'text-gray-900' : 'text-white')
const subtitleClass = computed(() => isLight.value ? 'text-gray-600' : 'text-slate-300')

// ─── Word cloud data ──────────────────────────────────────────────────────────

interface WordItem {
  id: string
  name: string
  style: Record<string, string>
}

const wordItems = ref<WordItem[]>([])

// Golden-angle sunflower spiral: produces uniform distribution across a circular area.
// cx/cy in %, maxR in % half-width. We reject items too close to the centre
// so they don't pile under the search card.
function buildCloudLayout(
  municipalities: Array<{ id: string; name: string; population: number; score_total: number | null; percentage_rated: number | null }>,
): WordItem[] {
  const GOLDEN_ANGLE = 137.50776405003785 // degrees
  const cx = 50   // % from left
  const cy = 50   // % from top
  const maxR = 48 // % radius; stays within the 100%×100% bounding box

  // Aspect correction: wider than tall, scale x-spread down so it feels balanced.
  const xScale = 0.65
  // Dead-zone around centre where the search card lives.
  const deadZoneX = 22
  const deadZoneY = 14

  // Collision detection: work in a virtual pixel coordinate space.
  // Assuming approx. 1200 × 680 px container (85vh desktop).
  const W = 1200
  const H = 680
  const PX_PER_REM = 16
  // Average character width ≈ 0.52em for a proportional sans-serif
  const CHAR_W_EM = 0.52
  // Minimum gap between words (px)
  const GAP = 6
  type Box = { cx: number; cy: number; hw: number; hh: number }
  const placed: Box[] = []

  function overlaps(box: Box): boolean {
    for (const b of placed) {
      if (
        Math.abs(box.cx - b.cx) < box.hw + b.hw + GAP &&
        Math.abs(box.cy - b.cy) < box.hh + b.hh + GAP
      ) return true
    }
    return false
  }

  const items: WordItem[] = []
  let spiralIndex = 0

  for (let i = 0; i < municipalities.length; i++) {
    const m = municipalities[i]

    // Font size: log-scale of population, clamped to [0.55rem, 2.2rem]
    const pop = Math.max(m.population || 1000, 1000)
    const fsRem = Math.max(0.55, Math.min(2.2, 0.55 + 0.85 * Math.log10(pop / 800)))

    // Sunflower spiral position
    const angle = spiralIndex * GOLDEN_ANGLE * (Math.PI / 180)
    const r = maxR * Math.sqrt(spiralIndex / municipalities.length)
    const rawX = cx + r * xScale * Math.cos(angle)
    const rawY = cy + r * Math.sin(angle)

    // Skip if too close to centre (behind the card)
    const dx = Math.abs(rawX - cx) / xScale
    const dy = Math.abs(rawY - cy)
    if (dx < deadZoneX && dy < deadZoneY) {
      spiralIndex++
      continue
    }

    // Skip if out of safe bounds
    if (rawX < 1 || rawX > 99 || rawY < 1 || rawY > 99) {
      spiralIndex++
      continue
    }

    // Estimated bounding box in virtual px
    const pxX = rawX * W / 100
    const pxY = rawY * H / 100
    const halfW = (m.name.length * fsRem * PX_PER_REM * CHAR_W_EM) / 2
    const halfH = (fsRem * PX_PER_REM) / 2
    const box: Box = { cx: pxX, cy: pxY, hw: halfW, hh: halfH }

    if (overlaps(box)) {
      spiralIndex++
      continue
    }
    placed.push(box)

    const left = rawX
    const top  = rawY

    // Distance from centre as 0–1 (for opacity)
    const distFrac = Math.sqrt(((rawX - cx) / maxR) ** 2 + ((rawY - cy) / maxR) ** 2)
    const opacity = Math.max(0.15, Math.min(0.75, 0.18 + 0.57 * distFrac))

    // Only colorize municipalities with a complete assessment (percentage_rated ≥ 99.9%)
    const isFinished = m.percentage_rated != null && Number(m.percentage_rated) >= 99.9
    const color = isFinished ? scoreToHex(m.score_total) : '#9D9D9C'

    items.push({
      id: m.id,
      name: m.name,
      style: {
        left: `${left}%`,
        top: `${top}%`,
        fontSize: `${fsRem}rem`,
        color,
        opacity: String(opacity),
        transform: `translate(-50%, -50%)`,
        transition: 'none',
      },
    })

    spiralIndex++
  }

  return items
}

onMounted(async () => {
  try {
    const { $directus, $readItems } = useNuxtApp() as any

    // Fetch municipalities with their latest score
    const data: any[] = await $directus.request(
      $readItems('municipalities', {
        limit: 2500,
        sort: ['-population'],
        fields: ['id', 'name', 'population', 'scores.score_total', 'scores.percentage_rated'],
        // no status filter — include all municipalities; unscored ones render gray
      }),
    )

    // Flatten: each municipality → { id, name, population, score_total, percentage_rated }
    const flat = data.map((m: any) => ({
      id: m.id as string,
      name: m.name as string,
      population: Number(m.population) || 0,
      score_total: m.scores?.[0]?.score_total ?? null,
      percentage_rated: m.scores?.[0]?.percentage_rated ?? null,
    }))

    wordItems.value = buildCloudLayout(flat)
  } catch (e) {
    // Silently degrade — the search bar still works without the word cloud
    console.warn('[MunicipalitySearchHero] Could not load municipality word cloud', e)
  }
})
</script>

<style scoped>
.blokkli-block-municipality-search-hero {
  width: 100vw;
  position: relative;
  left: 50%;
  margin-left: -50vw;
}
</style>
