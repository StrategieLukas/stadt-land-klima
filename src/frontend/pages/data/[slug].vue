<template>
  <div>
    <!-- ── Mobile sticky pill nav ──────────────────────────────────────────── -->
    <nav
      ref="mobilePillStrip"
      class="xl:hidden sticky z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 -mx-4 px-4 mb-6"
      :style="`top: ${pillTop}px`"
    >
      <div class="flex gap-2 overflow-x-auto py-2 no-scrollbar">
        <a
          v-for="section in sections"
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

    <!-- ── Page body: sidebar + content ───────────────────────────────────── -->
    <div class="flex gap-8 items-start">

      <!-- Desktop sidebar -->
      <aside
        class="hidden xl:flex flex-col w-52 flex-shrink-0 sticky self-start text-sm gap-6"
        :style="`top: ${headerHeight + 12}px`"
      >
        <!-- Section nav -->
        <nav class="flex flex-col gap-1">
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            class="px-3 py-1.5 rounded-lg transition-colors font-medium"
            :class="
              activeSection === section.id
                ? 'bg-[#006e94]/10 text-[#006e94]'
                : 'text-gray-600 hover:bg-gray-100'
            "
          >{{ section.label }}</a>
        </nav>

        <!-- Collection list (desktop sidebar) -->
        <div v-if="collections.length" class="border-t border-gray-200 pt-4">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-3">Datensätze</p>
          <button
            v-for="col in collections"
            :key="col.id"
            class="w-full text-left px-3 py-1.5 rounded-lg transition-colors text-xs font-medium"
            :class="
              selectedCollectionSlug === col.id
                ? 'bg-[#006e94]/10 text-[#006e94]'
                : 'text-gray-600 hover:bg-gray-100'
            "
            @click="selectedCollectionSlug = col.id; scrollToSection('daten')"
          >{{ col.title?.['de-DE'] || col.title?.['en-US'] || col.id }}</button>
        </div>
      </aside>

      <!-- Main content -->
      <div class="flex-1 min-w-0 space-y-12">

        <!-- ── Übersicht ───────────────────────────────────────────────── -->
        <section
          id="uebersicht"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <!-- Breadcrumbs -->
          <div class="breadcrumbs bg-gray-50 px-3 sm:px-4 py-3 text-sm -mx-4 sm:mx-0 sm:rounded mb-4">
            <ul class="flex flex-row flex-wrap items-center gap-1 min-w-0">
              <li class="flex items-center gap-1 text-gray-400 text-xs">
                <NuxtLink to="/" class="hover:text-[#006e94] transition-colors">Start</NuxtLink>
              </li>
              <template v-for="crumb in containedBy" :key="crumb.ars || crumb.name">
                <li class="text-gray-300 text-xs">›</li>
                <li class="text-xs text-gray-400">{{ crumb.name }}</li>
              </template>
              <li class="text-gray-300 text-xs">›</li>
              <li class="text-xs font-semibold text-gray-700 truncate">{{ area.prefix }} {{ area.name }}</li>
            </ul>
          </div>

          <!-- Hero card -->
          <div class="bg-gradient-to-r from-[#006e94]/10 to-blue-50 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row gap-6 items-start">
            <!-- Text info -->
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-[#006e94] uppercase tracking-wide mb-1">{{ area.prefix }}</p>
              <h1 class="text-h2 font-bold text-gray-900 leading-tight mb-3">{{ area.name }}</h1>
              <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                <div v-if="area.population">
                  <dt class="text-xs text-gray-500">Einwohner</dt>
                  <dd class="font-semibold text-gray-900">{{ area.population?.toLocaleString('de-DE') }}</dd>
                </div>
                <div v-if="area.level">
                  <dt class="text-xs text-gray-500">Verwaltungsebene</dt>
                  <dd class="font-semibold text-gray-900">{{ levelLabel(area.level) }}</dd>
                </div>
                <div v-if="slkDataSlug">
                  <dt class="text-xs text-gray-500">SLK-Profil</dt>
                  <dd>
                    <NuxtLink
                      :to="`/municipalities/${slkDataSlug}`"
                      class="text-[#006e94] font-semibold hover:underline text-xs"
                    >Zur Bewertung →</NuxtLink>
                  </dd>
                </div>
              </dl>
            </div>
            <!-- Germany map indicator -->
            <div class="flex-shrink-0">
              <GermanyMapIndicator
                v-if="area.geo_center"
                :lat="area.geo_center.coordinates?.[1] ?? area.geo_center[1]"
                :lon="area.geo_center.coordinates?.[0] ?? area.geo_center[0]"
                :size="100"
              />
            </div>
          </div>
        </section>

        <!-- ── Bewertungen (SLK) ──────────────────────────────────────── -->
        <section
          v-if="area.is_reasonable_for_municipal_rating && allCatalogVersions.length"
          id="bewertung"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <h2 class="text-h3 font-bold text-gray-900 mb-4">Stadt-Land-Klima Bewertungen</h2>

          <div
            class="border border-gray-200 rounded-xl overflow-hidden"
          >
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

        <!-- ── Daten (collections) ───────────────────────────────────── -->
        <section
          id="daten"
          :style="`scroll-margin-top: ${headerHeight + 16}px`"
        >
          <h2 class="text-h3 font-bold text-gray-900 mb-4">Klimadaten</h2>

          <!-- Collection switcher pills (mobile + tablet) -->
          <div v-if="collections.length" class="xl:hidden flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
            <button
              v-for="col in collections"
              :key="col.id"
              class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap"
              :class="
                selectedCollectionSlug === col.id
                  ? 'bg-[#006e94] text-white border-[#006e94]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#006e94]/50'
              "
              @click="selectedCollectionSlug = col.id"
            >{{ col.title?.['de-DE'] || col.title?.['en-US'] || col.id }}</button>
          </div>

          <!-- Selected collection title + description -->
          <template v-if="selectedCollection">
            <div class="mb-4">
              <h3 class="text-lg font-bold text-gray-900">{{ selectedCollection.title?.['de-DE'] || selectedCollection.title?.['en-US'] || selectedCollection.id }}</h3>
              <p v-if="selectedCollection.description?.['de-DE'] || selectedCollection.description?.['en-US']" class="text-sm text-gray-500 mt-1">{{ selectedCollection.description?.['de-DE'] || selectedCollection.description?.['en-US'] }}</p>
            </div>

            <!-- Panel -->
            <ClientOnly>
              <DataProductPanel
                :collection="selectedCollection"
                :ars="area.ars"
                :municipality-name="`${area.prefix} ${area.name}`"
                :area-boundary="areaBoundaryGeoJson"
                :nearby-areas="nearbyAreas"
                :base-url="baseUrl"
              />
              <template #fallback>
                <div class="h-40 flex items-center justify-center text-gray-400 text-sm">
                  Wird geladen…
                </div>
              </template>
            </ClientOnly>
          </template>

          <div v-else-if="!collections.length" class="text-sm text-gray-400 py-8 text-center">
            Keine Datensätze verfügbar.
          </div>
        </section>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useHeaderHeight } from '~/composables/useHeaderHeight.js'
import { useMobileHeaderHidden } from '~/composables/useMobileHeaderHidden.js'
import { resolveSlugToArea, fetchContainedBy, areaToSlug } from '~/composables/useAreaBySlug.js'
import { getAllCatalogVersions } from '~/composables/getAllCatalogVersions.js'
import { readItems } from '@directus/sdk'

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

const sections = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'bewertung', label: 'Bewertungen' },
  { id: 'daten', label: 'Klimadaten' },
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

onMounted(() => {
  setTimeout(() => {
    const sectionEls = document.querySelectorAll('[id^="uebersicht"],[id^="bewertung"],[id^="daten"]')
    if (!sectionEls.length) return
    sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) activeSection.value = entry.target.id
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )
    sectionEls.forEach(s => sectionObserver.observe(s))
  }, 100)
})

onUnmounted(() => sectionObserver?.disconnect())

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
const { data: collectionsData } = await useAsyncData(
  'stadtlandzahl-collections',
  () => $fetch(`${baseUrl}/api/collections/`)
    .then(d => (d?.collections ?? []).filter(c => c.id !== 'administrative-areas'))
    .catch(() => []),
  { server: false }
)
const collections = computed(() => collectionsData.value ?? [])

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

// ── Selected collection ───────────────────────────────────────────────────────

const selectedCollectionSlug = ref(null)

watch(
  collections,
  (cols) => {
    if (cols.length && !selectedCollectionSlug.value) {
      selectedCollectionSlug.value = cols[0]?.id ?? null
    }
  },
  { immediate: true }
)

const selectedCollection = computed(() =>
  collections.value.find(c => c.id === selectedCollectionSlug.value) ?? null
)

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
