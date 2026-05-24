<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12 gap-2">
      <SlkFlowerSpinner :size="28" />
      <span class="text-sm text-gray-500">Daten werden geladen…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-8 px-4 text-center text-sm text-gray-400">
      Für diese Kommune sind noch keine Daten vorhanden.
    </div>

    <template v-else>
      <!-- ── Map (only shown when hideMap is false, e.g. mobile) ──────── -->
      <ClientOnly v-if="!hideMap">
        <div class="h-72 sm:h-96 w-full rounded overflow-hidden">
          <LMap
            ref="map"
            :zoom="10"
            :center="mapCenter"
            :use-global-leaflet="false"
            class="h-full w-full"
          >
            <LTileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              :subdomains="'abcd'"
              :max-zoom="20"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
            />

            <!-- Area boundary -->
            <LGeoJson
              v-if="areaBoundary"
              :geojson="areaBoundary"
              :options="areaBoundaryStyle"
              @ready="fitToArea"
            />

            <!-- Data features: points -->
            <template v-if="renderLayerType === 'points' && features.length">
              <LCircleMarker
                v-for="(feat, idx) in features"
                :key="idx"
                :lat-lng="pointLatLng(feat)"
                :radius="6"
                :color="markerColor(feat)"
                :fill-color="markerColor(feat)"
                :fill-opacity="0.8"
                :weight="1"
              >
                <LTooltip>
                  <div class="text-xs">
                    <span v-if="feat.properties[collection.render_config?.color_field]">
                      {{ collection.render_config.color_field }}:
                      {{ feat.properties[collection.render_config.color_field] }}
                    </span>
                    <span v-else>Punkt</span>
                  </div>
                </LTooltip>
              </LCircleMarker>
            </template>

            <!-- Data features: polygon / choropleth -->
            <LGeoJson
              v-else-if="renderLayerType !== 'points' && featureCollection"
              :geojson="featureCollection"
              :options="featureStyle"
            />

            <!-- Nearby areas (clickable) -->
            <LGeoJson
              v-for="area in nearbyAreas"
              :key="area.ars"
              :geojson="parseGeoJson(area.geoArea)"
              :options="nearbyAreaStyle"
              @click="navigateToArea(area)"
            />
          </LMap>
        </div>
      </ClientOnly>

      <!-- ── Summary + Histogram grid ──────────────────────────────────── -->
      <div class="grid md:grid-cols-2 gap-4 mt-4">
        <!-- Aggregate summary -->
        <div class="bg-gray-50 rounded p-4">
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Zusammenfassung</h4>
          <template v-if="summary?.aggregate">
            <dl class="space-y-1">
              <div v-for="(val, key) in summary.aggregate" :key="key" class="flex items-baseline gap-2">
                <dt class="text-xs text-gray-500 shrink-0 capitalize">{{ formatKey(key) }}</dt>
                <dd class="text-sm font-semibold text-gray-900 tabular-nums">
                  {{ formatValue(val) }}
                </dd>
              </div>
            </dl>
          </template>
          <p v-else class="text-sm text-gray-400">Keine Aggregatdaten verfügbar.</p>

          <!-- Feature count -->
          <p class="text-xs text-gray-400 mt-3">
            {{ features.length }} Einträge in dieser Kommune
          </p>
        </div>

        <!-- Histogram -->
        <div>
          <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">Verteilung (alle Kommunen)</h4>
          <DataHistogram
            v-if="histogramUrl"
            :histogram-url="histogramUrl"
            :current-value="summaryAggregateValue"
            :municipality-name="municipalityName"
            :unit="''"
            :orange-threshold="thresholds.orange"
            :yellow-threshold="thresholds.yellow"
            :light-green-threshold="thresholds.lightGreen"
            :dark-green-threshold="thresholds.darkGreen"
          />
          <p v-else class="text-sm text-gray-400 px-1">Kein Histogramm verfügbar.</p>
        </div>
      </div>

      <!-- ── Pipeline ──────────────────────────────────────────────────── -->
      <div v-if="pipeline?.pipeline_steps?.length" class="mt-6">
        <details class="group border border-gray-200 rounded">
          <summary class="flex items-center justify-between px-4 py-3 cursor-pointer select-none bg-gray-50 hover:bg-gray-100 transition-colors rounded">
            <span class="text-sm font-semibold text-gray-700">Datenpipeline</span>
            <svg class="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div class="px-4 pb-4 pt-2 space-y-3">
            <div
              v-for="(step, idx) in pipeline.pipeline_steps"
              :key="step.asset_key || idx"
              class="flex items-start gap-3"
            >
              <div class="flex-shrink-0 w-6 h-6 rounded-full bg-[#006e94]/10 text-[#006e94] flex items-center justify-center text-xs font-bold">
                {{ idx + 1 }}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-mono text-gray-800 break-all">{{ step.asset_key }}</p>
                <p v-if="step.last_materialized" class="text-xs text-gray-400 mt-0.5">
                  Zuletzt aktualisiert: {{ formatDate(step.last_materialized) }}
                </p>
                <p v-if="step.description" class="text-xs text-gray-500 mt-0.5">{{ step.description }}</p>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- ── Metadata ──────────────────────────────────────────────────── -->
      <div v-if="collection.description?.['de-DE'] || collection.description?.['en-US']" class="mt-4 text-sm text-gray-600 leading-relaxed">
        {{ collection.description?.['de-DE'] || collection.description?.['en-US'] }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { areaToSlug } from '~/composables/useAreaBySlug.js'

const props = defineProps({
  collection: {
    type: Object,
    required: true,
  },
  ars: {
    type: String,
    required: true,
  },
  municipalityName: {
    type: String,
    default: '',
  },
  areaBoundary: {
    type: Object,
    default: null,
  },
  nearbyAreas: {
    type: Array,
    default: () => [],
  },
  baseUrl: {
    type: String,
    required: true,
  },
  hideMap: {
    type: Boolean,
    default: false,
  },
})

const router = useRouter()

// ── State ────────────────────────────────────────────────────────────────────

const loading = ref(false)
const error = ref(false)
const features = ref([])
const featureCollection = ref(null)
const summary = ref(null)
const pipeline = ref(null)
const map = ref(null)

// ── Derived ──────────────────────────────────────────────────────────────────

const renderLayerType = computed(
  () => props.collection?.render_config?.layer_type ?? 'points'
)

const histogramUrl = computed(
  () => props.collection?.id
    ? `${props.baseUrl}/api/collections/${props.collection.id}/histogram/`
    : null
)

const thresholds = computed(() => {
  const tb = props.collection?.render_config?.threshold_bar
  return {
    orange: tb?.thresholds?.orange ?? null,
    yellow: tb?.thresholds?.yellow ?? null,
    lightGreen: tb?.thresholds?.lightgreen ?? null,
    darkGreen: tb?.thresholds?.darkgreen ?? null,
  }
})

const summaryAggregateValue = computed(() => {
  const agg = summary.value?.aggregate
  if (!agg) return null
  // Prefer a "total" or "sum" key, else fall back to first numeric value
  const pref = ['total', 'sum', 'count', 'mean', 'avg']
  for (const k of pref) {
    if (k in agg && typeof agg[k] === 'number') return agg[k]
  }
  const firstNumeric = Object.values(agg).find(v => typeof v === 'number')
  return firstNumeric ?? null
})

const mapCenter = computed(() => {
  if (features.value.length) {
    const f = features.value[0]
    if (f.geometry?.type === 'Point') {
      return [f.geometry.coordinates[1], f.geometry.coordinates[0]]
    }
  }
  return [51.163, 10.447] // Germany center fallback
})

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function loadCollectionData() {
  if (!props.collection?.id || !props.ars) return
  loading.value = true
  error.value = false
  features.value = []
  featureCollection.value = null
  summary.value = null
  pipeline.value = null

  try {
    const collectionId = props.collection.id
    const base = `${props.baseUrl}/api/collections/${collectionId}`

    const [itemsResult, summaryResult, pipelineResult] = await Promise.allSettled([
      $fetch(`${base}/items/`, { params: { area: props.ars } }),
      $fetch(`${base}/summary/`, { params: { area: props.ars } }),
      $fetch(`${base}/pipeline/`),
    ])

    if (itemsResult.status === 'fulfilled') {
      const geojson = itemsResult.value
      if (geojson?.features) {
        features.value = geojson.features
        featureCollection.value = geojson
      }
    }
    if (summaryResult.status === 'fulfilled') {
      summary.value = summaryResult.value
    }
    if (pipelineResult.status === 'fulfilled') {
      pipeline.value = pipelineResult.value
    }

    if (!features.value.length && !summary.value) {
      error.value = true
    }
  } catch (_) {
    error.value = true
  } finally {
    loading.value = false
  }
}

watch(
  () => props.collection?.id,
  () => loadCollectionData(),
  { immediate: true }
)

watch(
  () => props.ars,
  () => loadCollectionData()
)

// ── Map helpers ───────────────────────────────────────────────────────────────

const areaBoundaryStyle = {
  color: '#339737',
  weight: 2,
  fillColor: '#339737',
  fillOpacity: 0.15,
}

const nearbyAreaStyle = {
  color: '#9D9D9C',
  weight: 1,
  fillColor: '#9D9D9C',
  fillOpacity: 0.1,
  className: 'cursor-pointer hover:fill-opacity-30',
}

const featureStyle = {
  color: '#006e94',
  weight: 1.5,
  fillColor: '#006e94',
  fillOpacity: 0.4,
}

function pointLatLng(feature) {
  if (feature.geometry?.type === 'Point') {
    return [feature.geometry.coordinates[1], feature.geometry.coordinates[0]]
  }
  return [0, 0]
}

function markerColor(feature) {
  const colorField = props.collection?.render_config?.color_field
  if (!colorField) return '#006e94'
  const val = feature.properties?.[colorField]
  if (val == null) return '#9D9D9C'
  const tb = thresholds.value
  if (tb.darkGreen !== null && val >= tb.darkGreen) return '#1EA64A'
  if (tb.lightGreen !== null && val >= tb.lightGreen) return '#8DC63F'
  if (tb.yellow !== null && val >= tb.yellow) return '#F7A600'
  if (tb.orange !== null && val >= tb.orange) return '#F36633'
  return '#E30613'
}

function parseGeoJson(str) {
  if (!str) return null
  if (typeof str === 'object') return str
  try { return JSON.parse(str) } catch (_) { return null }
}

function fitToArea(layer) {
  if (!map.value || !layer) return
  try {
    map.value.leafletObject?.fitBounds(layer.getBounds(), { padding: [20, 20] })
  } catch (_) {}
}

function navigateToArea(area) {
  if (!area?.prefix || !area?.name) return
  router.push(`/data/${areaToSlug(area.prefix, area.name)}`)
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatKey(key) {
  return key.replace(/_/g, ' ')
}

function formatValue(val) {
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val.toLocaleString('de-DE') : val.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }
  return val
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch (_) {
    return iso
  }
}
</script>
