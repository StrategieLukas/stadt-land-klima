<template>
  <div class="my-8 border-t-4 border-gray-200 pt-6">
    <h2 class="font-heading text-h2 font-bold text-gray mb-1">Bewertungsverlauf aller Kommunen</h2>
    <p class="text-sm text-gray-500 mb-4">
      Jede Linie steht für eine Kommune. Fahren Sie mit der Maus darüber für Details — klicken Sie, um zur Kommune zu springen.
    </p>

    <div v-if="loading" class="text-gray-400 text-sm py-8 text-center">Daten werden geladen…</div>
    <div v-else-if="!hasData" class="text-gray-500 text-sm py-4">Keine Bewertungsdaten vorhanden.</div>

    <template v-else>
      <!-- Change summary chips (only when 2 versions exist) -->
      <div v-if="twoVersions" class="flex flex-wrap gap-2 mb-4 text-xs">
        <span v-if="improvedCount" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-bold">↑ {{ improvedCount }} verbessert</span>
        <span v-if="sameCount" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200 font-bold">→ {{ sameCount }} gleich</span>
        <span v-if="degradedCount" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold">↓ {{ degradedCount }} verschlechtert</span>
        <span v-if="onlySingleCount" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200 font-bold">{{ onlySingleCount }} nur in einem Katalog</span>
      </div>

      <!-- Alluvial SVG -->
      <div class="overflow-x-auto">
        <svg
          :viewBox="`0 0 ${SVG_W} ${svgH}`"
          :style="{ width: '100%', maxWidth: SVG_W + 'px', height: 'auto' }"
          class="block select-none"
          @mouseleave="hoveredKey = null"
        >
          <!-- Ribbons drawn first (behind node rects) -->
          <path
            v-for="r in ribbons"
            :key="r.key"
            :d="r.path"
            :fill="r.changeColor"
            :opacity="hoveredKey ? (hoveredKey === r.key ? 0.9 : 0.07) : 0.42"
            class="cursor-pointer"
            style="transition: opacity 0.08s ease;"
            @mouseenter="hoveredKey = r.key"
            @click="navigateToMuni(r)"
          />

          <!-- Left node rects -->
          <g v-for="n in leftNodes" :key="`ln-${n.key}`">
            <rect :x="LEFT_X" :y="n.y1" :width="NODE_W" :height="n.h" :fill="n.color" rx="2" />
            <text
              v-if="n.h >= 13"
              :x="LEFT_X - 7"
              :y="n.y1 + n.h / 2"
              text-anchor="end"
              dominant-baseline="middle"
              style="font-size: 10px; font-weight: 600;"
              :fill="n.color"
            >{{ n.shortLabel }} ({{ n.count }})</text>
          </g>

          <!-- Right node rects -->
          <g v-for="n in rightNodes" :key="`rn-${n.key}`">
            <rect :x="RIGHT_X" :y="n.y1" :width="NODE_W" :height="n.h" :fill="n.color" rx="2" />
            <text
              v-if="n.h >= 13"
              :x="RIGHT_X + NODE_W + 7"
              :y="n.y1 + n.h / 2"
              dominant-baseline="middle"
              style="font-size: 10px; font-weight: 600;"
              :fill="n.color"
            >{{ n.shortLabel }} ({{ n.count }})</text>
          </g>

          <!-- Version header labels -->
          <text
            v-if="leftVersion"
            :x="LEFT_X + NODE_W / 2"
            :y="14"
            text-anchor="middle"
            style="font-size: 12px; font-weight: 700;"
            :fill="leftVersion.color"
          >{{ leftVersion.label }}</text>
          <text
            v-if="twoVersions && rightVersion"
            :x="RIGHT_X + NODE_W / 2"
            :y="14"
            text-anchor="middle"
            style="font-size: 12px; font-weight: 700;"
            :fill="rightVersion.color"
          >{{ rightVersion.label }}</text>
        </svg>
      </div>

      <!-- Hover info bar -->
      <div class="mt-2 min-h-[2.5rem] flex items-center">
        <Transition name="fade-info">
          <div v-if="hoveredMuniData" class="flex flex-wrap items-center gap-2 text-sm">
            <NuxtLink
              v-if="hoveredMuniData.slug"
              :to="`/municipalities/${hoveredMuniData.slug}`"
              class="font-semibold text-gray-800 hover:underline"
            >{{ hoveredMuniData.name }}</NuxtLink>
            <span v-else class="font-semibold text-gray-700">{{ hoveredMuniData.name }}</span>
            <template v-if="twoVersions && hoveredMuniData.leftRating !== null && hoveredMuniData.rightRating !== null">
              <span class="text-gray-300 select-none">|</span>
              <span
                class="text-xs px-1.5 py-0.5 rounded font-bold text-white"
                :style="{ backgroundColor: ratingColorMap[hoveredMuniData.leftRating] || '#999' }"
              >{{ leftVersion?.label }}: {{ ratingLabelMap[hoveredMuniData.leftRating] }}</span>
              <span class="font-bold" :style="{ color: hoveredMuniData.changeColor }">{{ changeArrow(hoveredMuniData) }}</span>
              <span
                class="text-xs px-1.5 py-0.5 rounded font-bold text-white"
                :style="{ backgroundColor: ratingColorMap[hoveredMuniData.rightRating] || '#999' }"
              >{{ rightVersion?.label }}: {{ ratingLabelMap[hoveredMuniData.rightRating] }}</span>
            </template>
            <template v-else-if="hoveredMuniData.leftRating !== null">
              <span class="text-gray-300 select-none">|</span>
              <span
                class="text-xs px-1.5 py-0.5 rounded font-bold text-white"
                :style="{ backgroundColor: ratingColorMap[hoveredMuniData.leftRating] || '#999' }"
              >{{ ratingLabelMap[hoveredMuniData.leftRating] }}</span>
            </template>
          </div>
          <p v-else class="text-xs text-gray-400 italic">Überfahren Sie eine Linie für Details zur Kommune.</p>
        </Transition>
      </div>

      <!-- Color legend -->
      <div v-if="twoVersions" class="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        <span class="flex items-center gap-1.5"><span class="inline-block w-8 h-2 rounded" style="background:#4caf50;opacity:0.7" /> Verbessert</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-8 h-2 rounded" style="background:#9e9e9e;opacity:0.7" /> Gleich geblieben</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-8 h-2 rounded" style="background:#f44336;opacity:0.7" /> Verschlechtert</span>
        <span class="flex items-center gap-1.5"><span class="inline-block w-8 h-2 rounded" style="background:#bdbdbd;opacity:0.7" /> Nicht vergleichbar (n/a)</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  measureSlug: { type: String, required: true },
  measureVersions: { type: Array, default: () => [] }, // [{ catalog_version: { id, name } }]
})

const { $directus, $readItems } = useNuxtApp()
const router = useRouter()

// ── Layout constants ──────────────────────────────────────────────────────────
const SVG_W = 560
const LEFT_X = 148      // left node rect x
const NODE_W = 12
const RIGHT_X = 382     // right node rect x
const MID_X = Math.round((LEFT_X + NODE_W + RIGHT_X) / 2)
const PAD_TOP = 28      // space at top for version headers
const BUCKET_GAP = 8    // vertical gap between rating buckets

// ── Rating config ─────────────────────────────────────────────────────────────
const RATING_KEYS = ['1', '0.75', '0.5', '0.25', '0', 'na']
const RATING_CFG = {
  '1':    { label: 'Vollständig erfüllt', shortLabel: '100%', color: '#1da64a' },
  '0.75': { label: 'Gut erfüllt',          shortLabel: '75%',  color: '#8bc34a' },
  '0.5':  { label: 'Teilweise erfüllt',    shortLabel: '50%',  color: '#fdd835' },
  '0.25': { label: 'Kaum erfüllt',         shortLabel: '25%',  color: '#f39200' },
  '0':    { label: 'Nicht erfüllt',        shortLabel: '0%',   color: '#d32f2f' },
  'na':   { label: 'Nicht anwendbar',      shortLabel: 'n/a',  color: '#9e9e9e' },
}
const ratingColorMap = Object.fromEntries(Object.entries(RATING_CFG).map(([k, v]) => [k, v.color]))
const ratingLabelMap = Object.fromEntries(Object.entries(RATING_CFG).map(([k, v]) => [k, v.label]))
const ratingIdxMap  = Object.fromEntries(RATING_KEYS.map((k, i) => [k, i]))

function getVersionColor(name) {
  if (name === 'v1.0') return '#AFCA0B'
  if (name === 'beta') return '#16BAE7'
  return '#9e9e9e'
}

// ── State ─────────────────────────────────────────────────────────────────────
const loading = ref(true)
// munis: [{ key: localteamId, name, slug, leftRating, rightRating }]
const munis = ref([])
const hoveredKey = ref(null)

// ── Versions ──────────────────────────────────────────────────────────────────
const orderedVersions = computed(() => {
  const seen = new Set()
  return (props.measureVersions || [])
    .map(mv => mv.catalog_version)
    .filter(cv => cv && !seen.has(cv.id) && seen.add(cv.id))
    .map(cv => ({ id: cv.id, label: cv.name, color: getVersionColor(cv.name) }))
    .sort((a, b) => a.label.localeCompare(b.label)) // beta < v1.0 alphabetically
})

const twoVersions  = computed(() => orderedVersions.value.length >= 2)
const leftVersion  = computed(() => orderedVersions.value[0] ?? null)
const rightVersion = computed(() => orderedVersions.value[1] ?? orderedVersions.value[0] ?? null)

// ── Data fetch ────────────────────────────────────────────────────────────────
async function fetchAll() {
  if (!orderedVersions.value.length) return
  loading.value = true
  try {
    // 1. Resolve measure UUID for each catalog version
    const measureRows = await $directus.request(
      $readItems('measures', {
        fields: ['id', 'catalog_version'],
        filter: { slug: { _eq: props.measureSlug } },
        limit: -1,
      }),
    )
    const vIdToMeasureId = {}
    for (const row of measureRows || []) {
      const vId = typeof row.catalog_version === 'string' ? row.catalog_version : row.catalog_version?.id
      if (vId) vIdToMeasureId[vId] = row.id
    }

    // 2. Fetch ratings for left and right versions in parallel
    async function fetchRatings(versionId) {
      const measureId = vIdToMeasureId[versionId]
      if (!measureId) return []
      return $directus.request(
        $readItems('ratings_measures', {
          fields: ['rating', 'applicable', 'localteam_id'],
          filter: { measure_id: { _eq: measureId } },
          limit: -1,
        }),
      )
    }

    const leftId  = leftVersion.value?.id
    const rightId = twoVersions.value ? rightVersion.value?.id : null

    const [leftRaw, rightRaw] = await Promise.all([
      leftId  ? fetchRatings(leftId)  : Promise.resolve([]),
      rightId ? fetchRatings(rightId) : Promise.resolve([]),
    ])

    // 3. Build per-localteam rating maps (dedup: first published entry wins)
    function toRatingMap(rows) {
      const map = {}
      for (const r of rows || []) {
        const ltId = typeof r.localteam_id === 'string' ? r.localteam_id : r.localteam_id?.id
        if (!ltId || map[ltId] !== undefined) continue
        const rk = r.applicable === false ? 'na' : (r.rating ?? null)
        if (rk !== null) map[ltId] = rk
      }
      return map
    }
    const leftMap  = toRatingMap(leftRaw)
    const rightMap = toRatingMap(rightRaw)

    // 4. Collect all unique localteam IDs
    const allLtIds = [...new Set([...Object.keys(leftMap), ...Object.keys(rightMap)])]

    // 5. Batch-fetch municipality slugs + names
    const muniRows = allLtIds.length
      ? await $directus.request(
          $readItems('municipalities', {
            fields: ['localteam_id', 'slug', 'name'],
            filter: { localteam_id: { _in: allLtIds }, status: { _eq: 'published' } },
            limit: -1,
          }),
        )
      : []
    const ltToMuni = {}
    for (const m of muniRows || []) {
      const ltId = typeof m.localteam_id === 'string' ? m.localteam_id : m.localteam_id?.id
      if (ltId) ltToMuni[ltId] = { slug: m.slug, name: m.name }
    }

    // 6. Assemble municipality list
    munis.value = allLtIds
      .map(ltId => ({
        key:         ltId,
        name:        ltToMuni[ltId]?.name || ltId,
        slug:        ltToMuni[ltId]?.slug || null,
        leftRating:  leftMap[ltId]  ?? null,
        rightRating: rightMap[ltId] ?? null,
      }))
      .filter(m => m.leftRating !== null || m.rightRating !== null)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.measureSlug + '|' + orderedVersions.value.map(v => v.id).join(','),
  fetchAll,
  { immediate: true },
)

// ── Change helpers ─────────────────────────────────────────────────────────────
function changeType(m) {
  if (m.leftRating === null || m.rightRating === null) return 'single'
  if (m.leftRating === 'na' && m.rightRating === 'na') return 'same'
  if (m.leftRating === 'na' || m.rightRating === 'na') return 'na-change'
  const li = ratingIdxMap[m.leftRating] ?? 99
  const ri = ratingIdxMap[m.rightRating] ?? 99
  if (ri < li) return 'improved'
  if (ri > li) return 'degraded'
  return 'same'
}
function changeColorOf(m) {
  switch (changeType(m)) {
    case 'improved':   return '#4caf50'
    case 'degraded':   return '#f44336'
    case 'na-change':  return '#bdbdbd'
    default:           return '#9e9e9e'
  }
}
function changeArrow(m) {
  const t = changeType(m)
  if (t === 'improved')  return '↑'
  if (t === 'degraded')  return '↓'
  return '→'
}

// ── Stats ─────────────────────────────────────────────────────────────────────
const hasData        = computed(() => munis.value.length > 0)
const improvedCount  = computed(() => munis.value.filter(m => changeType(m) === 'improved').length)
const sameCount      = computed(() => munis.value.filter(m => changeType(m) === 'same').length)
const degradedCount  = computed(() => munis.value.filter(m => changeType(m) === 'degraded').length)
const onlySingleCount = computed(() => munis.value.filter(m => changeType(m) === 'single').length)

// ── Layout computation ────────────────────────────────────────────────────────
const svgLayout = computed(() => {
  if (!hasData.value) return { leftNodes: [], rightNodes: [], ribbons: [] }

  const totalLeft  = munis.value.filter(m => m.leftRating  !== null).length
  const totalRight = munis.value.filter(m => m.rightRating !== null).length
  const MU_H = Math.max(3, Math.min(8, 380 / Math.max(totalLeft, totalRight, 1)))

  // Group municipalities into left/right buckets
  const leftBuckets  = {}
  const rightBuckets = {}
  for (const m of munis.value) {
    if (m.leftRating  !== null) { (leftBuckets[m.leftRating]   ||= []).push(m) }
    if (m.rightRating !== null) { (rightBuckets[m.rightRating] ||= []).push(m) }
  }

  // Sort within buckets to minimize ribbon crossings
  // Left: sort by destination (right) rating index, then name
  for (const k of RATING_KEYS) {
    leftBuckets[k]?.sort((a, b) => {
      const d = (ratingIdxMap[a.rightRating] ?? 99) - (ratingIdxMap[b.rightRating] ?? 99)
      return d !== 0 ? d : a.name.localeCompare(b.name, 'de')
    })
    // Right: sort by source (left) rating index, then name
    rightBuckets[k]?.sort((a, b) => {
      const d = (ratingIdxMap[a.leftRating] ?? 99) - (ratingIdxMap[b.leftRating] ?? 99)
      return d !== 0 ? d : a.name.localeCompare(b.name, 'de')
    })
  }

  // Compute left bucket y positions + per-municipality y on left side
  let ly = PAD_TOP
  const leftNodes = []
  const leftMuniY = {}
  for (const k of RATING_KEYS) {
    const bucket = leftBuckets[k] || []
    if (!bucket.length) continue
    const h = bucket.length * MU_H
    leftNodes.push({ key: k, y1: ly, h, color: RATING_CFG[k].color, shortLabel: RATING_CFG[k].shortLabel, count: bucket.length })
    bucket.forEach((m, i) => { leftMuniY[m.key] = ly + i * MU_H })
    ly += h + BUCKET_GAP
  }

  // Compute right bucket y positions + per-municipality y on right side
  let ry = PAD_TOP
  const rightNodes = []
  const rightMuniY = {}
  for (const k of RATING_KEYS) {
    const bucket = rightBuckets[k] || []
    if (!bucket.length) continue
    const h = bucket.length * MU_H
    rightNodes.push({ key: k, y1: ry, h, color: RATING_CFG[k].color, shortLabel: RATING_CFG[k].shortLabel, count: bucket.length })
    bucket.forEach((m, i) => { rightMuniY[m.key] = ry + i * MU_H })
    ry += h + BUCKET_GAP
  }

  // Build ribbon paths (only when two versions, and municipality has both ratings)
  const ribbons = []
  if (twoVersions.value) {
    const lx = LEFT_X + NODE_W
    const rx = RIGHT_X
    for (const m of munis.value) {
      if (m.leftRating === null || m.rightRating === null) continue
      const lY1 = leftMuniY[m.key]
      const rY1 = rightMuniY[m.key]
      if (lY1 === undefined || rY1 === undefined) continue
      const lY2 = lY1 + MU_H
      const rY2 = rY1 + MU_H
      const path = [
        `M ${lx} ${lY1}`,
        `C ${MID_X} ${lY1} ${MID_X} ${rY1} ${rx} ${rY1}`,
        `L ${rx} ${rY2}`,
        `C ${MID_X} ${rY2} ${MID_X} ${lY2} ${lx} ${lY2}`,
        'Z',
      ].join(' ')
      ribbons.push({ ...m, path, changeColor: changeColorOf(m) })
    }
  }

  return { leftNodes, rightNodes, ribbons }
})

const leftNodes  = computed(() => svgLayout.value.leftNodes)
const rightNodes = computed(() => svgLayout.value.rightNodes)
const ribbons    = computed(() => svgLayout.value.ribbons)

const svgH = computed(() => {
  const all = [...leftNodes.value, ...rightNodes.value].map(n => n.y1 + n.h)
  return all.length ? Math.max(...all) + 20 : 100
})

// ── Interaction ───────────────────────────────────────────────────────────────
const hoveredMuniData = computed(() => {
  if (!hoveredKey.value) return null
  const m = munis.value.find(m => m.key === hoveredKey.value)
  return m ? { ...m, changeColor: changeColorOf(m) } : null
})

function navigateToMuni(ribbon) {
  if (ribbon.slug) router.push(`/municipalities/${ribbon.slug}`)
}
</script>

<style scoped>
.fade-info-enter-active,
.fade-info-leave-active { transition: opacity 0.12s ease; }
.fade-info-enter-from,
.fade-info-leave-to { opacity: 0; }
</style>
