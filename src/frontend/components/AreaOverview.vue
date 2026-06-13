<!--
  AreaOverview — interactive map for Germany (level 1) or Bundesland (level 2).

  Germany view  : SVG choropleth of 16 states from static GeoJSON + live population.
                  Click a state → zoom in, show municipalities as colored dots.
  Bundesland page (level 2): starts pre-drilled into that state.
-->
<template>
  <div>
    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <section class="py-10 xl:py-16 border-b border-gray-100">
      <p class="text-xs font-bold text-[#006e94] uppercase tracking-widest mb-2">
        {{ selectedState ? 'Bundesland' : 'Bundesrepublik' }}
      </p>
      <h1 class="text-4xl xl:text-6xl font-black text-gray-900 leading-tight mb-6">
        {{ selectedState ? selectedState.name : area.name }}
      </h1>

      <div class="flex flex-wrap gap-4">
        <div v-if="heroPopulation" class="bg-gray-50 rounded-xl px-5 py-3">
          <div class="text-2xl font-black text-gray-900">
            {{ heroPopulation.toLocaleString('de-DE') }}
          </div>
          <div class="text-xs text-gray-500 mt-0.5">Einwohner</div>
        </div>
        <div v-if="!selectedState && states.length" class="bg-gray-50 rounded-xl px-5 py-3">
          <div class="text-2xl font-black text-gray-900">{{ states.length }}</div>
          <div class="text-xs text-gray-500 mt-0.5">Bundesländer</div>
        </div>
        <div v-if="selectedState && !municipalitiesLoading && municipalities.length" class="bg-gray-50 rounded-xl px-5 py-3">
          <div class="text-2xl font-black text-gray-900">{{ municipalities.length }}</div>
          <div class="text-xs text-gray-500 mt-0.5">bewertbare Kommunen</div>
        </div>
      </div>
    </section>

    <!-- ── Map + sidebar grid ────────────────────────────────────────────── -->
    <div class="xl:grid xl:grid-cols-[1fr_380px] xl:gap-0 mt-8 gap-8 flex flex-col">

      <!-- ── SVG map ──────────────────────────────────────────────────────── -->
      <div class="relative h-[400px] xl:h-[calc(100vh-220px)] rounded-2xl overflow-hidden bg-gray-50">

        <!-- Back button (only relevant on Germany page when drilled into a state) -->
        <button
          v-if="selectedState && isGermany"
          class="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 rounded-lg shadow text-xs font-semibold text-gray-700 hover:text-[#006e94] transition-colors"
          @click="exitStateView()"
        >
          ← Alle Bundesländer
        </button>

        <!-- Loading indicator -->
        <div
          v-if="statesLoading || municipalitiesLoading"
          class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"
        >
          <span class="animate-pulse">
            {{ municipalitiesLoading ? 'Kommunen werden geladen…' : 'Karte wird geladen…' }}
          </span>
        </div>

        <!-- Germany choropleth (level 1, no state selected) -->
        <svg
          v-else-if="!selectedState && svgStatePaths.length"
          viewBox="0 0 560 560"
          xmlns="http://www.w3.org/2000/svg"
          class="w-full h-full"
        >
          <path
            v-for="s in svgStatePaths"
            :key="s.ars"
            :d="s.d"
            :fill="s.fill"
            :stroke="hoveredItem?.ars === s.ars ? '#006e94' : '#cbd5e1'"
            :stroke-width="hoveredItem?.ars === s.ars ? 2 : 0.8"
            stroke-linejoin="round"
            :fill-opacity="hoveredItem?.ars === s.ars ? 0.9 : 0.75"
            class="cursor-pointer"
            @click="enterStateView(s)"
            @mouseenter="hoveredItem = s"
            @mouseleave="hoveredItem = null"
          />
          <!-- State name labels -->
          <text
            v-for="s in svgStatePaths"
            :key="'lbl-' + s.ars"
            :x="s.cx"
            text-anchor="middle"
            dominant-baseline="middle"
            font-size="10"
            font-weight="600"
            fill="#374151"
            class="pointer-events-none select-none"
          >
            <tspan :x="s.cx" :y="s.labelLines.length > 1 ? s.cy - 6 : s.cy">{{ s.labelLines[0] }}</tspan>
            <tspan v-if="s.labelLines[1]" :x="s.cx" :dy="13">{{ s.labelLines[1] }}</tspan>
          </text>
        </svg>

        <!-- State drill-down: boundary + municipality dots -->
        <svg
          v-else-if="selectedState && !municipalitiesLoading && (selectedStateSvgPath || svgMunicipalityDots.length)"
          viewBox="0 0 560 560"
          xmlns="http://www.w3.org/2000/svg"
          class="w-full h-full"
        >
          <path
            v-if="selectedStateSvgPath"
            :d="selectedStateSvgPath"
            fill="#f0f9ff"
            stroke="#006e94"
            stroke-width="1.5"
            stroke-linejoin="round"
            fill-opacity="0.5"
          />
          <circle
            v-for="m in svgMunicipalityDots"
            :key="m.ars"
            :cx="m.x"
            :cy="m.y"
            r="5"
            :fill="m.color"
            fill-opacity="0.85"
            stroke="white"
            stroke-width="0.8"
            class="cursor-pointer"
            @click="router.push(`/data/${areaToSlug(m.prefix, m.name)}`)"
            @mouseenter="hoveredItem = m"
            @mouseleave="hoveredItem = null"
          />
        </svg>

        <div
          v-else-if="!statesLoading && !municipalitiesLoading"
          class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"
        >
          Keine Kartendaten verfügbar.
        </div>

        <!-- Hover tooltip -->
        <div
          v-if="hoveredItem && !statesLoading && !municipalitiesLoading"
          class="absolute bottom-4 left-4 bg-white/95 rounded-xl shadow-lg px-4 py-2.5 text-sm font-semibold text-gray-900 pointer-events-none z-10"
        >
          {{ hoveredItem.prefix ? `${hoveredItem.prefix} ` : '' }}{{ hoveredItem.name }}
          <span v-if="hoveredItem.population" class="ml-2 text-xs font-normal text-gray-500">
            {{ hoveredItem.population.toLocaleString('de-DE') }} Einwohner
          </span>
          <span
            v-if="hoveredItem.scoreTotal != null"
            class="ml-2 text-xs font-medium"
            :style="`color:${scoreColor(hoveredItem.scoreTotal)}`"
          >
            {{ hoveredItem.scoreTotal.toFixed(1) }} Punkte
          </span>
        </div>
      </div>

      <!-- ── Sidebar ──────────────────────────────────────────────────────── -->
      <div class="xl:border-l border-gray-100 xl:overflow-y-auto xl:max-h-[calc(100vh-220px)]">

        <!-- Germany view: states list -->
        <template v-if="!selectedState">
          <div v-if="statesLoading" class="p-6 text-sm text-gray-400 animate-pulse">Wird geladen…</div>
          <template v-else>
            <div class="p-4 xl:p-6 border-b border-gray-100">
              <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wide">Bundesländer</h2>
            </div>
            <div class="divide-y divide-gray-50">
              <button
                v-for="s in sortedStates"
                :key="s.ars"
                class="w-full flex items-center justify-between gap-3 px-4 xl:px-6 py-3 hover:bg-gray-50 transition-colors group text-left"
                @click="enterStateView(s)"
                @mouseenter="hoveredItem = s"
                @mouseleave="hoveredItem = null"
              >
                <span class="text-sm font-semibold text-gray-800 group-hover:text-[#006e94] transition-colors">
                  {{ s.name }}
                </span>
                <div class="flex items-center gap-2 flex-none">
                  <span v-if="s.population" class="text-xs text-gray-400 tabular-nums">
                    {{ (s.population / 1_000_000).toFixed(1) }}M
                  </span>
                  <div class="w-3 h-3 rounded-full flex-none" :style="`background:${popColor(s.population)}`" />
                </div>
              </button>
            </div>
          </template>
        </template>

        <!-- State view: municipalities list -->
        <template v-else>
          <div v-if="municipalitiesLoading" class="p-6 text-sm text-gray-400 animate-pulse">Kommunen werden geladen…</div>
          <template v-else>
            <div class="p-4 xl:p-6 border-b border-gray-100">
              <h2 class="text-sm font-bold text-gray-500 uppercase tracking-wide">Bewertbare Kommunen</h2>
            </div>
            <div class="divide-y divide-gray-50">
              <NuxtLink
                v-for="m in municipalities"
                :key="m.ars"
                :to="`/data/${areaToSlug(m.prefix, m.name)}`"
                class="flex items-center justify-between gap-3 px-4 xl:px-6 py-3 hover:bg-gray-50 transition-colors group"
                @mouseenter="hoveredItem = municipalityHoverObj(m)"
                @mouseleave="hoveredItem = null"
              >
                <div class="min-w-0">
                  <span class="text-xs text-gray-400 mr-1">{{ m.prefix }}</span>
                  <span class="text-sm font-semibold text-gray-800 group-hover:text-[#006e94] transition-colors">
                    {{ m.name }}
                  </span>
                </div>
                <div class="flex items-center gap-2 flex-none">
                  <span v-if="m.population" class="text-xs text-gray-400 tabular-nums">
                    {{ (m.population / 1000).toFixed(0) }}k
                  </span>
                  <div
                    class="w-3 h-3 rounded-full flex-none"
                    :style="`background:${scoreColor(m.stadtlandklimaDataAll?.[0]?.scoreTotal ?? null)}`"
                  />
                </div>
              </NuxtLink>
            </div>
          </template>
        </template>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useNuxtApp } from '#app'
import { areaToSlug } from '~/composables/useAreaBySlug.js'
import germanyBorders from '~/assets/germany-state-borders.json'
import statesLookupRaw from '~/assets/germany-states-lookup.json'

const props = defineProps({
  area:        { type: Object, required: true },
  containedBy: { type: Array, default: () => [] },
})

const router              = useRouter()
const { $stadtlandzahlAPI } = useNuxtApp()
const isGermany           = computed(() => props.area?.level === 1)

// ── Hover ──────────────────────────────────────────────────────────────────────
const hoveredItem = ref(null)

// ── State machine ──────────────────────────────────────────────────────────────
// null = Germany choropleth; object = zoomed into that state
const selectedState = ref(null)

// ── Static state data ──────────────────────────────────────────────────────────
// Build index: lowercase name → lookup entry
const lookupByName = Object.fromEntries(
  statesLookupRaw.map(s => [s.name1.toLowerCase(), s])
)

function featureByName(name) {
  return germanyBorders.features.find(
    f => f.properties.NAME_1.toLowerCase() === (name ?? '').toLowerCase()
  ) ?? null
}

// Reactive states array: static geo + lazy population
const statesLoading = ref(true)
const states = ref(
  germanyBorders.features.map(f => {
    const meta = lookupByName[f.properties.NAME_1.toLowerCase()]
    if (!meta) return null
    return {
      name:       f.properties.NAME_1,
      prefix:     meta.prefix,
      ars:        meta.ars,
      slug:       meta.slug,
      geometry:   f.geometry,
      population: null,
    }
  }).filter(Boolean)
)

const sortedStates = computed(() =>
  [...states.value].sort((a, b) => a.name.localeCompare(b.name, 'de'))
)

async function loadStatePop() {
  try {
    const data = await $fetch('/api/area-children?level=2&includeGeo=false&first=100')
    if (!Array.isArray(data)) return
    for (const apiState of data) {
      const match = states.value.find(
        s => s.name.toLowerCase() === (apiState.name ?? '').toLowerCase()
      )
      if (match) match.population = apiState.population ?? null
    }
  } catch { /* non-critical */ } finally {
    statesLoading.value = false
  }
}

// ── Municipality data ──────────────────────────────────────────────────────────
const municipalities       = ref([])
const municipalitiesLoading = ref(false)

async function loadMunicipalities(stateArs) {
  municipalitiesLoading.value = true
  municipalities.value = []
  try {
    municipalities.value = await $stadtlandzahlAPI.fetchMunicipalitiesInRegion(stateArs, 2)
  } catch { /* ignore */ } finally {
    municipalitiesLoading.value = false
  }
}

// ── State machine actions ──────────────────────────────────────────────────────
function enterStateView(stateObj) {
  const meta    = statesLookupRaw.find(s => s.ars === stateObj.ars)
  const feature = featureByName(stateObj.name)
  selectedState.value = {
    ars:        stateObj.ars,
    name:       stateObj.name,
    prefix:     stateObj.prefix ?? meta?.prefix ?? '',
    population: stateObj.population
      ?? states.value.find(s => s.ars === stateObj.ars)?.population
      ?? null,
    geometry:   stateObj.geometry ?? feature?.geometry ?? null,
  }
  hoveredItem.value = null
  loadMunicipalities(selectedState.value.ars)
}

function exitStateView() {
  selectedState.value    = null
  municipalities.value   = []
  hoveredItem.value      = null
}

// ── SVG projection ─────────────────────────────────────────────────────────────
const SVG_W = 560
const SVG_H = 560

function buildProjection(features) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  function visit(c) {
    if (typeof c[0] === 'number') {
      if (c[0] < minLon) minLon = c[0]; if (c[0] > maxLon) maxLon = c[0]
      if (c[1] < minLat) minLat = c[1]; if (c[1] > maxLat) maxLat = c[1]
    } else c.forEach(visit)
  }
  for (const f of features) visit(f.geometry.coordinates)
  if (!isFinite(minLon)) return null
  const lonMid = (minLon + maxLon) / 2
  const latMid = (minLat + maxLat) / 2
  const cosLat = Math.cos(latMid * Math.PI / 180)
  const pad    = 0.07
  const scale  = Math.min(
    SVG_W * (1 - 2 * pad) / ((maxLon - minLon) * cosLat),
    SVG_H * (1 - 2 * pad) / (maxLat - minLat),
  )
  return (lon, lat) => [
    SVG_W / 2 + (lon - lonMid) * cosLat * scale,
    SVG_H / 2 - (lat - latMid) * scale,
  ]
}

const germanyProjection = computed(() => {
  const features = states.value.filter(s => s.geometry).map(s => ({ geometry: s.geometry }))
  return features.length ? buildProjection(features) : null
})

const stateProjection = computed(() => {
  const geo = selectedState.value?.geometry
  return geo ? buildProjection([{ geometry: geo }]) : null
})

// ── Path helpers ───────────────────────────────────────────────────────────────
function ringToPathStr(ring, project) {
  const MIN = 0.09
  let d = '', px = null, py = null
  for (const coord of ring) {
    const [x, y] = project(coord[0], coord[1])
    if (px === null) {
      d += `M${x.toFixed(1)},${y.toFixed(1)}`; px = x; py = y
    } else {
      const dx = x - px, dy = y - py
      if (dx * dx + dy * dy >= MIN) {
        d += `L${x.toFixed(1)},${y.toFixed(1)}`; px = x; py = y
      }
    }
  }
  return d + 'Z'
}

function geomToPath(geom, project) {
  if (geom.type === 'Polygon')
    return geom.coordinates.map(r => ringToPathStr(r, project)).join(' ')
  if (geom.type === 'MultiPolygon')
    return geom.coordinates.flatMap(p => p.map(r => ringToPathStr(r, project))).join(' ')
  return ''
}

function geomCentroid(geom, project) {
  let ring
  if (geom.type === 'Polygon') {
    ring = geom.coordinates[0]
  } else {
    let max = 0
    for (const poly of geom.coordinates) {
      if (poly[0].length > max) { max = poly[0].length; ring = poly[0] }
    }
  }
  if (!ring?.length) return [SVG_W / 2, SVG_H / 2]
  let sLon = 0, sLat = 0
  for (const c of ring) { sLon += c[0]; sLat += c[1] }
  return project(sLon / ring.length, sLat / ring.length)
}

function nameToLines(name) {
  const idx = name.indexOf('-')
  return idx !== -1 && name.length > 12 ? [name.slice(0, idx), name.slice(idx + 1)] : [name]
}

// ── Computed SVG elements ──────────────────────────────────────────────────────
const svgStatePaths = computed(() => {
  const project = germanyProjection.value
  if (!project) return []
  return states.value.filter(s => s.geometry).map(s => {
    const d = geomToPath(s.geometry, project)
    if (!d) return null
    const [cx, cy] = geomCentroid(s.geometry, project)
    return {
      ars:        s.ars,
      name:       s.name,
      prefix:     s.prefix,
      population: s.population,
      geometry:   s.geometry,
      d,
      fill:       popColor(s.population),
      cx:         cx.toFixed(1),
      cy:         cy.toFixed(1),
      labelLines: nameToLines(s.name),
    }
  }).filter(Boolean)
})

const selectedStateSvgPath = computed(() => {
  const project = stateProjection.value
  if (!project || !selectedState.value?.geometry) return ''
  return geomToPath(selectedState.value.geometry, project)
})

function parseGeoCenter(raw) {
  if (!raw) return null
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    // GeoJSON Point: { type: "Point", coordinates: [lon, lat] }
    if (Array.isArray(obj?.coordinates) && obj.coordinates.length >= 2)
      return { lon: obj.coordinates[0], lat: obj.coordinates[1] }
    // Bare [lon, lat] array
    if (Array.isArray(obj) && obj.length >= 2)
      return { lon: obj[0], lat: obj[1] }
    // Named fields (lat/lon) — fallback
    const lat = obj.lat ?? obj.latitude
    const lon = obj.lon ?? obj.lng ?? obj.longitude
    return typeof lat === 'number' && typeof lon === 'number' ? { lat, lon } : null
  } catch { return null }
}

const svgMunicipalityDots = computed(() => {
  const project = stateProjection.value
  if (!project || !municipalities.value.length) return []
  return municipalities.value.map(m => {
    const geo = parseGeoCenter(m.geoCenter)
    if (!geo) return null
    const [x, y] = project(geo.lon, geo.lat)
    if (x < -20 || x > SVG_W + 20 || y < -20 || y > SVG_H + 20) return null
    const score = m.stadtlandklimaDataAll?.[0]?.scoreTotal ?? null
    return {
      ars:        m.ars,
      name:       m.name,
      prefix:     m.prefix,
      population: m.population,
      scoreTotal: score,
      color:      scoreColor(score),
      x:          x.toFixed(1),
      y:          y.toFixed(1),
    }
  }).filter(Boolean)
})

// ── Color helpers ──────────────────────────────────────────────────────────────
function popColor(population) {
  if (!population) return '#cbd5e1'
  const maxLog = Math.log(18_000_000)
  const minLog = Math.log(700_000)
  const t = Math.min(Math.max((Math.log(population) - minLog) / (maxLog - minLog), 0), 1)
  const r = Math.round(224 * (1 - t) + 0 * t)
  const g = Math.round(242 * (1 - t) + 110 * t)
  const b = Math.round(241 * (1 - t) + 148 * t)
  return `rgb(${r},${g},${b})`
}

function scoreColor(score) {
  if (score == null) return '#CBD5E1'
  if (score >= 75)  return '#1EA64A'
  if (score >= 50)  return '#A3C53A'
  if (score >= 25)  return '#F0AA00'
  return '#E30613'
}

function municipalityHoverObj(m) {
  return {
    ars:        m.ars,
    name:       m.name,
    prefix:     m.prefix,
    population: m.population,
    scoreTotal: m.stadtlandklimaDataAll?.[0]?.scoreTotal ?? null,
  }
}

// ── Hero computed ──────────────────────────────────────────────────────────────
const heroPopulation = computed(() =>
  selectedState.value ? selectedState.value.population : props.area?.population
)

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(() => {
  if (isGermany.value) {
    loadStatePop()
  } else {
    // Bundesland detail page: pre-drill into this state
    statesLoading.value = false
    selectedState.value = {
      ars:        props.area.ars,
      name:       props.area.name,
      prefix:     props.area.prefix ?? '',
      population: props.area.population ?? null,
      geometry:   featureByName(props.area.name)?.geometry ?? null,
    }
    loadMunicipalities(props.area.ars)
  }
})
</script>
