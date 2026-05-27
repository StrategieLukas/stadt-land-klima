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

      <!-- Choropleth map — pure SVG, no tile layer -->
      <div class="relative h-[400px] xl:h-[calc(100vh-220px)] rounded-2xl overflow-hidden bg-gray-50">
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          Karte wird geladen…
        </div>
        <svg
          v-else-if="svgPaths.length"
          viewBox="0 0 560 560"
          xmlns="http://www.w3.org/2000/svg"
          class="w-full h-full"
        >
          <path
            v-for="p in svgPaths"
            :key="p.ars"
            :d="p.d"
            :fill="p.fill"
            :stroke="hoveredArea?.ars === p.ars ? '#006e94' : '#cbd5e1'"
            :stroke-width="hoveredArea?.ars === p.ars ? 2 : 0.8"
            stroke-linejoin="round"
            :fill-opacity="hoveredArea?.ars === p.ars ? 0.9 : 0.75"
            class="cursor-pointer"
            @click="router.push(`/data/${toSlug(p.area.prefix, p.area.name)}`)"
            @mouseenter="hoveredArea = p.area"
            @mouseleave="hoveredArea = null"
          />
          <!-- State name labels for Germany overview -->
          <template v-if="isGermany">
            <text
              v-for="p in svgPaths"
              :key="'lbl-' + p.ars"
              :x="p.cx"
              text-anchor="middle"
              dominant-baseline="middle"
              font-size="10"
              font-weight="600"
              fill="#374151"
              class="pointer-events-none select-none"
            >
              <tspan :x="p.cx" :y="p.labelLines.length > 1 ? p.cy - 6 : p.cy">{{ p.labelLines[0] }}</tspan>
              <tspan v-if="p.labelLines[1]" :x="p.cx" :dy="13">{{ p.labelLines[1] }}</tspan>
            </text>
          </template>
        </svg>
        <div v-else-if="!loading" class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          Keine Kartendaten verfügbar.
        </div>
        <!-- Hover tooltip -->
        <div
          v-if="hoveredArea"
          class="absolute bottom-4 left-4 bg-white/95 rounded-xl shadow-lg px-4 py-2.5 text-sm font-semibold text-gray-900 pointer-events-none z-10"
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

const router      = useRouter()
const toSlug      = areaToSlug
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

// ── SVG choropleth ────────────────────────────────────────────────────────────

const SVG_W = 560
const SVG_H = 560

const svgProjection = computed(() => {
  if (!mapGeoJson.value?.features?.length) return null
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  function visitCoords(c) {
    if (typeof c[0] === 'number') {
      if (c[0] < minLon) minLon = c[0]
      if (c[0] > maxLon) maxLon = c[0]
      if (c[1] < minLat) minLat = c[1]
      if (c[1] > maxLat) maxLat = c[1]
    } else c.forEach(visitCoords)
  }
  for (const f of mapGeoJson.value.features) visitCoords(f.geometry.coordinates)
  const lonMid = (minLon + maxLon) / 2
  const latMid = (minLat + maxLat) / 2
  const cosLat = Math.cos(latMid * Math.PI / 180)
  const pad = 0.06
  const scale = Math.min(
    SVG_W * (1 - 2 * pad) / ((maxLon - minLon) * cosLat),
    SVG_H * (1 - 2 * pad) / (maxLat - minLat),
  )
  return (lon, lat) => [
    SVG_W / 2 + (lon - lonMid) * cosLat * scale,
    SVG_H / 2 - (lat - latMid) * scale,
  ]
})

function ringToPathStr(ring, project) {
  const MIN_DIST_SQ = 0.09
  let d = '', px = null, py = null
  for (const coord of ring) {
    const [x, y] = project(coord[0], coord[1])
    if (px === null) {
      d += `M${x.toFixed(1)},${y.toFixed(1)}`
      px = x; py = y
    } else {
      const dx = x - px, dy = y - py
      if (dx * dx + dy * dy >= MIN_DIST_SQ) {
        d += `L${x.toFixed(1)},${y.toFixed(1)}`
        px = x; py = y
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
    let maxLen = 0
    for (const poly of geom.coordinates) {
      if (poly[0].length > maxLen) { maxLen = poly[0].length; ring = poly[0] }
    }
  }
  if (!ring?.length) return [SVG_W / 2, SVG_H / 2]
  let sumLon = 0, sumLat = 0
  for (const c of ring) { sumLon += c[0]; sumLat += c[1] }
  return project(sumLon / ring.length, sumLat / ring.length)
}

function nameToLines(name) {
  const idx = name.indexOf('-')
  if (idx !== -1 && name.length > 12)
    return [name.slice(0, idx), name.slice(idx + 1)]
  return [name]
}

const svgPaths = computed(() => {
  const project = svgProjection.value
  if (!project || !mapGeoJson.value?.features?.length) return []
  return mapGeoJson.value.features.map(f => {
    const area = f.properties._area
    const d = geomToPath(f.geometry, project)
    if (!d) return null
    const [cx, cy] = geomCentroid(f.geometry, project)
    return {
      ars:        area.ars,
      d,
      fill:       popColor(area.population),
      cx:         cx.toFixed(1),
      cy:         cy.toFixed(1),
      labelLines: nameToLines(area.name),
      area,
    }
  }).filter(Boolean)
})

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
