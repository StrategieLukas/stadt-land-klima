<template>
  <div>
    <header class="container mx-auto px-4 py-8">
      <h1 class="mb-4 font-heading text-4xl font-black text-stats-dark sm:text-6xl">{{ $t('data.overview.title') }}</h1>
      <p class="max-w-3xl text-lg leading-relaxed text-gray">{{ $t('data.overview.intro') }}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        <CanonicalButton :label="$t('data.overview.explore_map')" href="#data-map" icon-slug="mdi:map-outline" color="dark" />
        <CanonicalButton :label="$t('data.overview.collections')" href="#data-collections" icon-slug="mdi:view-grid-outline" color="dark" />
      </div>
    </header>

    <!-- ── Sticky breadcrumb nav ──────────────────────────────────────────── -->
    <nav
      ref="breadcrumbNav"
      class="sticky z-30"
      :style="`top: ${pillTop}px`"
    >
      <div
        class="absolute bg-white/90 backdrop-blur-sm border-b border-gray-100"
        :class="{ 'border-t': !breadcrumbStuck || pillTop === 0 }"
        style="top: 0; bottom: 0; left: calc((100% - 100vw) / 2); right: calc((100% - 100vw) / 2);"
      />
      <div class="relative flex items-center gap-3 py-2 min-w-0">
        <div class="flex-none">
          <GermanyMapIndicator
            :lat="indicatorCenter.lat"
            :lon="indicatorCenter.lon"
            :size="30"
          />
        </div>
        <ol class="flex items-center gap-1 flex-wrap min-w-0 text-xs">
          <template v-if="selectedState">
            <li>
              <BreadcrumbItem
                label="Deutschland"
                href="/data"
                :sibling-level="null"
              />
            </li>
            <li class="text-gray-300 select-none">›</li>
            <li>
              <BreadcrumbItem
                :label="`${selectedState.prefix} ${selectedState.name}`.trim()"
                is-current
                :sibling-level="null"
              />
            </li>
          </template>
          <template v-else>
            <li>
              <BreadcrumbItem
                label="Deutschland"
                is-current
                :sibling-level="null"
              />
            </li>
          </template>
        </ol>
      </div>
    </nav>

    <AreaOverview
      id="data-map"
      :area="GERMANY_AREA"
      :contained-by="[]"
      :initial-state-ars="initialStateArs"
      @state-selected="onStateSelected"
      @state-exited="onStateExited"
    />

    <section id="data-collections" class="container mx-auto px-4 py-12">
      <h2 class="mb-4 font-heading text-3xl font-bold text-stats-dark">{{ $t('data.overview.collections') }}</h2>
      <p class="mb-8 max-w-3xl text-base leading-relaxed text-gray">{{ $t('data.overview.about') }}</p>
      <template v-if="visibleCollections.length">
        <div class="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
          <template v-for="(collection, index) in visibleCollections" :key="collection.id">
            <DataProductsOverviewGridCard
              :collection="collection"
              :ars="''"
              :base-url="runtimeConfig.public.stadtlandzahlBaseUrl"
              :show-kpi="false"
              :expanded="selectedCollectionId === collection.id"
              :style="{ order: index * 2 }"
              @select="selectCollection(collection.id)"
            />
            <article v-if="selectedCollectionId === collection.id && expandedCollection" id="data-collection-detail" class="data-collection-detail col-span-full scroll-mt-24 rounded-lg border border-solid-stats-dark-20 bg-white p-5 shadow-sm sm:p-8" :style="detailOrder(index)">
              <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
                <h3 class="font-heading text-3xl font-bold text-stats-dark">{{ collectionText(expandedCollection.title) || expandedCollection.id }}</h3>
                <CanonicalButton :label="$t('generic.close')" color="dark" @click="selectedCollectionId = null" />
              </div>
              <p v-if="collectionText(expandedCollection.description)" class="max-w-3xl leading-relaxed text-gray">{{ collectionText(expandedCollection.description) }}</p>
              <p v-if="detailLoading" class="mt-4 text-gray">{{ $t('generic.loading') }}</p>
              <p v-else-if="detailError" class="mt-4 text-gray">{{ $t('generic.loading_error') }}</p>
              <div v-if="narrativeDescriptions.length" class="mt-6 grid gap-5 md:grid-cols-2">
                <section v-for="step in narrativeDescriptions" :key="step.index">
                  <h4 class="mb-1 font-heading text-xl font-bold text-stats-dark">{{ collectionText(step.title) }}</h4>
                  <p class="leading-relaxed text-gray">{{ collectionText(step.description) }}</p>
                </section>
              </div>
              <div v-if="overviewVisuals.length" class="mt-8 grid gap-6 lg:grid-cols-2">
                <figure v-for="visual in overviewVisuals" :key="visual.plot_id" class="overflow-hidden rounded-lg border border-solid-stats-dark-20">
                  <img :src="overviewImageUrl(visual.image_url)" :alt="collectionText(visual.alt) || overviewVisualTitle(visual)" class="h-auto w-full" loading="lazy" />
                  <figcaption class="space-y-1 p-4">
                    <h4 class="font-heading text-xl font-bold text-stats-dark">{{ overviewVisualTitle(visual) }}</h4>
                    <p v-if="overviewVisualDescription(visual)" class="text-sm leading-relaxed text-gray">{{ overviewVisualDescription(visual) }}</p>
                    <small v-if="collectionText(visual.attribution)" class="text-gray">{{ collectionText(visual.attribution) }}</small>
                  </figcaption>
                </figure>
              </div>
            </article>
          </template>
          <DataProductsComingSoonTile
            :collection-count="visibleCollections.length"
            :style="{ order: visibleCollections.length * 2 }"
          />
        </div>
      </template>
      <p v-else class="text-gray">{{ $t('data.overview.unavailable') }}</p>
    </section>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import DataProductsComingSoonTile from '~/components/DataProductsComingSoonTile.vue'
import { useHeaderHeight } from '~/composables/useHeaderHeight.js'
import { useMobileHeaderHidden } from '~/composables/useMobileHeaderHidden.js'
import { DEFAULT_DATA_PAGE_CONFIG, isCollectionVisible, normalizeDataPageConfig } from '~/utils/dataPageVisibility'
import { normalizeCollection } from '~/utils/dataProducts'
import statesLookup from '~/assets/germany-states-lookup.json'

const { $directus, $readSingleton, $t, $locale } = useNuxtApp()
const runtimeConfig = useRuntimeConfig()
const route = useRoute()
const router = useRouter()

const { data: visibleCollections } = await useAsyncData('data-overview-collections', async () => {
  const config = await $directus.request($readSingleton('data_page_config', { fields: ['include_only', 'collection_ids'] }))
    .then(normalizeDataPageConfig)
    .catch(() => DEFAULT_DATA_PAGE_CONFIG)
  try {
    const manifest = await $fetch(`${runtimeConfig.public.stadtlandzahlBaseUrl}/api/manifests/collections-index`, { timeout: 8000 })
    return (manifest?.collections ?? [])
      .filter((collection) => isCollectionVisible(collection.id, config))
      .map(normalizeCollection)
  } catch {
    return []
  }
}, { default: () => [] })

function collectionText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  const language = $locale.startsWith('de') ? 'de-DE' : $locale.startsWith('it') ? 'it-IT' : 'en-US'
  return value[language] || value['en-US'] || value['de-DE'] || ''
}

const selectedCollectionId = ref(null)
const selectedCollectionDetail = ref(null)
const detailLoading = ref(false)
const detailError = ref(false)
const collectionDetailCache = new Map()
const selectedCollection = computed(() => visibleCollections.value.find((collection) => collection.id === selectedCollectionId.value) ?? null)
const expandedCollection = computed(() => selectedCollectionDetail.value?.id === selectedCollectionId.value
  ? selectedCollectionDetail.value
  : selectedCollection.value)
const narrativeDescriptions = computed(() => (expandedCollection.value?.narrative_steps ?? [])
  .filter((step) => collectionText(step.description)))
const overviewVisuals = computed(() => (expandedCollection.value?.overview_visuals ?? []).filter((visual) => visual.image_url))

function detailOrder(index) {
  const afterRow = (columns) => Math.min(visibleCollections.value.length - 1, Math.floor(index / columns) * columns + columns - 1) * 2 + 1
  return {
    '--detail-order-mobile': afterRow(1),
    '--detail-order-tablet': afterRow(2),
    '--detail-order-desktop': afterRow(4),
  }
}

function overviewVisualElement(visual) {
  return expandedCollection.value?.render_elements?.find((element) => element.plot_id === visual.plot_id)
}

function overviewVisualTitle(visual) {
  return collectionText(visual.title) || collectionText(overviewVisualElement(visual)?.title)
}

function overviewVisualDescription(visual) {
  return collectionText(visual.description) || collectionText(overviewVisualElement(visual)?.description)
}

function overviewImageUrl(path) {
  if (/^https?:\/\//.test(path)) return path
  return `${runtimeConfig.public.stadtlandzahlBaseUrl}/${path.replace(/^\/+/, '')}`
}

async function selectCollection(id) {
  if (selectedCollectionId.value === id) {
    selectedCollectionId.value = null
    return
  }
  selectedCollectionId.value = id
  selectedCollectionDetail.value = collectionDetailCache.get(id) ?? null
  detailLoading.value = false
  detailError.value = false
  if (selectedCollectionDetail.value) return
  detailLoading.value = true
  try {
    const detail = normalizeCollection(await $fetch(`${runtimeConfig.public.stadtlandzahlBaseUrl}/api/collections/${encodeURIComponent(id)}/`, { timeout: 8000 }))
    collectionDetailCache.set(id, detail)
    if (selectedCollectionId.value === id) selectedCollectionDetail.value = detail
  } catch {
    if (selectedCollectionId.value === id) detailError.value = true
  } finally {
    if (selectedCollectionId.value === id) detailLoading.value = false
  }
}

const headerHeight = useHeaderHeight()
const mobileHeaderHidden = useMobileHeaderHidden()
const isDesktop = useState('layout-isDesktop')

const pillTop = computed(() =>
  isDesktop.value ? headerHeight.value : (mobileHeaderHidden.value ? 0 : 64)
)
const breadcrumbNav = ref(null)
const breadcrumbStuck = ref(false)

function updateBreadcrumbStuck() {
  if (breadcrumbNav.value) {
    breadcrumbStuck.value = breadcrumbNav.value.getBoundingClientRect().top <= pillTop.value + 1
  }
}

onMounted(() => {
  updateBreadcrumbStuck()
  window.addEventListener('scroll', updateBreadcrumbStuck, { passive: true })
  window.addEventListener('resize', updateBreadcrumbStuck)
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateBreadcrumbStuck)
  window.removeEventListener('resize', updateBreadcrumbStuck)
})

watch(pillTop, updateBreadcrumbStuck, { flush: 'post' })

const selectedState = ref(null)
const initialStateArs = computed(() => {
  const state = route.query.state
  return typeof state === 'string' && statesLookup.some((item) => item.ars === state) ? state : null
})

function onStateSelected(state) {
  selectedState.value = state
  if (route.query.state !== state.ars) {
    router.push({ query: { ...route.query, state: state.ars } })
  }
}

function onStateExited() {
  selectedState.value = null
  if (route.query.state) {
    router.push({ query: { ...route.query, state: undefined } })
  }
}

const GERMANY_CENTER = {
  lat: 51.1657,
  lon: 10.4515,
}

const indicatorCenter = computed(() => selectedState.value?.geoCenter ?? GERMANY_CENTER)

const GERMANY_AREA = {
  name: 'Deutschland',
  prefix: 'Bundesrepublik',
  ars: '00000000',
  level: 1,
  population: null,
  geo_center: null,
  is_reasonable_for_municipal_rating: false,
  stadtlandklima_data_all: [],
}

useHead({
  title: $t('data.overview.title'),
  meta: [
    {
      name: 'description',
      content: $t('data.overview.intro'),
    },
  ],
})
</script>

<style scoped>
.data-collection-detail {
  order: var(--detail-order-mobile);
}

@media (min-width: 420px) {
  .data-collection-detail {
    order: var(--detail-order-tablet);
  }
}

@media (min-width: 1024px) {
  .data-collection-detail {
    order: var(--detail-order-desktop);
  }
}
</style>
