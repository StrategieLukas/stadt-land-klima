<template>
  <div>

    <!-- ── Sticky breadcrumb nav ──────────────────────────────────────────── -->
    <nav
      class="sticky z-30"
      :style="`top: ${pillTop}px`"
    >
      <!-- Full-viewport background: bleeds past the max-w container via negative offsets.
           No z-index needed — DOM order ensures content div (below) paints on top. -->
      <div
        class="absolute bg-white/90 backdrop-blur-sm border-b border-gray-100"
        style="top: 0; bottom: 0; left: calc((100% - 100vw) / 2); right: calc((100% - 100vw) / 2);"
      />
      <div class="relative flex items-center gap-3 py-2 min-w-0">
        <div class="flex-none">
          <GermanyMapIndicator
            v-if="area?.geo_center"
            :lat="area.geo_center.coordinates?.[1] ?? area.geo_center[1]"
            :lon="area.geo_center.coordinates?.[0] ?? area.geo_center[0]"
            :size="30"
          />
        </div>
        <ol class="flex items-center gap-1 flex-wrap min-w-0 text-xs">
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
          <template v-for="crumb in containedBy" :key="crumb.ars || crumb.name">
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
      </div>
    </nav>

    <!-- ── Overview layout (Germany / Bundesland) ────────────────────────── -->
    <template v-if="area?.level <= 2">
      <AreaOverview :area="area" :contained-by="containedBy" />
    </template>

    <!-- ── Scrollytelling layout (Kreis / Gemeinde) ───────────────────────── -->
    <template v-else>

      <!-- ── Hero (Übersicht) ─────────────────────────────────────────────── -->
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

        <!-- CTAs -->
        <div class="flex gap-3 flex-wrap items-center">
          <!-- Explore scroll CTA -->
          <button
            v-if="collections.length"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#006e94] text-white text-sm font-semibold hover:bg-[#005a7a] transition-colors"
            @click="scrollToExplore"
          >
            <svg class="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
            </svg>
            Erkunden
          </button>

          <!-- Grid overview CTA -->
          <button
            v-if="collections.length"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#006e94] text-[#006e94] text-sm font-semibold hover:bg-[#006e94]/5 transition-colors"
            @click="overviewOpen = true"
          >
            <!-- Grid icon -->
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Übersicht aller Daten
          </button>

          <NuxtLink
            v-if="slkDataSlug"
            :to="`/municipalities/${slkDataSlug}`"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            SLK-Klimabewertung →
          </NuxtLink>
        </div>
      </section>

      <!-- ── Bewertungen (SLK) ────────────────────────────────────────────── -->
      <section
        v-if="area?.is_reasonable_for_municipal_rating && allCatalogVersions.length"
        id="bewertung"
        class="py-10 border-t border-gray-100"
        :style="`scroll-margin-top: ${headerHeight + 16}px`"
      >
        <h2 class="text-3xl xl:text-5xl font-black text-gray-900 mb-2">Stadt-Land-Klima</h2>
        <p class="text-gray-500 text-sm mb-8">Bewertungen der kommunalen Klimamaßnahmen</p>

        <div class="border border-gray-200 rounded-xl overflow-hidden">
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

      <!-- ── Collection explore scroll ────────────────────────────────────── -->
      <section
        id="klimadaten"
        ref="exploreSection"
        class="py-6 border-t border-gray-100"
        :style="`scroll-margin-top: ${headerHeight + 16}px`"
      >
        <div v-if="collectionsLoading" class="flex items-center gap-2 py-10 text-gray-400 text-sm">
          <SlkFlowerSpinner :size="20" />
          Datensätze werden geladen…
        </div>

        <div v-else-if="collections.length" class="space-y-6">
          <CollectionPreviewCard
            v-for="col in collections"
            :key="col.id"
            :collection="col"
            :area-slug="slug"
            :ars="area?.ars ?? ''"
            :base-url="baseUrl"
            :population="area?.population ?? null"
          />
        </div>

        <div v-else class="py-10 text-sm text-gray-400 text-center">
          Keine Klimadatensätze verfügbar.
        </div>
      </section>

    </template><!-- end scrollytelling -->

    <!-- ── Grid overview modal ───────────────────────────────────────────── -->
    <CollectionOverviewModal
      v-if="overviewOpen"
      :collections="collections"
      :area-slug="slug"
      @close="overviewOpen = false"
      @select="scrollToCollection"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useHeaderHeight } from '~/composables/useHeaderHeight.js'
import { useMobileHeaderHidden } from '~/composables/useMobileHeaderHidden.js'
import { resolveSlugToArea, fetchContainedBy, areaToSlug } from '~/composables/useAreaBySlug.js'
import { getAllCatalogVersions } from '~/composables/getAllCatalogVersions.js'
import { readItems } from '@directus/sdk'

// ── Route + config ───────────────────────────────────────────────────────────

const route = useRoute()
const slug = route.params.slug

const runtimeConfig = useRuntimeConfig()
const baseUrl = runtimeConfig.public.stadtlandzahlBaseUrl

// ── Nuxt app plugins ─────────────────────────────────────────────────────────

const { $directus, $readItems } = useNuxtApp()

// ── Layout helpers ───────────────────────────────────────────────────────────

const headerHeight = useHeaderHeight()
const mobileHeaderHidden = useMobileHeaderHidden()
const isDesktop = useState('layout-isDesktop')

const pillTop = computed(() =>
  isDesktop.value ? headerHeight.value : (mobileHeaderHidden.value ? 0 : 64)
)

// ── Main data (SSR) ──────────────────────────────────────────────────────────

const { data: pageData } = await useAsyncData(
  `data-${slug}`,
  async () => {
    const resolvedArea = await resolveSlugToArea(slug)
    if (!resolvedArea) return { notFound: true }
    const ars = resolvedArea.ars
    const containedByChain = await fetchContainedBy(ars, resolvedArea.level).catch(() => [])
    return { area: resolvedArea, containedBy: containedByChain ?? [] }
  }
)

if (!pageData.value || pageData.value.notFound) {
  throw createError({ statusCode: 404, statusMessage: 'Gebiet nicht gefunden' })
}

const area = computed(() => pageData.value?.area ?? {})
const containedBy = computed(() => pageData.value?.containedBy ?? [])

// ── Collections (CSR, area-injected) ────────────────────────────────────────

const { data: collectionsData, pending: collectionsLoading } = await useAsyncData(
  `stadtlandzahl-collections-${area.value?.ars ?? 'all'}`,
  () => {
    const params = area.value?.ars ? { area: area.value.ars } : {}
    return $fetch(`${baseUrl}/api/collections/`, { params })
      .then(d => (d?.collections ?? []).filter(c => c.id !== 'administrative-areas'))
      .catch(() => [])
  },
  { server: false }
)
const collections = computed(() => collectionsData.value ?? [])

// ── Modal + explore scroll ───────────────────────────────────────────────────

const overviewOpen  = ref(false)
const exploreSection = ref(null)

function scrollToExplore() {
  const offset = headerHeight.value + 16
  const el = exploreSection.value?.$el ?? exploreSection.value
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - offset
  window.scrollTo({ top, behavior: 'smooth' })
}

function scrollToCollection(collectionId) {
  const el = document.querySelector(`[data-collection-id="${collectionId}"]`)
  if (!el) return
  const offset = headerHeight.value + 16
  const top = el.getBoundingClientRect().top + window.scrollY - offset
  window.scrollTo({ top, behavior: 'smooth' })
}

// ── Catalog scores (Directus, client-side) ───────────────────────────────────

const allCatalogVersions = ref([])
const municipalityScoresByCatalog = ref({})
const catalogOpen = ref(false)

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

// ── SLK data product slug ────────────────────────────────────────────────────

const slkDataSlug = computed(() => {
  const dataAll = area.value?.stadtlandklima_data_all
  if (!dataAll?.length) return null
  return dataAll[0]?.slug ?? null
})

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── SEO ──────────────────────────────────────────────────────────────────────

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
