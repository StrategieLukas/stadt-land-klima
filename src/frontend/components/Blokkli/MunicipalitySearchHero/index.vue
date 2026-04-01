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
        <div class="w-full backdrop-blur-md bg-black/50 border border-white/10 rounded-2xl shadow-2xl px-6 py-8 sm:px-10 sm:py-10">
          <h2
            v-if="props.title || isEditing"
            v-blokkli-editable:title
            class="text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight"
            v-text="props.title"
          />
          <p
            v-if="props.subtitle || isEditing"
            v-blokkli-editable:subtitle
            class="text-slate-300 mb-6 text-sm sm:text-base"
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
      default: 'dark',
      options: {
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
  return options.value.background === 'brand' ? 'bg-stats-dark' : 'bg-slate-900'
})

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
  municipalities: Array<{ id: string; name: string; population: number; score_total: number | null }>,
): WordItem[] {
  const GOLDEN_ANGLE = 137.50776405003785 // degrees
  const cx = 50   // % from left
  const cy = 50   // % from top
  const maxR = 48 // % radius; stays within the 100%×100% bounding box

  // Aspect correction: the section is wider than tall (~16:9 ish), so horizontal
  // spread needs less radius to feel balanced. We scale x by 0.65.
  const xScale = 0.65
  // Dead-zone around centre where the search card lives (~24% × 14%).
  const deadZoneX = 20
  const deadZoneY = 12

  const items: WordItem[] = []
  let spiralIndex = 0

  for (let i = 0; i < municipalities.length; i++) {
    const m = municipalities[i]

    // Font size: log-scale of population, clamped to [0.55rem, 2.2rem]
    const pop = Math.max(m.population || 1000, 1000)
    const fsRem = Math.max(0.55, Math.min(2.2, 0.55 + 0.85 * Math.log10(pop / 800)))

    // Sunflower spiral position
    const angle = spiralIndex * GOLDEN_ANGLE * (Math.PI / 180)
    // r grows with sqrt(spiralIndex) to fill area uniformly
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

    // Keep in bounds
    const left = Math.max(1, Math.min(97, rawX))
    const top  = Math.max(1, Math.min(97, rawY))

    // Distance from centre as 0–1 (for opacity)
    const distFrac = Math.sqrt(((rawX - cx) / maxR) ** 2 + ((rawY - cy) / maxR) ** 2)
    const opacity = Math.max(0.15, Math.min(0.75, 0.18 + 0.57 * distFrac))

    // Subtle rotation for a natural scattered feel
    const rotation = ((spiralIndex * 31) % 11) - 5 // -5 … +5 deg

    const color = scoreToHex(m.score_total)

    items.push({
      id: m.id,
      name: m.name,
      style: {
        left: `${left}%`,
        top: `${top}%`,
        fontSize: `${fsRem}rem`,
        color,
        opacity: String(opacity),
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
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
        fields: ['id', 'name', 'population', 'scores.score_total'],
        filter: { status: { _eq: 'published' } },
      }),
    )

    // Flatten: each municipality → { id, name, population, score_total }
    const flat = data.map((m: any) => ({
      id: m.id as string,
      name: m.name as string,
      population: Number(m.population) || 0,
      score_total: m.scores?.[0]?.score_total ?? null,
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
