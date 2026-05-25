<template>
  <div>

    <!-- ── Breadcrumbs (always full-width at top) ──────────────────────────── -->
    <nav
      class="flex items-center gap-3 py-3 mb-4 -mx-4 px-4 border-b border-gray-100 sticky z-20 bg-white/90 backdrop-blur-sm"
      :style="`top: ${pillTop}px`"
    >
      <!-- Germany mini-map -->
      <div class="flex-none">
        <GermanyMapIndicator
          v-if="area?.geo_center"
          :lat="area.geo_center.coordinates?.[1] ?? area.geo_center[1]"
          :lon="area.geo_center.coordinates?.[0] ?? area.geo_center[0]"
          :size="34"
        />
      </div>
      <!-- Crumb chain -->
      <ol class="flex items-center gap-1 flex-wrap min-w-0 text-xs">
        <!-- Germany root — only shown when we're not already on the Germany page -->
        <template v-if="area?.level > 1">
          <li>
            <BreadcrumbItem
              label="Deutschland"
              href="/data/bundesrepublik-deutschland"
              :sibling-level="null"
            />
          </li>
          <li class="text-gray-300 select-none">›</li>
        </template>

        <!-- Ancestor chain (Bundesland, optional Kreis) -->
        <template v-for="(crumb, i) in containedBy" :key="crumb.ars || crumb.name">
          <li>
            <BreadcrumbItem
              :label="`${crumb.prefix} ${crumb.name}`.trim()"
              :href="`/data/${areaToSlug(crumb.prefix, crumb.name)}`"
              :sibling-level="crumb.level"
              :ars-prefix="crumb.level === 4 ? crumb.ars.slice(0, 2) : ''"
              :current-ars="area?.ars"
            />
          </li>
          <li class="text-gray-300 select-none">›</li>
        </template>

        <!-- Current area (with dropdown of siblings) -->
        <li>
          <BreadcrumbItem
            :label="`${area?.prefix} ${area?.name}`.trim()"
            is-current
            :sibling-level="area?.level === 1 ? null : area?.level"
            :ars-prefix="area?.level === 4 ? area?.ars?.slice(0, 2) : ''"
            :current-ars="area?.ars"
          />
        </li>
      </ol>
    </nav>

    <!-- ── Overview layout (Germany / Bundesland) ────────────────────────── -->
    <template v-if="area?.level <= 2">
      <AreaOverview :area="area" :contained-by="containedBy" />
    </template>

    <!-- ── Scrollytelling layout (Kreis / Gemeinde) ───────────────────────── -->
    <template v-else>

    <!-- ── Mobile pill nav ─────────────────────────────────────────────────── -->
    <nav
      ref="mobilePillStrip"
      class="xl:hidden sticky z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 -mx-4 px-4 mb-6"
      :style="`top: ${pillTop}px`"
    >
      <div class="flex gap-2 overflow-x-auto py-2 no-scrollbar">
        <a
          v-for="section in allSections"
          :key="section.id"
          :href="`#${section.id}`"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap"
          :class="
            activeSection === section.id
              ? 'bg-[#374151] text-white border-[#374151]'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          "
        >{{ section.label }}</a>
      </div>
    </nav>

    <!-- ── Scrollytelling wrapper ──────────────────────────────────────────── -->
    <!-- items-start removed → default stretch makes right col full-height for sticky -->
    <div class="xl:flex xl:gap-0 -mx-4 sm:-mx-6 xl:mx-0">

      <!-- ── Left column (45%): sidebar + content ────────────────────────── -->
      <div class="xl:w-[45%] xl:max-w-[45%] min-w-0 xl:flex">

        <!-- ── Desktop sidebar nav ──────────────────────────────────────── -->
        <aside class="hidden xl:flex xl:flex-col flex-none w-[172px] border-r border-gray-100 bg-white">
          <nav
            class="sticky flex flex-col p-3 gap-0.5 text-xs overflow-y-auto"
            :style="`top: ${headerHeight}px; max-height: calc(100vh - ${headerHeight}px)`"
          >
            <a
              v-for="section in staticSections"
              :key="section.id"
              :href="`#${section.id}`"
              class="px-2.5 py-1.5 rounded-md transition-colors font-medium truncate"
              :class="activeSection === section.id ? 'bg-[#006e94]/10 text-[#006e94]' : 'text-gray-600 hover:bg-gray-100'"
            >{{ section.label }}</a>
            <template v-for="sg in collectionsBySector" :key="sg.sector">
              <div class="flex items-center gap-1.5 mt-4 mb-0.5 px-1">
                <img
                  v-if="sectorImages[sg.sector]"
                  :src="sectorImages[sg.sector]"
                  class="w-3.5 h-3.5 opacity-50"
                  :alt="sg.label"
                />
                <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">{{ sg.label }}</span>
              </div>
              <a
                v-for="cs in sg.sections"
                :key="cs.id"
                :href="`#${cs.id}`"
                class="pl-4 pr-2 py-1 rounded-md transition-colors text-[11px] font-medium leading-snug truncate"
                :class="activeSection === cs.id ? 'bg-[#006e94]/10 text-[#006e94]' : 'text-gray-600 hover:bg-gray-100'"
              >{{ cs.label }}</a>
            </template>
          </nav>
        </aside>

        <!-- ── Scrollable content ────────────────────────────────────────── -->
        <div class="flex-1 min-w-0 px-4 sm:px-6 xl:px-8">

        <!-- ── Hero (Übersicht) ───────────────────────────────────── -->
        <section
          id="uebersicht"
          class="xl:min-h-[calc(100vh-var(--header-h,80px))] xl:flex xl:flex-col xl:justify-center py-10"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <p class="text-xs font-bold text-[#006e94] uppercase tracking-widest mb-2">{{ area?.prefix }}</p>
          <h1 class="text-5xl xl:text-7xl font-black text-gray-900 leading-none mb-4 xl:mb-6">{{ area?.name }}</h1>

          <dl class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm mb-8">
            <div v-if="area?.population">
              <dt class="text-xs text-gray-500 mb-0.5">Einwohner</dt>
              <dd class="text-2xl font-black text-gray-900 tabular-nums">{{ area.population?.toLocaleString('de-DE') }}</dd>
            </div>
            <div v-if="area?.level">
              <dt class="text-xs text-gray-500 mb-0.5">Verwaltungsebene</dt>
              <dd class="text-2xl font-black text-gray-900">{{ levelLabel(area.level) }}</dd>
            </div>
            <div v-if="area?.ars">
              <dt class="text-xs text-gray-500 mb-0.5">ARS</dt>
              <dd class="text-2xl font-black text-gray-900 tabular-nums">{{ area.ars }}</dd>
            </div>
          </dl>

          <div v-if="slkDataSlug" class="flex gap-3 flex-wrap">
            <NuxtLink
              :to="`/municipalities/${slkDataSlug}`"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#006e94] text-white text-sm font-semibold hover:bg-[#005a7a] transition-colors"
            >
              SLK-Klimabewertung ansehen →
            </NuxtLink>
          </div>

          <!-- Scroll cue (desktop only) -->
          <div v-if="collectionSections.length" class="hidden xl:flex items-center gap-2 mt-10 text-gray-400 text-xs animate-bounce">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
            Klimadaten scrollen
          </div>
        </section>

        <!-- ── Bewertungen (SLK) ──────────────────────────────────── -->
        <section
          v-if="area?.is_reasonable_for_municipal_rating && allCatalogVersions.length"
          id="bewertung"
          class="xl:min-h-[calc(100vh-var(--header-h,80px))] xl:flex xl:flex-col xl:justify-center py-10 border-t border-gray-100"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <h2 class="text-3xl xl:text-5xl font-black text-gray-900 mb-2">Stadt-Land-Klima</h2>
          <p class="text-gray-500 text-sm mb-8">Bewertungen der kommunalen Klimamaßnahmen</p>

          <div class="border border-gray-200 rounded-xl overflow-hidden">
            <!-- Header -->
            <button
              class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              @click="catalogOpen = !catalogOpen"
            >
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span class="text-base font-semibold text-gray-900">Maßnahmen-Bewertungen</span>
                <span class="text-xs text-gray-400 hidden sm:block">
                  ({{ Object.values(municipalityScoresByCatalog).filter(s => s?.percentage_rated >= 98).length }} / {{ allCatalogVersions.length }} vollständig)
                </span>
              </div>
              <svg
                class="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200"
                :class="catalogOpen ? 'rotate-180' : ''"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div v-show="catalogOpen" class="p-4">
              <div class="flex flex-wrap gap-4">
                <div
                  v-for="catalog in allCatalogVersions"
                  :key="catalog.id"
                  class="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col w-full sm:w-64"
                >
                  <div class="p-4 flex flex-col flex-1">
                    <div class="flex flex-col items-center text-center mb-3">
                      <h3 class="text-sm font-semibold text-gray-800 mb-2">{{ catalog.name }}</h3>
                      <div class="flex flex-wrap justify-center gap-1">
                        <span v-if="catalog.isCurrentFrontend" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Momentan gültig
                        </span>
                        <span v-if="catalog.isCurrentBackend" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          Im Bewerten
                        </span>
                      </div>
                    </div>
                    <div class="flex justify-center mb-4">
                      <span
                        v-if="municipalityScoresByCatalog[catalog.id]?.percentage_rated >= 98"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        Vollständig bewertet
                      </span>
                      <span
                        v-else-if="municipalityScoresByCatalog[catalog.id]?.percentage_rated > 0"
                        class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                      >
                        {{ parseFloat(municipalityScoresByCatalog[catalog.id].percentage_rated).toFixed(1) }}% bewertet
                      </span>
                      <span v-else class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        Keine Daten
                      </span>
                    </div>
                    <div class="mt-auto flex justify-center">
                      <CanonicalButton
                        v-if="municipalityScoresByCatalog[catalog.id]?.percentage_rated >= 98 && municipalityScoresByCatalog[catalog.id]?.municipality?.slug"
                        :href="`/municipalities/${municipalityScoresByCatalog[catalog.id].municipality.slug}`"
                        label="Zur Bewertung"
                        color="bright-green"
                        text-color="white"
                        icon-slug="icon_location"
                        icon-size="lg"
                      />
                      <span v-else class="text-sm text-gray-400 text-center italic">Bewertung in Bearbeitung</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Klimadaten scroll steps (grouped by sector) ────────────── -->
        <template v-if="collectionsBySector.length">
          <template v-for="sg in collectionsBySector" :key="sg.sector">
            <!-- Sector divider -->
            <div
              class="flex items-center gap-3 py-5 xl:pt-14 xl:pb-3 border-t-4 border-gray-100"
              :id="`sektor-${sg.sector}`"
              :style="`scroll-margin-top: ${headerHeight + 16}px`"
            >
              <img
                v-if="sectorImages[sg.sector]"
                :src="sectorImages[sg.sector]"
                class="w-7 h-7 opacity-60 flex-none"
                :alt="sg.label"
              />
              <h2 class="text-xl xl:text-2xl font-black text-gray-500 uppercase tracking-widest">{{ sg.label }}</h2>
            </div>
            <!-- Collection steps within this sector -->
            <section
              v-for="cs in sg.sections"
              :key="cs.id"
              :id="cs.id"
              :data-collection-step="cs.collection.id"
              class="xl:min-h-[calc(100vh-var(--header-h,80px))] xl:flex xl:flex-col xl:justify-center py-8 border-t border-gray-100"
              :style="`scroll-margin-top: ${headerHeight + 16}px`"
            >
              <h3 class="text-3xl xl:text-5xl font-black text-gray-900 mb-2 leading-tight">{{ cs.label }}</h3>
              <p
                v-if="cs.collection.description?.['de-DE'] || cs.collection.description?.['en-US']"
                class="text-sm text-gray-500 mb-6 leading-relaxed"
              >{{ cs.collection.description?.['de-DE'] || cs.collection.description?.['en-US'] }}</p>
              <ClientOnly>
                <DataProductPanel
                  :collection="cs.collection"
                  :ars="area.ars"
                  :municipality-name="`${area.prefix} ${area.name}`"
                  :area-boundary="areaBoundaryGeoJson"
                  :nearby-areas="nearbyAreas"
                  :base-url="baseUrl"
                  :hide-map="isDesktop"
                />
                <template #fallback>
                  <div class="h-32 flex items-center justify-center text-gray-400 text-sm">
                    Wird geladen…
                  </div>
                </template>
              </ClientOnly>
            </section>
          </template>
        </template>
        <div v-else-if="!collectionsLoading" class="py-10 text-sm text-gray-400 text-center">
          Keine Klimadatensätze verfügbar.
        </div>

        </div><!-- /.scrollable-content -->
      </div><!-- /.left-column -->

      <!-- ── Right: sticky map panel (desktop only, 55%) ─────────────────── -->
      <div class="hidden xl:block xl:w-[55%] -mr-6">
        <div
          class="sticky overflow-hidden rounded-l-2xl"
          :style="`top: ${headerHeight}px; height: calc(100vh - ${headerHeight}px)`"
        >
          <ClientOnly>
            <DataMapPanel
              :area-boundary="areaBoundaryGeoJson"
              :nearby-areas="nearbyAreas"
              :ars="area.ars"
              :active-collection="activeCollection"
              :base-url="baseUrl"
            />
            <template #fallback>
              <div class="h-full w-full bg-gray-100 animate-pulse" />
            </template>
          </ClientOnly>
        </div>
      </div>

    </div>

    </template><!-- end scrollytelling -->
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useHeaderHeight } from '~/composables/useHeaderHeight.js'
import { useMobileHeaderHidden } from '~/composables/useMobileHeaderHidden.js'
import { resolveSlugToArea, fetchContainedBy, areaToSlug } from '~/composables/useAreaBySlug.js'
import { getAllCatalogVersions } from '~/composables/getAllCatalogVersions.js'
import { readItems } from '@directus/sdk'
import sectorImages from '~/shared/sectorImages.js'

// ── Route + config ───────────────────────────────────────────────────────────

const route = useRoute()
const router = useRouter()
const slug = route.params.slug

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.public.stadtlandzahlRestUrl
  || runtimeConfig.public.stadtlandzahlUrl.replace('/graphql/', '').replace('/graphql', '')

// ── Nuxt app plugins ─────────────────────────────────────────────────────────

const { $stadtlandzahlAPI, $directus, $readItems, $apollo } = useNuxtApp()

// ── Layout helpers ───────────────────────────────────────────────────────────

const headerHeight = useHeaderHeight()
const mobileHeaderHidden = useMobileHeaderHidden()
const isDesktop = useState('layout-isDesktop')

const pillTop = computed(() =>
  isDesktop.value ? headerHeight.value : (mobileHeaderHidden.value ? 0 : 64)
)

// ── Section nav ──────────────────────────────────────────────────────────────

const staticSections = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'bewertung', label: 'Bewertungen' },
]

const activeSection = ref('uebersicht')
const mobilePillStrip = ref(null)
let sectionObserver = null

watch(activeSection, (id) => {
  if (!id || !mobilePillStrip.value) return
  const pill = mobilePillStrip.value.querySelector(`[href="#${id}"]`)
  if (pill) pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
})

function scrollToSection(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

function initObserver() {
  if (sectionObserver) {
    sectionObserver.disconnect()
    sectionObserver = null
  }
  const sectionEls = allSections.value.map(s => document.getElementById(s.id)).filter(Boolean)
  if (!sectionEls.length) return
  sectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activeSection.value = entry.target.id
      }
    },
    { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
  )
  sectionEls.forEach(el => sectionObserver.observe(el))
}

// Re-init observer when collection sections mount (client-side)
// (watch registered after allSections is defined, below)

onMounted(() => {
  setTimeout(() => {
    initObserver()
    initCollectionStepObserver()
  }, 200)
})

onUnmounted(() => {
  sectionObserver?.disconnect()
  collectionStepObserver?.disconnect()
})

// ── Main data (SSR) ──────────────────────────────────────────────────────────

const { data: pageData } = await useAsyncData(
  `data-${slug}`,
  async () => {
    // 1. Resolve slug to area
    const resolvedArea = await resolveSlugToArea(slug)
    if (!resolvedArea) return { notFound: true }

    const ars = resolvedArea.ars
    const lat = resolvedArea.geo_center?.coordinates?.[1] ?? resolvedArea.geo_center?.[1]
    const lon = resolvedArea.geo_center?.coordinates?.[0] ?? resolvedArea.geo_center?.[0]

    // 2. Parallel fetches: breadcrumbs + nearby areas
    const [containedByChain, nearbyResult] = await Promise.allSettled([
      fetchContainedBy(ars, resolvedArea.level, $apollo),
      (lat && lon)
        ? $stadtlandzahlAPI.getNearbyAdministrativeAreas(lat, lon, 40, [4, 5, 6])
        : Promise.resolve([]),
    ])

    return {
      area: resolvedArea,
      containedBy: containedByChain.status === 'fulfilled' ? containedByChain.value : [],
      nearbyAreas: nearbyResult.status === 'fulfilled' ? (nearbyResult.value ?? []) : [],
    }
  }
)

if (!pageData.value || pageData.value.notFound) {
  throw createError({ statusCode: 404, statusMessage: 'Gebiet nicht gefunden' })
}

const area = computed(() => pageData.value?.area ?? {})
const containedBy = computed(() => pageData.value?.containedBy ?? [])
const nearbyAreas = computed(() => pageData.value?.nearbyAreas ?? [])

// Collections — fetched client-side only (REST API at localhost:8070 not reachable from SSR Docker container)
const { data: collectionsData, pending: collectionsLoading } = await useAsyncData(
  'stadtlandzahl-collections',
  () => $fetch(`${baseUrl}/api/collections/`)
    .then(d => (d?.collections ?? []).filter(c => c.id !== 'administrative-areas'))
    .catch(() => []),
  { server: false }
)
const collections = computed(() => collectionsData.value ?? [])

const collectionSections = computed(() =>
  collections.value.map(col => ({
    id: `daten-${col.id}`,
    label: col.title?.['de-DE'] || col.title?.['en-US'] || col.id,
    collection: col,
  }))
)

const allSections = computed(() => [...staticSections, ...collectionSections.value])

// ── Sector grouping ───────────────────────────────────────────────────────────────────────

const COLLECTION_SECTORS = {
  'wind-turbines':           'energy',
  'solar-plants':            'energy',
  'rooftop-solar-plants':    'energy',
  'balkonkraftwerk':         'energy',
  'batteriespeicher':        'energy',
  'ev-charging-stations':    'transport',
  'public-transport-scores': 'transport',
  'cycleway-infrastructure':  'transport',
  'traffic-calmed-downtown':  'transport',
  'population-density':       'management',
  'climate-region-type':      'management',
  'stadtlandklima':           'management',
  'town-greenness':           'agriculture',
}

const SECTOR_ORDER = ['energy', 'transport', 'agriculture', 'management']

const SECTOR_LABELS = {
  energy:      'Energie',
  transport:   'Mobilität',
  agriculture: 'Grün & Natur',
  management:  'Klima & Daten',
}

const collectionsBySector = computed(() => {
  const grouped = {}
  for (const cs of collectionSections.value) {
    const sector = COLLECTION_SECTORS[cs.collection.id] ?? 'other'
    if (!grouped[sector]) grouped[sector] = []
    grouped[sector].push(cs)
  }
  const result = SECTOR_ORDER
    .filter(s => grouped[s])
    .map(s => ({ sector: s, label: SECTOR_LABELS[s] ?? s, sections: grouped[s] }))
  if (grouped['other']?.length) {
    result.push({ sector: 'other', label: 'Sonstige', sections: grouped['other'] })
  }
  return result
})

// ── Active collection tracking (for sticky map panel) ────────────────────────

const activeCollectionId = ref(null)
const activeCollection = computed(() =>
  collections.value.find(c => c.id === activeCollectionId.value) ?? null
)
let collectionStepObserver = null

function initCollectionStepObserver() {
  if (collectionStepObserver) {
    collectionStepObserver.disconnect()
    collectionStepObserver = null
  }
  const steps = document.querySelectorAll('[data-collection-step]')
  if (!steps.length) return
  collectionStepObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeCollectionId.value = entry.target.dataset.collectionStep
        }
      }
    },
    { rootMargin: '-10% 0px -50% 0px', threshold: 0 }
  )
  steps.forEach(el => collectionStepObserver.observe(el))
}

// Re-init both observers when collection sections arrive (client-side, after collections load)
watch(collectionSections, () => nextTick(() => {
  initObserver()
  initCollectionStepObserver()
}))

// ── Catalog scores (Directus, client-side) ───────────────────────────────────

const allCatalogVersions = ref([])
const municipalityScoresByCatalog = ref({})
const catalogOpen = ref(false)
const municipalityDirectusData = ref(null)

async function fetchAllMunicipalityScores(ars) {
  const scores = {}
  try {
    const municipalities = await $directus.request(readItems('municipalities', {
      fields: ['id', 'slug', 'name', 'ars', 'localteam_id', 'status'],
      filter: { ars: { _eq: ars } },
      limit: 1,
    }))
    if (!municipalities?.length) return scores

    const municipality = municipalities[0]
    municipalityDirectusData.value = municipality

    const scorePromises = allCatalogVersions.value.map(async (catalog) => {
      try {
        const municipalityScores = await $directus.request(readItems('municipality_scores', {
          fields: ['*'],
          filter: {
            municipality: { _eq: municipality.id },
            catalog_version: { _eq: catalog.id },
          },
          limit: 1,
        }))
        return {
          catalogId: catalog.id,
          data: municipalityScores?.[0]
            ? { ...municipalityScores[0], municipality }
            : null,
        }
      } catch (_) {
        return { catalogId: catalog.id, data: null }
      }
    })

    const results = await Promise.all(scorePromises)
    for (const { catalogId, data } of results) {
      scores[catalogId] = data
    }
  } catch (_) {}
  return scores
}

onMounted(async () => {
  const ars = area.value?.ars
  if (!ars) return

  try {
    allCatalogVersions.value = await getAllCatalogVersions($directus, $readItems)
    municipalityScoresByCatalog.value = await fetchAllMunicipalityScores(ars)
  } catch (_) {}
})

// ── Area geometry (for map boundary in panel) ─────────────────────────────────

const areaBoundaryGeoJson = computed(() => {
  const geoArea = area.value?.geo_area
  if (!geoArea) return null
  if (typeof geoArea === 'object') return geoArea
  try { return JSON.parse(geoArea) } catch (_) { return null }
})

// ── SLK data product slug ─────────────────────────────────────────────────────

const slkDataSlug = computed(() => {
  const dataAll = area.value?.stadtlandklima_data_all
  if (!dataAll?.length) return null
  return dataAll[0]?.slug ?? null
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function levelLabel(level) {
  const map = {
    1: 'Bundesrepublik',
    2: 'Bundesland',
    3: 'Regierungsbezirk',
    4: 'Kreis / Kreisfreie Stadt',
    5: 'Verbandsgemeinde',
    6: 'Gemeinde',
  }
  return map[level] ?? `Ebene ${level}`
}

// ── SEO ───────────────────────────────────────────────────────────────────────

useHead({
  title: computed(() =>
    area.value?.name
      ? `${area.value.prefix} ${area.value.name} – Klimadaten`
      : 'Klimadaten'
  ),
  meta: [
    {
      name: 'description',
      content: computed(() =>
        area.value?.name
          ? `Klimadaten und Maßnahmen-Bewertungen für ${area.value.prefix} ${area.value.name}.`
          : 'Klimadaten für Kommunen und Regionen in Deutschland.'
      ),
    },
  ],
})
</script>
