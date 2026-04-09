<template>
  <div class="my-8 border-t-4 border-gray-200 pt-6">
    <h2 class="font-heading text-h2 font-bold text-gray mb-1">Bewertungsübersicht aller Kommunen</h2>
    <p class="text-sm text-gray-500 mb-4">
      Klicken Sie auf einen Bereich, um die zugehörigen Kommunen anzuzeigen.
    </p>

    <div v-if="loading" class="text-gray-400 text-sm py-8 text-center">Daten werden geladen…</div>
    <div v-else-if="!hasData" class="text-gray-500 text-sm py-4">Keine Bewertungsdaten vorhanden.</div>

    <div v-else>
      <!-- Version legend -->
      <div v-if="orderedVersions.length > 1" class="flex flex-wrap gap-4 mb-4">
        <div v-for="v in orderedVersions" :key="v.id" class="flex items-center gap-1.5 text-xs text-gray-600">
          <span class="inline-block w-4 h-3 rounded-sm flex-shrink-0" :style="{ backgroundColor: v.color }" />
          <span class="font-bold">{{ v.label }}</span>
          <span class="text-gray-400">({{ versionCounts[v.id] || 0 }} Kommunen)</span>
        </div>
      </div>

      <!-- SVG Sankey -->
      <div class="overflow-x-auto">
        <svg
          :viewBox="`0 0 ${SVG_W} ${svgHeight}`"
          :style="{ width: '100%', maxWidth: SVG_W + 'px', height: 'auto' }"
          class="block"
        >
          <!-- Flows (drawn first, behind nodes) -->
          <path
            v-for="flow in flows"
            :key="`flow-${flow.versionKey}-${flow.ratingKey}`"
            :d="flow.path"
            :fill="ratingColorMap[flow.ratingKey] || '#999'"
            :opacity="isActiveFlow(flow) ? 0.75 : isHoveredFlow(flow) ? 0.6 : flow.baseOpacity"
            class="cursor-pointer"
            style="transition: opacity 0.15s ease;"
            @mouseenter="hoveredFlow = { versionKey: flow.versionKey, ratingKey: flow.ratingKey }"
            @mouseleave="hoveredFlow = null"
            @click="toggleFlow(flow)"
          />

          <!-- Left nodes (one per catalog version) -->
          <g v-for="ln in leftNodes" :key="`ln-${ln.key}`">
            <rect :x="LEFT_X" :y="ln.y1" :width="NODE_W" :height="ln.h" :fill="ln.color" rx="3" />
            <text
              :x="LEFT_X - 9"
              :y="ln.h >= 32 ? ln.y1 + ln.h / 2 - 8 : ln.y1 + ln.h / 2"
              text-anchor="end" dominant-baseline="middle"
              style="font-size: 12px; fill: #333; font-weight: 700;"
            >{{ ln.label }}</text>
            <text
              v-if="ln.h >= 32"
              :x="LEFT_X - 9"
              :y="ln.y1 + ln.h / 2 + 8"
              text-anchor="end" dominant-baseline="middle"
              style="font-size: 11px; fill: #888;"
            >({{ ln.count }})</text>
          </g>

          <!-- Right nodes (one per rating bucket) -->
          <g v-for="rn in rightNodes" :key="`rn-${rn.key}`">
            <rect :x="RIGHT_X" :y="rn.y1" :width="NODE_W" :height="rn.h" :fill="rn.color" rx="3" />
            <text
              :x="RIGHT_X + NODE_W + 9"
              :y="rn.h >= 32 ? rn.y1 + rn.h / 2 - 8 : rn.y1 + rn.h / 2"
              dominant-baseline="middle"
              style="font-size: 11px; fill: #333; font-weight: 600;"
            >{{ rn.label }}</text>
            <text
              v-if="rn.h >= 32"
              :x="RIGHT_X + NODE_W + 9"
              :y="rn.y1 + rn.h / 2 + 7"
              dominant-baseline="middle"
              style="font-size: 11px; fill: #888;"
            >({{ rn.total }})</text>
          </g>
        </svg>
      </div>

      <!-- Municipality detail panel -->
      <Transition name="fade-panel">
        <div
          v-if="activeFlow && activeFlowData"
          class="mt-4 p-4 rounded-lg border"
          :style="{ borderColor: (ratingColorMap[activeFlow.ratingKey] || '#999') + 'aa', backgroundColor: (ratingColorMap[activeFlow.ratingKey] || '#999') + '14' }"
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-sm text-gray-800 flex items-center gap-2">
              <span class="inline-block w-3 h-3 rounded-sm flex-shrink-0" :style="{ backgroundColor: ratingColorMap[activeFlow.ratingKey] || '#999' }" />
              <span class="font-bold" :style="{ color: versionColorMap[activeFlow.versionKey] }">{{ versionLabelMap[activeFlow.versionKey] }}</span>:
              {{ ratingLabelMap[activeFlow.ratingKey] }} — {{ activeFlowData.length }} Kommunen
            </h3>
            <button @click="activeFlow = null" class="text-gray-400 hover:text-gray-600 text-lg leading-none px-1" aria-label="Schließen">✕</button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <template v-for="m in activeFlowData" :key="m.slug || m.name">
              <NuxtLink
                v-if="m.slug"
                :to="`/municipalities/${m.slug}`"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white border text-xs text-gray-700 hover:shadow-sm transition-shadow whitespace-nowrap"
                :style="{ borderColor: (ratingColorMap[activeFlow.ratingKey] || '#999') + '66' }"
              >{{ m.name }}</NuxtLink>
              <span
                v-else
                class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-xs text-gray-400 whitespace-nowrap"
              >{{ m.name }}</span>
            </template>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  measureSlug: { type: String, required: true },
  measureVersions: { type: Array, default: () => [] }, // [{ catalog_version: { id, name } }]
})

const { $directus, $readItems } = useNuxtApp()

// ── Layout constants ──────────────────────────────────────────────────────────
const SVG_W = 560
const LEFT_X = 155
const RIGHT_X = 336
const NODE_W = 16
const PAD = 24
const VERSION_GAP = 18  // vertical gap between left nodes (catalog versions)
const BUCKET_GAP = 6    // vertical gap between right rating-bucket nodes
const MIN_NODE_H = 20
const MID_X = (LEFT_X + NODE_W + RIGHT_X) / 2  // ≈ 253 — bezier control point x

// ── Rating config ─────────────────────────────────────────────────────────────
const RATING_CONFIG = [
  { key: '1',    label: 'Vollständig erfüllt', color: '#1da64a' },
  { key: '0.75', label: 'Gut erfüllt',          color: '#8bc34a' },
  { key: '0.5',  label: 'Teilweise erfüllt',    color: '#fdd835' },
  { key: '0.25', label: 'Kaum erfüllt',         color: '#f39200' },
  { key: '0',    label: 'Nicht erfüllt',        color: '#d32f2f' },
  { key: 'na',   label: 'Nicht anwendbar',      color: '#9e9e9e' },
]
const ratingColorMap = Object.fromEntries(RATING_CONFIG.map(r => [r.key, r.color]))
const ratingLabelMap = Object.fromEntries(RATING_CONFIG.map(r => [r.key, r.label]))

// ── Version colors ────────────────────────────────────────────────────────────
function getVersionColor(name) {
  if (name === 'v1.0') return '#AFCA0B'   // olive — matches 2026 catalog UI
  if (name === 'beta') return '#16BAE7'   // light-blue — matches 2025/beta catalog UI
  return '#9e9e9e'
}

// ── State ─────────────────────────────────────────────────────────────────────
const loading = ref(true)
const rawData = ref({})   // { [versionId]: { ratingBuckets: { ratingKey: [{name, slug}] } } }
const hoveredFlow = ref(null)
const activeFlow = ref(null)

// ── Derived version list ──────────────────────────────────────────────────────
const orderedVersions = computed(() => {
  const seen = new Set()
  return (props.measureVersions || [])
    .map(mv => mv.catalog_version)
    .filter(cv => cv && !seen.has(cv.id) && seen.add(cv.id))
    .map(cv => ({ id: cv.id, label: cv.name, color: getVersionColor(cv.name) }))
})

const versionLabelMap = computed(() => Object.fromEntries(orderedVersions.value.map(v => [v.id, v.label])))
const versionColorMap = computed(() => Object.fromEntries(orderedVersions.value.map(v => [v.id, v.color])))

const versionCounts = computed(() => {
  const out = {}
  for (const v of orderedVersions.value) {
    const vd = rawData.value[v.id]
    out[v.id] = vd ? Object.values(vd.ratingBuckets).reduce((s, arr) => s + arr.length, 0) : 0
  }
  return out
})

const hasData = computed(() => orderedVersions.value.some(v => (versionCounts.value[v.id] || 0) > 0))

// ── Data fetch ────────────────────────────────────────────────────────────────
async function fetchAll() {
  if (!orderedVersions.value.length) return
  loading.value = true
  activeFlow.value = null

  try {
    // 1. Fetch measure UUID for every catalog version
    const measureRows = await $directus.request(
      $readItems('measures', {
        fields: ['id', 'catalog_version'],
        filter: { slug: { _eq: props.measureSlug } },
        limit: -1,
      }),
    )
    const versionToMeasureId = {}
    for (const row of measureRows || []) {
      const vId = typeof row.catalog_version === 'string' ? row.catalog_version : row.catalog_version?.id
      if (vId) versionToMeasureId[vId] = row.id
    }

    // 2. Fetch ratings for all versions in parallel
    const results = await Promise.all(
      orderedVersions.value.map(async (v) => {
        const measureId = versionToMeasureId[v.id]
        if (!measureId) return { versionId: v.id, ratings: [] }
        const data = await $directus.request(
          $readItems('ratings_measures', {
            fields: ['rating', 'applicable', 'localteam_id'],
            filter: { measure_id: { _eq: measureId } },
            limit: -1,
          }),
        )
        return { versionId: v.id, ratings: data || [] }
      }),
    )

    // 3. Batch-fetch municipality slugs via localteam_id
    const allLocalteamIds = [
      ...new Set(
        results.flatMap(r =>
          r.ratings
            .map(row => (typeof row.localteam_id === 'string' ? row.localteam_id : row.localteam_id?.id))
            .filter(Boolean),
        ),
      ),
    ]

    const localteamToMuni = {}
    if (allLocalteamIds.length) {
      const muniRows = await $directus.request(
        $readItems('municipalities', {
          fields: ['localteam_id', 'slug', 'name'],
          filter: { localteam_id: { _in: allLocalteamIds }, status: { _eq: 'published' } },
          limit: -1,
        }),
      )
      for (const m of muniRows || []) {
        const ltId = typeof m.localteam_id === 'string' ? m.localteam_id : m.localteam_id?.id
        if (ltId) localteamToMuni[ltId] = { slug: m.slug, name: m.name }
      }
    }

    // 4. Assemble rawData keyed by version ID
    const newData = {}
    for (const { versionId, ratings } of results) {
      const ratingBuckets = {}
      for (const r of ratings) {
        const ratingKey = r.applicable === false ? 'na' : (r.rating ?? null)
        if (ratingKey === null) continue
        const ltId = typeof r.localteam_id === 'string' ? r.localteam_id : r.localteam_id?.id
        const muni = ltId ? localteamToMuni[ltId] : null
        if (!ratingBuckets[ratingKey]) ratingBuckets[ratingKey] = []
        ratingBuckets[ratingKey].push({ name: muni?.name || '?', slug: muni?.slug || null })
      }
      for (const key of Object.keys(ratingBuckets)) {
        ratingBuckets[key].sort((a, b) => a.name.localeCompare(b.name, 'de'))
      }
      newData[versionId] = { ratingBuckets }
    }
    rawData.value = newData
  } finally {
    loading.value = false
  }
}

watch(
  () => props.measureSlug + '|' + orderedVersions.value.map(v => v.id).join(','),
  fetchAll,
  { immediate: true },
)

// ── Sankey layout ─────────────────────────────────────────────────────────────
const sankeyLayout = computed(() => {
  if (!hasData.value) return { leftNodes: [], rightNodes: [], flows: [] }

  const versions = orderedVersions.value
  const activeRatings = RATING_CONFIG.filter(cfg =>
    versions.some(v => (rawData.value[v.id]?.ratingBuckets?.[cfg.key] || []).length > 0),
  )

  // px per municipality — calibrated to the largest single version so bars are comparable
  const maxVersionTotal = Math.max(...versions.map(v => versionCounts.value[v.id] || 0), 1)
  const UNIT_H = Math.max(2, Math.min(10, 360 / maxVersionTotal))

  // ── Right nodes: height = combined count across all versions ─────────────────
  let rightY = PAD
  const rightNodeMap = {}
  const rightNodeList = []
  for (const cfg of activeRatings) {
    const total = versions.reduce((s, v) => s + (rawData.value[v.id]?.ratingBuckets?.[cfg.key] || []).length, 0)
    const nodeH = Math.max(MIN_NODE_H, Math.round(total * UNIT_H))
    rightNodeMap[cfg.key] = { y1: rightY, h: nodeH, allocated: 0, total }
    rightNodeList.push({ key: cfg.key, label: cfg.label, color: cfg.color, y1: rightY, h: nodeH, total })
    rightY += nodeH + BUCKET_GAP
  }

  // ── Left nodes + flows ────────────────────────────────────────────────────────
  // Within each right bucket, versions stack top→bottom — flows never overlap.
  let leftY = PAD
  const leftNodeList = []
  const flowList = []
  const BASE_OPACITIES = [0.55, 0.40, 0.30]

  for (let vi = 0; vi < versions.length; vi++) {
    const v = versions[vi]
    const vd = rawData.value[v.id] || { ratingBuckets: {} }
    const leftStart = leftY
    let leftOffset = 0

    for (const cfg of activeRatings) {
      const munis = vd.ratingBuckets[cfg.key] || []
      if (!munis.length) continue

      const flowH = Math.max(1, Math.round(munis.length * UNIT_H))
      const lY1 = leftStart + leftOffset
      const lY2 = lY1 + flowH
      const rNode = rightNodeMap[cfg.key]
      const rY1 = rNode.y1 + rNode.allocated
      const rY2 = rY1 + flowH
      rNode.allocated += flowH
      leftOffset += flowH

      const lx = LEFT_X + NODE_W
      const rx = RIGHT_X
      const path = [
        `M ${lx} ${lY1}`,
        `C ${MID_X} ${lY1} ${MID_X} ${rY1} ${rx} ${rY1}`,
        `L ${rx} ${rY2}`,
        `C ${MID_X} ${rY2} ${MID_X} ${lY2} ${lx} ${lY2}`,
        'Z',
      ].join(' ')

      flowList.push({
        versionKey: v.id,
        ratingKey: cfg.key,
        versionIdx: vi,
        path,
        baseOpacity: BASE_OPACITIES[vi] ?? 0.4,
      })
    }

    const nodeH = Math.max(MIN_NODE_H, leftOffset)
    leftNodeList.push({ key: v.id, label: v.label, color: v.color, y1: leftStart, h: nodeH, count: versionCounts.value[v.id] || 0 })
    leftY += nodeH + VERSION_GAP
  }

  return { leftNodes: leftNodeList, rightNodes: rightNodeList, flows: flowList }
})

const leftNodes = computed(() => sankeyLayout.value.leftNodes)
const rightNodes = computed(() => sankeyLayout.value.rightNodes)
const flows = computed(() => sankeyLayout.value.flows)

const svgHeight = computed(() => {
  const allY2 = [
    ...leftNodes.value.map(n => n.y1 + n.h),
    ...rightNodes.value.map(n => n.y1 + n.h),
  ]
  return allY2.length ? Math.max(...allY2) + PAD : 200
})

// ── Interaction ───────────────────────────────────────────────────────────────
const activeFlowData = computed(() => {
  if (!activeFlow.value) return null
  const { versionKey, ratingKey } = activeFlow.value
  return rawData.value[versionKey]?.ratingBuckets?.[ratingKey] || null
})

function isActiveFlow(flow) {
  return activeFlow.value?.versionKey === flow.versionKey && activeFlow.value?.ratingKey === flow.ratingKey
}
function isHoveredFlow(flow) {
  return hoveredFlow.value?.versionKey === flow.versionKey && hoveredFlow.value?.ratingKey === flow.ratingKey
}
function toggleFlow(flow) {
  activeFlow.value = isActiveFlow(flow) ? null : { versionKey: flow.versionKey, ratingKey: flow.ratingKey }
}
</script>

<style scoped>
.fade-panel-enter-active,
.fade-panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-panel-enter-from,
.fade-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
