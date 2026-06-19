<!--
  AreaOverview - interactive map for Germany (level 1) or Bundesland (level 2).
  Fills the remaining viewport height below the sticky breadcrumb with no scrolling.
  Germany view: SVG choropleth of 16 states from static GeoJSON.
  Bundesland page (level 2): starts pre-drilled into that state.
-->
<template>
  <div :style="{ height: mapHeight }" class="flex flex-col overflow-hidden">
    <div class="flex flex-col xl:grid xl:grid-cols-[1fr_320px] flex-1 min-h-0">

      <!-- ── SVG map ─────────────────────────────────────────────────────────── -->
      <div class="min-h-0 h-[42vh] xl:h-full bg-gray-50 p-4 xl:p-6">
        <div class="relative h-full overflow-hidden rounded-lg border border-gray-200 bg-white">

        <!-- Back button (Germany page when drilled into a state) -->
        <button
          v-if="selectedState && isGermany"
          class="btn btn-sm absolute top-3 left-3 z-20 min-h-0 h-9 border-white/80 bg-white/95 px-3 text-xs font-semibold text-gray-700 shadow-sm hover:border-[#006e94]/30 hover:bg-white hover:text-[#006e94]"
          @click="exitStateView()"
        >
          <Icon icon="mdi:arrow-left" class="h-4 w-4" />
          Alle Bundesländer
        </button>

        <!-- Municipality loading indicator -->
        <div
          v-if="municipalitiesLoading"
          class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm z-10 pointer-events-none"
        >
          <span class="loading loading-spinner loading-sm mr-2" />
          <span>Kommunen werden geladen...</span>
        </div>

        <!-- Germany choropleth (level 1, no state selected) -->
        <svg
          v-if="!selectedState && svgStatePaths.length"
          viewBox="0 0 560 560"
          xmlns="http://www.w3.org/2000/svg"
          class="relative z-0 w-full h-full drop-shadow-sm"
        >
          <!--
            paint-order: stroke fill — fill paints over the inner half of the stroke,
            leaving only the outer half visible. At shared edges between two states,
            both outer halves overlap exactly → uniform border width everywhere.
          -->
          <path
            v-for="s in svgStatePaths"
            :key="s.ars"
            :d="s.d"
            :fill="s.fill"
            :fill-opacity="hoveredItem?.ars === s.ars ? 0.9 : 0.75"
            stroke="#cbd5e1"
            stroke-width="1.2"
            stroke-linejoin="round"
            style="paint-order: stroke fill"
            class="cursor-pointer transition-opacity duration-150"
            @click="selectState(s)"
            @mouseenter="!isLeavingOverview && (hoveredItem = s)"
            @mouseleave="hoveredItem = null"
          />
          <!-- Hover highlight on top -->
          <path
            v-if="hoveredItem"
            :d="svgStatePaths.find(s => s.ars === hoveredItem.ars)?.d ?? ''"
            fill="none"
            stroke="#006e94"
            stroke-width="2"
            stroke-linejoin="round"
            style="pointer-events: none"
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

        <!-- Zoom controls -->
        <div
          v-if="selectedState && !municipalitiesLoading"
          class="absolute right-3 top-3 z-20 flex flex-col overflow-hidden rounded-lg border border-white/80 bg-white/95 shadow-sm"
        >
          <button
            class="btn btn-ghost btn-sm h-9 min-h-0 w-9 rounded-none px-0 text-gray-700 hover:bg-[#e6f1f5] hover:text-[#006e94]"
            aria-label="Karte vergrößern"
            @click="zoomIn()"
          >
            <Icon icon="mdi:plus" class="h-5 w-5" />
          </button>
          <button
            class="btn btn-ghost btn-sm h-9 min-h-0 w-9 rounded-none border-t border-gray-100 px-0 text-gray-700 hover:bg-[#e6f1f5] hover:text-[#006e94] disabled:opacity-40"
            :disabled="zoom <= MIN_ZOOM + 0.001"
            aria-label="Karte verkleinern"
            @click="zoomOut()"
          >
            <Icon icon="mdi:minus" class="h-5 w-5" />
          </button>
          <button
            class="btn btn-ghost btn-sm h-9 min-h-0 w-9 rounded-none border-t border-gray-100 px-0 text-gray-700 hover:bg-[#e6f1f5] hover:text-[#006e94]"
            aria-label="Karte zurücksetzen"
            @click="resetMapView()"
          >
            <Icon icon="mdi:fit-to-page-outline" class="h-5 w-5" />
          </button>
        </div>

        <div
          v-if="selectedState && !municipalitiesLoading"
          class="absolute bottom-3 right-3 z-20 hidden items-center gap-2 rounded-lg border border-white/80 bg-white/95 px-3 py-2 text-xs text-gray-500 shadow-sm sm:flex"
        >
          <Icon icon="mdi:magnify-plus-outline" class="h-4 w-4 text-[#006e94]" />
          <span class="tabular-nums font-semibold text-gray-700">{{ Math.round(zoom * 100) }}%</span>
          <span class="h-3 w-px bg-gray-200" />
          <span>Beschriftung ab {{ currentLabelThreshold.toLocaleString('de-DE') }} Einw.</span>
        </div>

        <!-- State drill-down: boundary + municipality dots + labels -->
        <svg
          v-if="selectedState && !municipalitiesLoading && (selectedStateSvgPath || svgMunicipalityDots.length)"
          ref="stateSvgRef"
          viewBox="0 0 560 560"
          xmlns="http://www.w3.org/2000/svg"
          class="relative z-0 w-full h-full touch-none select-none"
          overflow="hidden"
          :style="{ cursor: isDragging ? 'grabbing' : 'grab' }"
          @pointerdown="startDrag"
          @wheel.prevent="onWheel"
        >
          <g :transform="viewTransform">
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
              :r="m.radius"
              :fill="m.color"
              fill-opacity="0.85"
              stroke="white"
              :stroke-width="0.9 / zoom"
              style="cursor: pointer"
              @pointerdown.stop="prepareMunicipalityClick()"
              @click.stop="openMunicipality(m)"
              @mouseenter="!isLeavingOverview && (hoveredItem = m)"
              @mouseleave="hoveredItem = null"
            />
            <!-- Labels follow population thresholds for the current zoom tier. -->
            <text
              v-for="m in visibleMunicipalityLabels"
              :key="'lbl-' + m.ars"
              :x="m.x"
              :y="m.labelY"
              text-anchor="middle"
              dominant-baseline="hanging"
              :font-size="m.labelSize"
              font-weight="650"
              fill="#1f2937"
              stroke="white"
              :stroke-width="2.75 / zoom"
              stroke-linejoin="round"
              style="pointer-events: none; paint-order: stroke fill"
              class="select-none"
            >{{ m.name }}</text>
          </g>
        </svg>

        <div
          v-if="selectedState && !municipalitiesLoading && !selectedStateSvgPath && !svgMunicipalityDots.length"
          class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"
        >
          Keine Kartendaten verfügbar.
        </div>

        <!-- Hover tooltip -->
        <div
          v-if="hoveredItem && !municipalitiesLoading"
          class="absolute bottom-4 left-4 bg-white/95 rounded-xl shadow-lg ring-1 ring-black/5 px-4 py-3 pointer-events-none z-20 min-w-[180px]"
        >
          <div class="text-sm font-semibold text-gray-900 leading-snug">
            <span v-if="hoveredItem.prefix" class="text-xs font-normal text-gray-400 mr-1">{{ hoveredItem.prefix }}</span>{{ hoveredItem.name }}
          </div>
          <div v-if="hoveredItem.statusLabel" class="flex items-center gap-1.5 mt-1">
            <span class="w-2 h-2 rounded-full flex-none" :style="`background:${hoveredItem.color}`" />
            <span class="text-xs text-gray-600">{{ hoveredItem.statusLabel }}</span>
          </div>
          <div v-if="hoveredItem.population" class="text-xs text-gray-400 mt-0.5">
            {{ hoveredItem.population.toLocaleString('de-DE') }} Einwohner
          </div>
          <div v-if="hoveredItem.scoreTotal != null" class="text-xs mt-0.5 font-medium" :style="`color:${scoreColor(hoveredItem.scoreTotal)}`">
            {{ hoveredItem.scoreTotal.toFixed(1) }} Punkte SLK
          </div>
        </div>
        </div>
      </div>

      <!-- ── Sidebar ─────────────────────────────────────────────────────────── -->
      <div class="xl:border-l border-r border-b border-t xl:border-t-0 border-gray-100 flex flex-col overflow-hidden">

        <!-- Compact header: name + key stats -->
        <div class="px-4 xl:px-6 py-4 border-b border-gray-100 flex-none">
          <p class="text-xs font-bold text-[#006e94] uppercase tracking-widest mb-0.5">
            {{ selectedState ? 'Bundesland' : 'Bundesrepublik' }}
          </p>
          <h1 class="text-xl font-black text-gray-900 leading-tight">
            {{ selectedState ? selectedState.name : area.name }}
          </h1>
          <div class="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
            <div v-if="!selectedState && states.length" class="text-sm">
              <span class="font-bold tabular-nums text-gray-800">{{ states.length }}</span>
              <span class="text-gray-400 text-xs ml-1">Bundesländer</span>
            </div>
            <div v-if="selectedState && !municipalitiesLoading && municipalities.length" class="text-sm">
              <span class="font-bold tabular-nums text-gray-800">{{ visibleMunicipalities.length }}</span>
              <span class="text-gray-400 text-xs ml-1">sichtbare Kommunen</span>
            </div>
          </div>
        </div>

        <!-- Scrollable list -->
        <div class="overflow-y-auto flex-1">

          <!-- Germany view: states list -->
          <template v-if="!selectedState">
            <div class="divide-y divide-gray-50">
              <button
                v-for="s in sortedStates"
                :key="s.ars"
                class="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group text-left xl:px-6 xl:py-2"
                @click="selectState(s)"
                @mouseenter="!isLeavingOverview && (hoveredItem = s)"
                @mouseleave="hoveredItem = null"
              >
                <span class="text-sm font-semibold text-gray-800 group-hover:text-[#006e94] transition-colors">
                  {{ s.name }}
                </span>
              </button>
            </div>
          </template>

          <!-- State view: municipalities list -->
          <template v-else>
            <div v-if="municipalitiesLoading" class="p-6 text-sm text-gray-400 animate-pulse">
              Kommunen werden geladen…
            </div>
            <template v-else>
              <div class="px-4 xl:px-6 py-3 border-b border-gray-100">
                <h2 class="text-xs font-bold text-gray-500 uppercase tracking-wide">Bewertbare Kommunen</h2>
              </div>
              <div class="divide-y divide-gray-50">
                <NuxtLink
                  v-for="m in visibleMunicipalities"
                  :key="m.ars"
                  :to="`/data/${areaToSlug(m.prefix, m.name)}`"
                  class="grid grid-cols-[4.5rem_minmax(0,1fr)_1rem] items-center gap-3 px-4 xl:px-6 py-3 hover:bg-gray-50 transition-colors group"
                  @mouseenter="hoveredItem = municipalityHoverObj(m)"
                  @mouseleave="hoveredItem = null"
                >
                  <span class="text-right text-xs text-gray-400 truncate">{{ m.prefix }}</span>
                  <span class="min-w-0 text-left text-sm font-semibold text-gray-800 group-hover:text-[#006e94] transition-colors truncate">
                    {{ m.name }}
                  </span>
                  <div
                    class="w-3 h-3 rounded-full flex-none"
                    :style="`background:${scoreColor(m.stadtlandklimaDataAll?.[0]?.scoreTotal ?? null)}`"
                  />
                </NuxtLink>
              </div>
            </template>
          </template>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNuxtApp } from '#app'
import { Icon } from '@iconify/vue'
import { areaToSlug } from '~/composables/useAreaBySlug.js'
import { useHeaderHeight } from '~/composables/useHeaderHeight.js'
import { useMobileHeaderHidden } from '~/composables/useMobileHeaderHidden.js'
import { fetchMunicipalitiesManifest } from '~/composables/useMunicipalitiesManifest.js'
import germanyBorders from '~/assets/germany-state-borders.json'
import statesLookupRaw from '~/assets/germany-states-lookup.json'

const props = defineProps({
  area:        { type: Object, required: true },
  containedBy: { type: Array, default: () => [] },
})

const emit = defineEmits(['stateSelected', 'stateExited'])

const { $stadtlandzahlAPI, $directus, $readItems } = useNuxtApp()
const runtimeConfig             = useRuntimeConfig()
const baseUrl                   = runtimeConfig.public.stadtlandzahlBaseUrl
const isGermany             = computed(() => props.area?.level === 1)

// ── Height: fill viewport below header + breadcrumb ───────────────────────────
const headerHeight       = useHeaderHeight()
const mobileHeaderHidden = useMobileHeaderHidden()
const isDesktop          = useState('layout-isDesktop')

const reservedHeaderOffset = computed(() => isDesktop.value ? headerHeight.value : 64)
// 36px = breadcrumb nav height (py-2 + single line of text)
const mapHeight = computed(() => `calc(100dvh - ${reservedHeaderOffset.value + 36}px)`)

// ── Hover ──────────────────────────────────────────────────────────────────────
const hoveredItem = ref(null)

// ── State machine ─────────────────────────────────────────────────────────────
const selectedState = ref(null)
const zoom          = ref(1)
const pan           = ref({ x: 0, y: 0 })
const isDragging    = ref(false)
const isLeavingOverview = ref(false)
const stateSvgRef   = ref(null)
let _dragStart      = null
let _hasMoved       = false
let _activePointerId = null
let _zoomFrame       = null

const SVG_W = 560
const SVG_H = 560
const VIEW_CENTER = { x: SVG_W / 2, y: SVG_H / 2 }
const MIN_ZOOM = 1
const MAX_ZOOM = 8
const MAP_PADDING = 52
const LABEL_THRESHOLDS = [100_000, 50_000, 20_000, 5_000]
const DIRECT_DASHBOARD_STATE_ARS = new Set(['02', '11'])

function stateMeta(stateObj) {
  return statesLookupRaw.find(s => s.ars === stateObj?.ars)
}

function isDirectDashboardState(stateObj) {
  return isGermany.value && DIRECT_DASHBOARD_STATE_ARS.has(stateObj?.ars)
}

function dashboardHref(stateObj) {
  const meta = stateMeta(stateObj)
  const slug = stateObj?.slug ?? meta?.slug ?? areaToSlug(stateObj?.prefix ?? meta?.prefix ?? '', stateObj?.name ?? '')
  return `/data/${slug}`
}

// ── Static state data (no API call needed — geometry from static GeoJSON) ─
const lookupByName = Object.fromEntries(
  statesLookupRaw.map(s => [s.name1.toLowerCase(), s])
)

function featureByName(name) {
  return germanyBorders.features.find(
    f => f.properties.NAME_1.toLowerCase() === (name ?? '').toLowerCase()
  ) ?? null
}

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
    }
  }).filter(Boolean)
)

const sortedStates = computed(() =>
  [...states.value].sort((a, b) => a.name.localeCompare(b.name, 'de'))
)

// ── Municipality data ──────────────────────────────────────────────────────────
const municipalities          = ref([])
const municipalitiesLoading   = ref(false)
const directusStatusByArs     = ref({})

async function loadMunicipalities(stateArs) {
  municipalitiesLoading.value = true
  municipalities.value = []
  try {
    // Try pre-built manifest first (CDN-cached, instant after first load)
    const manifest = await fetchMunicipalitiesManifest(baseUrl)
    const fromManifest = manifest?.byState?.[stateArs.slice(0, 2)]
    if (fromManifest?.length) {
      municipalities.value = fromManifest
      return
    }
    // Fall back to live GraphQL query (used until manifest endpoint is deployed)
    municipalities.value = await $stadtlandzahlAPI.fetchMunicipalitiesInRegion(stateArs, 2)
  } catch {
    try {
      municipalities.value = await $stadtlandzahlAPI.fetchMunicipalitiesInRegion(stateArs, 2)
    } catch { }
  } finally {
    municipalitiesLoading.value = false
  }
}

async function loadDirectusMunicipalityStatus(stateArs) {
  directusStatusByArs.value = {}
  try {
    const items = await $directus.request($readItems('municipalities', {
      fields: ['ars', 'status'],
      filter: { ars: { _starts_with: stateArs.slice(0, 2) } },
      limit: 500,
    }))
    const map = {}
    for (const item of items ?? []) map[item.ars] = item.status
    directusStatusByArs.value = map
  } catch { /* non-critical — falls back to neutral color */ }
}

// ── State machine actions ──────────────────────────────────────────────────────
function rawCentroid(geom) {
  if (!geom) return null
  let ring
  if (geom.type === 'Polygon') {
    ring = geom.coordinates[0]
  } else if (geom.type === 'MultiPolygon') {
    let max = 0
    for (const poly of geom.coordinates) {
      if (poly[0].length > max) { max = poly[0].length; ring = poly[0] }
    }
  }
  if (!ring?.length) return null
  let sLon = 0, sLat = 0
  for (const c of ring) { sLon += c[0]; sLat += c[1] }
  return { lon: sLon / ring.length, lat: sLat / ring.length }
}

async function selectState(stateObj) {
  if (isDirectDashboardState(stateObj)) {
    isLeavingOverview.value = true
    hoveredItem.value = null
    await navigateTo(dashboardHref(stateObj))
    return
  }
  enterStateView(stateObj)
}

async function openMunicipality(municipality) {
  if (_hasMoved) return
  isLeavingOverview.value = true
  hoveredItem.value = null
  await navigateTo(`/data/${areaToSlug(municipality.prefix, municipality.name)}`)
}

function prepareMunicipalityClick() {
  _hasMoved = false
}

function enterStateView(stateObj) {
  const meta = stateMeta(stateObj)
  const feature = featureByName(stateObj.name)
  const geometry = stateObj.geometry ?? feature?.geometry ?? null
  selectedState.value = {
    ars:      stateObj.ars,
    name:     stateObj.name,
    prefix:   stateObj.prefix ?? meta?.prefix ?? '',
    geometry,
  }
  zoom.value = 1
  pan.value  = { x: 0, y: 0 }
  hoveredItem.value = null
  loadMunicipalities(selectedState.value.ars)
  loadDirectusMunicipalityStatus(selectedState.value.ars)
  emit('stateSelected', {
    ars:       selectedState.value.ars,
    name:      selectedState.value.name,
    prefix:    selectedState.value.prefix,
    geoCenter: rawCentroid(geometry),
  })
}

function exitStateView() {
  selectedState.value       = null
  municipalities.value      = []
  hoveredItem.value         = null
  zoom.value                = 1
  pan.value                 = { x: 0, y: 0 }
  directusStatusByArs.value = {}
  emit('stateExited')
}

function zoomIn()  { smoothZoomTo(zoom.value * 1.5) }
function zoomOut() { smoothZoomTo(zoom.value / 1.5) }
function resetMapView() { smoothZoomTo(MIN_ZOOM, VIEW_CENTER, { x: 0, y: 0 }) }

// ── Pan (drag) ─────────────────────────────────────────────────────────────────
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizedZoom(value) {
  return clamp(value, MIN_ZOOM, MAX_ZOOM)
}

function stateScreenBounds(nextZoom = zoom.value) {
  const bounds = selectedStateProjectedBounds.value
  if (!bounds) return null
  return {
    minX: bounds.minX * nextZoom + VIEW_CENTER.x * (1 - nextZoom),
    maxX: bounds.maxX * nextZoom + VIEW_CENTER.x * (1 - nextZoom),
    minY: bounds.minY * nextZoom + VIEW_CENTER.y * (1 - nextZoom),
    maxY: bounds.maxY * nextZoom + VIEW_CENTER.y * (1 - nextZoom),
  }
}

function clampAxis(value, minScreen, maxScreen, size) {
  const low = size - MAP_PADDING - maxScreen
  const high = MAP_PADDING - minScreen
  if (low > high) return (low + high) / 2
  return clamp(value, low, high)
}

function clampPan(x, y, nextZoom = zoom.value) {
  const bounds = stateScreenBounds(nextZoom)
  if (!bounds || nextZoom <= MIN_ZOOM + 0.001) return { x: 0, y: 0 }
  return {
    x: clampAxis(x, bounds.minX, bounds.maxX, SVG_W),
    y: clampAxis(y, bounds.minY, bounds.maxY, SVG_H),
  }
}

function svgDelta(dScreenX, dScreenY) {
  const el = stateSvgRef.value
  if (!el) return { dx: 0, dy: 0 }
  const rect = el.getBoundingClientRect()
  return { dx: dScreenX * SVG_W / rect.width, dy: dScreenY * SVG_H / rect.height }
}

function clientPointToSvg(clientX, clientY) {
  const el = stateSvgRef.value
  if (!el) return VIEW_CENTER
  const rect = el.getBoundingClientRect()
  return {
    x: (clientX - rect.left) * SVG_W / rect.width,
    y: (clientY - rect.top) * SVG_H / rect.height,
  }
}

function panForZoom(nextZoom, focusPoint = VIEW_CENTER, startZoom = zoom.value, startPan = pan.value) {
  const factor = nextZoom / startZoom
  const startTranslate = {
    x: startPan.x + VIEW_CENTER.x * (1 - startZoom),
    y: startPan.y + VIEW_CENTER.y * (1 - startZoom),
  }
  const nextTranslate = {
    x: focusPoint.x - factor * (focusPoint.x - startTranslate.x),
    y: focusPoint.y - factor * (focusPoint.y - startTranslate.y),
  }
  const nextPan = {
    x: nextTranslate.x - VIEW_CENTER.x * (1 - nextZoom),
    y: nextTranslate.y - VIEW_CENTER.y * (1 - nextZoom),
  }
  return clampPan(nextPan.x, nextPan.y, nextZoom)
}

function setZoom(nextZoom, focusPoint = VIEW_CENTER) {
  const z = normalizedZoom(nextZoom)
  pan.value = panForZoom(z, focusPoint)
  zoom.value = z
}

function smoothZoomTo(nextZoom, focusPoint = VIEW_CENTER, targetPan = null) {
  const fromZoom = zoom.value
  const toZoom = normalizedZoom(nextZoom)
  const fromPan = { ...pan.value }
  const toPan = targetPan ?? panForZoom(toZoom, focusPoint, fromZoom, fromPan)
  const start = performance.now()
  const duration = 190

  if (_zoomFrame) cancelAnimationFrame(_zoomFrame)

  function step(now) {
    const t = clamp((now - start) / duration, 0, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    zoom.value = fromZoom + (toZoom - fromZoom) * eased
    pan.value = {
      x: fromPan.x + (toPan.x - fromPan.x) * eased,
      y: fromPan.y + (toPan.y - fromPan.y) * eased,
    }
    if (t < 1) {
      _zoomFrame = requestAnimationFrame(step)
    } else {
      _zoomFrame = null
      zoom.value = toZoom
      pan.value = clampPan(toPan.x, toPan.y, toZoom)
    }
  }

  _zoomFrame = requestAnimationFrame(step)
}

function startDrag(e) {
  if (e.button !== 0) return
  if (_zoomFrame) cancelAnimationFrame(_zoomFrame)
  _activePointerId = e.pointerId
  stateSvgRef.value?.setPointerCapture?.(e.pointerId)
  _dragStart = { clientX: e.clientX, clientY: e.clientY, panX: pan.value.x, panY: pan.value.y }
  _hasMoved  = false
  isDragging.value = true
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup',  stopDrag)
  window.addEventListener('pointercancel', stopDrag)
  e.preventDefault()
}

function onDrag(e) {
  if (_activePointerId != null && e.pointerId !== _activePointerId) return
  if (!_dragStart) return
  const { dx, dy } = svgDelta(e.clientX - _dragStart.clientX, e.clientY - _dragStart.clientY)
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) _hasMoved = true
  pan.value = clampPan(_dragStart.panX + dx, _dragStart.panY + dy)
}

function stopDrag(e) {
  if (e && _activePointerId != null && e.pointerId !== _activePointerId) return
  if (_activePointerId != null) stateSvgRef.value?.releasePointerCapture?.(_activePointerId)
  _dragStart = null
  _activePointerId = null
  isDragging.value = false
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup',  stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
}

function onWheel(e) {
  const focus = clientPointToSvg(e.clientX, e.clientY)
  const factor = Math.exp(-e.deltaY * 0.0012)
  setZoom(zoom.value * factor, focus)
}

onUnmounted(() => {
  if (_zoomFrame) cancelAnimationFrame(_zoomFrame)
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup',  stopDrag)
  window.removeEventListener('pointercancel', stopDrag)
})

// ── SVG projection ─────────────────────────────────────────────────────────────
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
  if (!geo) return null
  const municipalityPoints = municipalities.value
    .map(m => parseGeoCenter(m.geoCenter))
    .filter(Boolean)
    .map(p => ({ geometry: { type: 'Point', coordinates: [p.lon, p.lat] } }))
  return buildProjection([{ geometry: geo }, ...municipalityPoints])
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

function geomProjectedBounds(geom, project) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  function visit(c) {
    if (typeof c[0] === 'number') {
      const [x, y] = project(c[0], c[1])
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      return
    }
    c.forEach(visit)
  }

  visit(geom.coordinates)
  return isFinite(minX) ? { minX, maxX, minY, maxY } : null
}

function nameToLines(name) {
  const idx = name.indexOf('-')
  return idx !== -1 && name.length > 12 ? [name.slice(0, idx), name.slice(idx + 1)] : [name]
}

// ── Computed SVG elements ──────────────────────────────────────────────────────
const viewTransform = computed(() => {
  const tx = pan.value.x + VIEW_CENTER.x * (1 - zoom.value)
  const ty = pan.value.y + VIEW_CENTER.y * (1 - zoom.value)
  return `translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) scale(${zoom.value.toFixed(4)})`
})

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
      geometry:   s.geometry,
      d,
      fill:       '#dbeafe',
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

const selectedStateProjectedBounds = computed(() => {
  const project = stateProjection.value
  if (!project || !selectedState.value?.geometry) return null
  return geomProjectedBounds(selectedState.value.geometry, project)
})

function parseGeoCenter(raw) {
  if (!raw) return null
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(obj?.coordinates) && obj.coordinates.length >= 2)
      return { lon: obj.coordinates[0], lat: obj.coordinates[1] }
    if (Array.isArray(obj) && obj.length >= 2)
      return { lon: obj[0], lat: obj[1] }
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
    const score  = m.stadtlandklimaDataAll?.[0]?.scoreTotal ?? null
    const info   = statusInfo(directusStatusByArs.value[m.ars])
    const population = m.population ?? null
    const dotRadius = markerRadius(population)
    return {
      ars:         m.ars,
      name:        m.name,
      prefix:      m.prefix,
      scoreTotal:  score,
      color:       info.color,
      statusLabel: info.label,
      population,
      x:           Number(x.toFixed(1)),
      y:           Number(y.toFixed(1)),
      radius:      dotRadius / zoom.value,
      labelSize:   labelFontSize(population) / zoom.value,
      labelY:      Number((y + (dotRadius + 4) / zoom.value).toFixed(1)),
    }
  }).filter(Boolean)
})

const zoomTier = computed(() => Math.min(3, Math.max(0, Math.floor(zoom.value) - 1)))

const currentLabelThreshold = computed(() => LABEL_THRESHOLDS[zoomTier.value])

const visibleMunicipalityLabels = computed(() =>
  svgMunicipalityDots.value
    .filter(m => (m.population ?? 0) >= currentLabelThreshold.value)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
)

function projectedPointIsVisible(dot) {
  const screenX = dot.x * zoom.value + VIEW_CENTER.x * (1 - zoom.value) + pan.value.x
  const screenY = dot.y * zoom.value + VIEW_CENTER.y * (1 - zoom.value) + pan.value.y
  return screenX >= 0 && screenX <= SVG_W && screenY >= 0 && screenY <= SVG_H
}

const visibleMunicipalityArs = computed(() => {
  const visible = new Set()
  for (const dot of svgMunicipalityDots.value) {
    if (projectedPointIsVisible(dot)) visible.add(dot.ars)
  }
  return visible
})

const visibleMunicipalities = computed(() => {
  if (!selectedState.value) return municipalities.value
  const visible = visibleMunicipalityArs.value
  return municipalities.value.filter(m => visible.has(m.ars))
})

// ── Color helpers ──────────────────────────────────────────────────────────────
function statusInfo(status) {
  switch (status) {
    case 'published': return { label: 'Vollständig bewertet', color: '#1EA64A' }
    case 'draft':     return { label: 'In Bewertung',         color: '#F0AA00' }
    case 'archived':  return { label: 'Abgebrochen',          color: '#E30613' }
    default:          return { label: 'Noch nicht gegründet', color: '#CBD5E1' }
  }
}

function scoreColor(score) {
  if (score == null) return '#CBD5E1'
  if (score >= 75)  return '#1EA64A'
  if (score >= 50)  return '#A3C53A'
  if (score >= 25)  return '#F0AA00'
  return '#E30613'
}

function markerRadius(pop) {
  if (!pop) return 4.25
  if (pop >= 100_000) return 6.2
  if (pop >= 50_000) return 5.4
  if (pop >= 20_000) return 4.8
  return 4.2
}

// Non-linear font-size in screen units; divided by zoom before rendering.
function labelFontSize(pop) {
  if (!pop) return 9.5
  if (pop >= 500_000) return 12
  if (pop >= 100_000) return 11
  if (pop >= 50_000) return 10.5
  return 9.5
}

function municipalityHoverObj(m) {
  const info = statusInfo(directusStatusByArs.value[m.ars])
  return {
    ars:         m.ars,
    name:        m.name,
    prefix:      m.prefix,
    scoreTotal:  m.stadtlandklimaDataAll?.[0]?.scoreTotal ?? null,
    color:       info.color,
    statusLabel: info.label,
    population:  m.population ?? null,
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(() => {
  if (!isGermany.value) {
    // Bundesland detail page: pre-drill into this state
    selectedState.value = {
      ars:        props.area.ars,
      name:       props.area.name,
      prefix:     props.area.prefix ?? '',
      geometry:   featureByName(props.area.name)?.geometry ?? null,
    }
    loadMunicipalities(props.area.ars)
    loadDirectusMunicipalityStatus(props.area.ars)
  }
})
</script>
