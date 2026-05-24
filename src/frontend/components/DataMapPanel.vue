<!--
  DataMapPanel — sticky map panel for the scrollytelling layout.
  Shows:
    - CartoDB Positron basemap (clean, minimal)
    - Carve-out mask (dims everything outside the area boundary)
    - Area boundary outline
    - Nearby municipality boundaries (click → navigate)
    - Active collection features (updates reactively as user scrolls)
    - Big number + legend strip below the map
-->
<template>
  <div class="flex flex-col h-full bg-gray-50">

    <!-- ── Map ──────────────────────────────────────────────────────────── -->
    <div class="relative flex-1 min-h-0">
      <LMap
        ref="mapRef"
        v-model:zoom="zoom"
        :center="mapCenter"
        :min-zoom="8"
        :max-zoom="17"
        :use-global-leaflet="false"
        :options="{ zoomControl: true, scrollWheelZoom: false }"
        class="h-full w-full"
        @ready="onMapReady"
      >
        <!-- CartoDB Positron: clean, minimal, no OSM clutter -->
        <LTileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          :subdomains="'abcd'"
          :max-zoom="20"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
        />

        <!-- Nearby municipality boundaries — rendered below the mask -->
        <template v-for="nb in visibleNearby" :key="nb.ars">
          <LGeoJson
            v-if="parseGeo(nb.geoArea)"
            :geojson="parseGeo(nb.geoArea)"
            :options="nearbyOpts(nb)"
          />
        </template>

        <!-- Carve-out mask: dims everything outside this area -->
        <LGeoJson
          v-if="maskGeoJson"
          :geojson="maskGeoJson"
          :options="maskOpts"
        />

        <!-- Area boundary outline -->
        <LGeoJson
          v-if="areaBoundary"
          :geojson="areaBoundary"
          :options="boundaryOpts"
          @ready="onBoundaryReady"
        />

        <!-- Data features: points -->
        <template v-if="layerType === 'points' && dataFeatures.length">
          <LCircleMarker
            v-for="(feat, i) in dataFeatures"
            :key="i"
            :lat-lng="featLatLng(feat)"
            :radius="5"
            :color="featColor(feat)"
            :fill-color="featColor(feat)"
            :fill-opacity="0.85"
            :weight="1"
          />
        </template>

        <!-- Data features: polygon / choropleth -->
        <LGeoJson
          v-else-if="layerType !== 'points' && dataFeatureCollection"
          :geojson="dataFeatureCollection"
          :options="featurePolyOpts"
        />
      </LMap>

      <!-- Loading veil -->
      <Transition name="fade">
        <div
          v-if="loadingFeatures"
          class="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-[1000]"
        >
          <SlkFlowerSpinner :size="32" />
        </div>
      </Transition>
    </div>

    <!-- ── Stats strip ───────────────────────────────────────────────── -->
    <div class="flex-none border-t border-gray-200 bg-white">

      <!-- Active collection stats -->
      <div v-if="activeCollection" class="flex items-stretch gap-0 divide-x divide-gray-100">

        <!-- Big number -->
        <div class="px-6 py-4 flex flex-col justify-center min-w-[140px]">
          <div
            class="text-5xl font-black tabular-nums leading-none transition-colors duration-500"
            :style="bigNumColor ? `color:${bigNumColor}` : 'color:#006e94'"
          >{{ formattedBigNum }}</div>
          <div class="text-[11px] text-gray-400 mt-1 leading-tight max-w-[130px]">{{ bigNumLabel }}</div>
        </div>

        <!-- Collection info + feature count -->
        <div class="flex-1 min-w-0 px-5 py-4 flex flex-col justify-center gap-1">
          <div class="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
            {{ activeCollection.title?.['de-DE'] || activeCollection.title?.['en-US'] }}
          </div>
          <div v-if="loadingFeatures" class="text-xs text-gray-400 animate-pulse">Daten werden geladen…</div>
          <div v-else-if="dataFeatures.length" class="text-xs text-gray-400">
            {{ dataFeatures.length.toLocaleString('de-DE') }} Objekte im Gebiet
          </div>
          <div v-else class="text-xs text-gray-400">Keine Daten verfügbar</div>
        </div>

        <!-- Threshold legend (when thresholds are defined) -->
        <div v-if="hasThresholds" class="hidden lg:flex flex-col justify-center gap-1.5 px-5 py-4">
          <div
            v-for="leg in legendItems"
            :key="leg.label"
            class="flex items-center gap-2"
          >
            <span class="w-2.5 h-2.5 rounded-full flex-none" :style="`background:${leg.color}`" />
            <span class="text-[11px] text-gray-500 whitespace-nowrap">{{ leg.label }}</span>
          </div>
        </div>
      </div>

      <!-- Placeholder (no active collection yet) -->
      <div v-else class="px-6 py-4 text-sm text-gray-400 italic">
        Scrollen Sie, um Klimadaten zu erkunden
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { areaToSlug } from '~/composables/useAreaBySlug.js'

const props = defineProps({
  areaBoundary: { type: Object, default: null },
  nearbyAreas:  { type: Array,  default: () => [] },
  ars:          { type: String, required: true },
  activeCollection: { type: Object, default: null },
  baseUrl:      { type: String, required: true },
})

const router = useRouter()

// ── Map state ─────────────────────────────────────────────────────────────────

const mapRef   = ref(null)
const zoom     = ref(11)
const mapCenter = ref([51.163, 10.447]) // Germany center fallback
const mapReady  = ref(false)
let   pendingBounds = null

function onMapReady(mapInstance) {
  mapReady.value = true
  if (pendingBounds) {
    mapInstance.fitBounds(pendingBounds, { padding: [30, 30], maxZoom: 14 })
    pendingBounds = null
  }
}

function onBoundaryReady(layer) {
  try {
    const bounds = layer.getBounds()
    if (!bounds.isValid()) return
    if (mapReady.value && mapRef.value?.leafletObject) {
      mapRef.value.leafletObject.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
    } else {
      pendingBounds = bounds
    }
  } catch (_) {}
}

// Re-fit when the boundary changes (new page navigation)
watch(() => props.areaBoundary, () => {
  pendingBounds = null
  mapReady.value = false
})

// ── Carve-out mask ────────────────────────────────────────────────────────────

const maskGeoJson = computed(() => {
  if (!props.areaBoundary) return null
  const geom = props.areaBoundary?.type === 'Feature'
    ? props.areaBoundary.geometry
    : props.areaBoundary
  if (!geom) return null

  // World bounding box as outer ring — in GeoJSON [lng, lat]
  const world = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]

  if (geom.type === 'Polygon') {
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, geom.coordinates[0]] } }
  }
  if (geom.type === 'MultiPolygon') {
    // Each polygon's outer ring becomes a hole
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [world, ...geom.coordinates.map(p => p[0])] } }
  }
  return null
})

const maskOpts = {
  style: { fillColor: '#b8c4cc', fillOpacity: 0.5, weight: 0, stroke: false, interactive: false, fillRule: 'evenodd' },
  interactive: false,
}

const boundaryOpts = {
  style: { color: '#1a5276', weight: 2.5, fillOpacity: 0, opacity: 0.85 },
  interactive: false,
}

// ── Nearby areas ──────────────────────────────────────────────────────────────

const visibleNearby = computed(() => props.nearbyAreas.filter(a => a.geoArea))

function parseGeo(geoArea) {
  if (!geoArea) return null
  if (typeof geoArea === 'object') return geoArea
  try { return JSON.parse(geoArea) } catch { return null }
}

function navigateToArea(area) {
  router.push(`/data/${areaToSlug(area.prefix, area.name)}`)
}

function nearbyOpts(area) {
  const base = { color: '#4a90a4', weight: 1, fillColor: '#4a90a4', fillOpacity: 0.0, opacity: 0.3 }
  const hover = { ...base, fillOpacity: 0.1, opacity: 0.65 }
  return {
    style: () => ({ ...base }),
    onEachFeature: (_feat, layer) => {
      layer.bindTooltip(
        `<strong style="font-size:12px">${area.prefix} ${area.name}</strong><br><span style="color:#006e94;font-size:11px">→ Dashboard öffnen</span>`,
        { sticky: true, direction: 'top', className: 'leaflet-tooltip-custom' }
      )
      layer.on('mouseover', () => { layer.setStyle(hover); layer.bringToFront() })
      layer.on('mouseout',  () => layer.setStyle(base))
      layer.on('click',     () => navigateToArea(area))
    },
  }
}

// ── Active collection data features ───────────────────────────────────────────

const loadingFeatures = ref(false)
const dataFeatures    = ref([])
const dataFeatureCollection = ref(null)
const summaryData     = ref(null)

const layerType = computed(() => props.activeCollection?.render_config?.layer_type ?? 'points')

const thresholds = computed(() => {
  const tb = props.activeCollection?.render_config?.threshold_bar
  return {
    darkGreen:  tb?.thresholds?.darkgreen  ?? null,
    lightGreen: tb?.thresholds?.lightgreen ?? null,
    yellow:     tb?.thresholds?.yellow     ?? null,
    orange:     tb?.thresholds?.orange     ?? null,
  }
})

const hasThresholds = computed(() => Object.values(thresholds.value).some(v => v !== null))

async function fetchActiveData(id) {
  if (!id || !props.ars) {
    dataFeatures.value = []
    dataFeatureCollection.value = null
    summaryData.value = null
    return
  }
  loadingFeatures.value = true
  try {
    const [itemsRes, summaryRes] = await Promise.allSettled([
      $fetch(`${props.baseUrl}/api/collections/${id}/items/`, { params: { area: props.ars } }),
      $fetch(`${props.baseUrl}/api/collections/${id}/summary/`, { params: { area: props.ars } }),
    ])
    if (itemsRes.status === 'fulfilled' && itemsRes.value?.features) {
      dataFeatures.value = itemsRes.value.features
      dataFeatureCollection.value = itemsRes.value
    } else {
      dataFeatures.value = []
      dataFeatureCollection.value = null
    }
    summaryData.value = summaryRes.status === 'fulfilled' ? summaryRes.value : null
  } catch (_) {
    dataFeatures.value = []
    summaryData.value = null
  } finally {
    loadingFeatures.value = false
  }
}

watch(() => props.activeCollection?.id, (id) => fetchActiveData(id), { immediate: true })

// ── Feature styling ───────────────────────────────────────────────────────────

function featColor(feature) {
  const colorField = props.activeCollection?.render_config?.color_field
  if (!colorField) return '#006e94'
  const val = feature.properties?.[colorField]
  if (val == null) return '#9D9D9C'
  const t = thresholds.value
  if (t.darkGreen  !== null && val >= t.darkGreen)  return '#1EA64A'
  if (t.lightGreen !== null && val >= t.lightGreen) return '#8DC63F'
  if (t.yellow     !== null && val >= t.yellow)     return '#F7A600'
  if (t.orange     !== null && val >= t.orange)     return '#F36633'
  return '#E30613'
}

function featLatLng(feature) {
  if (feature.geometry?.type === 'Point') {
    return [feature.geometry.coordinates[1], feature.geometry.coordinates[0]]
  }
  return [0, 0]
}

const featurePolyOpts = computed(() => ({
  style: (feature) => ({
    color:       featColor(feature),
    weight:      1,
    fillColor:   featColor(feature),
    fillOpacity: 0.5,
  }),
}))

// ── Big number ────────────────────────────────────────────────────────────────

const bigNumRaw = computed(() => {
  if (summaryData.value?.aggregate) {
    const agg = summaryData.value.aggregate
    for (const k of ['total', 'sum', 'count', 'mean', 'avg', 'value']) {
      if (k in agg && typeof agg[k] === 'number') return { val: agg[k], key: k }
    }
    const entry = Object.entries(agg).find(([, v]) => typeof v === 'number')
    if (entry) return { val: entry[1], key: entry[0] }
  }
  return dataFeatures.value.length ? { val: dataFeatures.value.length, key: 'Objekte' } : null
})

const formattedBigNum = computed(() => {
  const n = bigNumRaw.value?.val
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)    return n.toLocaleString('de-DE')
  if (!Number.isInteger(n)) return n.toFixed(1)
  return n.toLocaleString('de-DE')
})

const bigNumLabel = computed(() => {
  const key = bigNumRaw.value?.key ?? ''
  const labels = { total: 'Gesamt', sum: 'Summe', count: 'Anzahl', mean: 'Durchschnitt', avg: 'Durchschnitt', value: 'Wert', Objekte: 'Objekte im Gebiet' }
  return labels[key] ?? key
})

const bigNumColor = computed(() => {
  const v = bigNumRaw.value?.val
  if (v == null || !hasThresholds.value) return null
  const t = thresholds.value
  if (t.darkGreen  !== null && v >= t.darkGreen)  return '#1EA64A'
  if (t.lightGreen !== null && v >= t.lightGreen) return '#8DC63F'
  if (t.yellow     !== null && v >= t.yellow)     return '#F7A600'
  if (t.orange     !== null && v >= t.orange)     return '#F36633'
  return '#E30613'
})

const legendItems = [
  { color: '#1EA64A', label: 'Sehr gut' },
  { color: '#8DC63F', label: 'Gut' },
  { color: '#F7A600', label: 'Mittel' },
  { color: '#F36633', label: 'Gering' },
  { color: '#E30613', label: 'Niedrig' },
]
</script>

<style>
.leaflet-tooltip-custom {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  padding: 6px 10px;
  font-family: inherit;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }
</style>
