<!--
  AreaOverview — full-page overview for Germany (level 1) or Bundesland (level 2).
  Shows:
    • Hero stats (population, child count)
    • Interactive choropleth map — click a region to navigate there
    • Scrollable grid of child areas
-->
<template>
  <div>
    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <section class="py-10 xl:py-16 border-b border-gray-100">
      <p class="text-xs font-bold text-[#006e94] uppercase tracking-widest mb-2">
        {{ levelLabel(area.level) }}
      </p>
      <h1 class="text-4xl xl:text-6xl font-black text-gray-900 leading-tight mb-6">
        {{ area.name }}
      </h1>

      <!-- Stat pills -->
      <div class="flex flex-wrap gap-4">
        <div v-if="area.population" class="bg-gray-50 rounded-xl px-5 py-3">
          <div class="text-2xl font-black text-gray-900">
            {{ area.population.toLocaleString('de-DE') }}
          </div>
          <div class="text-xs text-gray-500 mt-0.5">Einwohner</div>
        </div>
        <div v-if="!loading && children.length" class="bg-gray-50 rounded-xl px-5 py-3">
          <div class="text-2xl font-black text-gray-900">{{ children.length }}</div>
          <div class="text-xs text-gray-500 mt-0.5">{{ childLabel }}</div>
        </div>
        <div v-if="totalChildPop" class="bg-gray-50 rounded-xl px-5 py-3">
          <div class="text-2xl font-black text-gray-900">
            {{ totalChildPop.toLocaleString('de-DE') }}
          </div>
          <div class="text-xs text-gray-500 mt-0.5">Einwohner gesamt (Kreisebene)</div>
        </div>
      </div>
    </section>

    <!-- ── Map + children grid ───────────────────────────────────────────── -->
    <div class="xl:grid xl:grid-cols-[1fr_380px] xl:gap-0 mt-8 gap-8 flex flex-col">

      <!-- Choropleth map -->
      <div class="relative h-[400px] xl:h-[calc(100vh-220px)] rounded-2xl overflow-hidden bg-gray-100">
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm z-10">
          Karte wird geladen…
        </div>
        <ClientOnly v-else-if="mapGeoJson">
          <LMap
            ref="mapRef"
            :zoom="isGermany ? 6 : 8"
            :center="mapCenter"
            :use-global-leaflet="false"
            :options="{ zoomControl: true, scrollWheelZoom: false }"
            class="h-full w-full"
            @ready="onMapReady"
          >
            <LTileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              :subdomains="'abcd'"
              :max-zoom="20"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
            />
            <LGeoJson
              :geojson="mapGeoJson"
              :options="geoJsonOpts"
              @ready="onGeoJsonReady"
            />
          </LMap>
          <template #fallback>
            <div class="h-full bg-gray-100 animate-pulse" />
          </template>
        </ClientOnly>
        <!-- Hover tooltip -->
        <div
          v-if="hoveredArea"
          class="absolute bottom-4 left-4 bg-white/95 rounded-xl shadow-lg px-4 py-2.5 text-sm font-semibold text-gray-900 pointer-events-none z-[500]"
        >
          {{ hoveredArea.prefix }} {{ hoveredArea.name }}
          <span v-if="hoveredArea.population" class="ml-2 text-xs font-normal text-gray-500">
            {{ hoveredArea.population.toLocaleString('de-DE') }} Einwohner
          </span>
        </div>
      </div>

      <!-- Children list -->
      <div class="xl:border-l border-gray-100 xl:overflow-y-auto xl:max-h-[calc(100vh-220px)]">
        <div v-if="loading" class="p-6 text-sm text-gray-400 animate-pulse">Wird geladen…</div>
        <template v-else>
          <div class="p-4 xl:p-6 border-b border-gray-100">
            <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wide">{{ childLabel }}</h2>
          </div>
          <div class="divide-y divide-gray-50">
            <NuxtLink
              v-for="child in children"
              :key="child.ars"
              :to="`/data/${toSlug(child.prefix, child.name)}`"
              class="flex items-center justify-between gap-3 px-4 xl:px-6 py-3 hover:bg-gray-50 transition-colors group"
              @mouseenter="hoveredArea = child"
              @mouseleave="hoveredArea = null"
            >
              <div class="min-w-0">
                <span class="text-xs text-gray-400 mr-1">{{ child.prefix }}</span>
                <span class="text-sm font-semibold text-gray-800 group-hover:text-[#006e94] transition-colors">
                  {{ child.name }}
                </span>
              </div>
              <div class="flex items-center gap-2 flex-none">
                <span v-if="child.population" class="text-xs text-gray-400 tabular-nums">
                  {{ (child.population / 1000).toFixed(0) }}k
                </span>
                <div
                  class="w-3 h-3 rounded-full flex-none"
                  :style="`background:${popColor(child.population)}`"
                />
              </div>
            </NuxtLink>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from '#app'
import { areaToSlug } from '~/composables/useAreaBySlug.js'

const props = defineProps({
  area: { type: Object, required: true },
})

const router     = useRouter()
const mapRef     = ref(null)
const toSlug     = areaToSlug
const hoveredArea = ref(null)

// ── Data ─────────────────────────────────────────────────────────────────────

const children  = ref([])
const loading   = ref(true)

const isGermany  = computed(() => props.area?.level === 1)
const childLevel = computed(() => isGermany.value ? 2 : 4)
const childLabel = computed(() => isGermany.value ? 'Bundesländer' : 'Kreise & kreisfreie Städte')

const childArsPrefix = computed(() =>
  isGermany.value ? '' : (props.area?.ars?.slice(0, 2) ?? '')
)

const mapCenter = computed(() => {
  const c = props.area?.geo_center
  if (!c) return [51.163, 10.447]
  if (c.coordinates) return [c.coordinates[1], c.coordinates[0]]
  if (Array.isArray(c)) return [c[1], c[0]]
  return [51.163, 10.447]
})

const totalChildPop = computed(() => {
  if (isGermany.value) return null // already shown via area.population
  return children.value.reduce((s, c) => s + (c.population ?? 0), 0) || null
})

// ── Choropleth color (log-scale population) ───────────────────────────────────

function popColor(population) {
  if (!population) return '#cbd5e1'
  const maxLog = Math.log(isGermany.value ? 18_000_000 : 2_000_000)
  const minLog = Math.log(isGermany.value ? 700_000 : 20_000)
  const t = Math.min(Math.max((Math.log(population) - minLog) / (maxLog - minLog), 0), 1)
  // Light teal (#e0f2f1) → brand teal (#006e94)
  const r = Math.round(224 * (1 - t) + 0 * t)
  const g = Math.round(242 * (1 - t) + 110 * t)
  const b = Math.round(241 * (1 - t) + 148 * t)
  return `rgb(${r},${g},${b})`
}

// ── Map GeoJSON (built from API response) ─────────────────────────────────────

const mapGeoJson = computed(() => {
  if (!children.value.length) return null
  const features = []
  for (const child of children.value) {
    if (!child.geoArea) continue
    let geo
    try { geo = typeof child.geoArea === 'string' ? JSON.parse(child.geoArea) : child.geoArea } catch { continue }
    features.push({ type: 'Feature', geometry: geo, properties: { _area: child } })
  }
  return features.length ? { type: 'FeatureCollection', features } : null
})

// ── Leaflet options ───────────────────────────────────────────────────────────

const geoJsonOpts = computed(() => ({
  style: (feature) => ({
    fillColor: popColor(feature?.properties?._area?.population),
    fillOpacity: 0.65,
    color: '#fff',
    weight: 1.5,
  }),
  onEachFeature: (feature, layer) => {
    const areaData = feature?.properties?._area
    if (!areaData) return
    layer.on('click', () => {
      router.push(`/data/${areaToSlug(areaData.prefix, areaData.name)}`)
    })
    layer.on('mouseover', (e) => {
      hoveredArea.value = areaData
      e.target.setStyle({ fillOpacity: 0.9, weight: 2.5, color: '#006e94' })
    })
    layer.on('mouseout', (e) => {
      hoveredArea.value = null
      e.target.setStyle({
        fillOpacity: 0.65,
        weight: 1.5,
        color: '#fff',
      })
    })
  },
}))

let geoJsonLayer = null
function onGeoJsonReady(layer) {
  geoJsonLayer = layer
}

function onMapReady(map) {
  if (geoJsonLayer) {
    try {
      map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] })
    } catch (_) {}
  }
}

// ── Load children ─────────────────────────────────────────────────────────────

async function loadChildren() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      level: String(childLevel.value),
      includeGeo: 'true',
      first: '100',
    })
    if (childArsPrefix.value) params.set('arsPrefix', childArsPrefix.value)
    const data = await $fetch(`/api/area-children?${params}`)
    children.value = (data ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
  } catch {
    children.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => loadChildren())

// ── Helpers ───────────────────────────────────────────────────────────────────

function levelLabel(level) {
  return { 1: 'Bundesrepublik', 2: 'Bundesland', 4: 'Kreis' }[level] ?? `Ebene ${level}`
}
</script>
