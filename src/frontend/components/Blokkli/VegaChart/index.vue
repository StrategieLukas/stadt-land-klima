<template>
  <div class="blokkli-block-vega-chart">
    <!-- Edit mode: show editable JSON fields -->
    <div v-if="isEditing" class="space-y-3">
      <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vega-Lite Spec</div>
      <pre
        v-blokkli-editable:spec
        class="font-mono text-xs bg-gray-50 p-3 rounded border border-gray-200 min-h-[8rem] whitespace-pre-wrap overflow-auto max-h-[24rem]"
        v-text="props.spec || defaultSpec"
      />

      <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Daten-Query (JSON)</div>
      <pre
        v-blokkli-editable:query
        class="font-mono text-xs bg-gray-50 p-3 rounded border border-gray-200 min-h-[4rem] whitespace-pre-wrap overflow-auto max-h-[16rem]"
        v-text="props.query || defaultQuery"
      />

      <div v-if="errorMessage" class="text-red-600 text-xs bg-red-50 p-2 rounded border border-red-200">
        {{ errorMessage }}
      </div>

      <!-- Chart preview in edit mode -->
      <div class="mt-3 border border-gray-200 rounded bg-white p-2">
        <div ref="editChartContainer" class="vega-chart-container" />
        <div v-if="loading" class="text-gray-400 text-xs py-4 text-center">
          Daten werden geladen…
        </div>
      </div>

      <!-- Debug data table (editor only) -->
      <div v-if="options.showTable && flatData && flatData.length" class="mt-4 overflow-x-auto border border-gray-200 rounded">
        <div class="text-xs text-gray-500 px-3 py-1 bg-gray-50 border-b border-gray-200">
          {{ flatData.length }} Datensätze
        </div>
        <table class="min-w-full text-xs">
          <thead>
            <tr class="bg-gray-50">
              <th v-for="col in tableColumns" :key="col" class="px-3 py-1.5 text-left font-medium text-gray-600 border-b border-gray-200">
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in flatData.slice(0, 50)" :key="i" class="border-b border-gray-100 hover:bg-gray-50">
              <td v-for="col in tableColumns" :key="col" class="px-3 py-1 text-gray-700 whitespace-nowrap">
                {{ formatCell(row[col]) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="flatData.length > 50" class="text-xs text-gray-400 px-3 py-1 bg-gray-50 border-t border-gray-200">
          … und {{ flatData.length - 50 }} weitere
        </div>
      </div>
    </div>

    <!-- View mode: render Vega-Lite chart -->
    <div v-else>
      <div ref="chartContainer" class="vega-chart-container" />
      <div v-if="errorMessage" class="text-red-600 text-sm mt-2">
        {{ errorMessage }}
      </div>
      <div v-if="loading" class="text-gray-400 text-sm py-8 text-center">
        Daten werden geladen…
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, unref } from 'vue'

let renderTimer: ReturnType<typeof setTimeout> | null = null
let rendering = false
let lastRenderKey = ''

const { options, isEditing } = defineBlokkli({
  bundle: 'vega_chart',
  options: {
    dataSource: {
      type: 'radios',
      label: 'Datenquelle',
      default: 'directus',
      options: {
        stadtlandzahl: 'Stadt-Land-Zahl',
        directus: 'Directus',
      },
    },
    width: {
      type: 'radios',
      label: 'Breite',
      default: 'full',
      options: {
        small: 'Klein',
        medium: 'Mittel',
        full: 'Volle Breite',
      },
    },
    showTable: {
      type: 'checkbox',
      label: 'Daten-Tabelle anzeigen',
      default: false,
    },
  },
  editor: {
    addBehaviour: 'editable:spec',
    editTitle: (el) => 'Vega-Lite Chart',
    mockProps: () => {
      return {
        spec: JSON.stringify(
          {
            $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
            title: 'Verteilung der Maßnahmenbewertungen nach Sektor',
            transform: [
              { calculate: 'toNumber(datum.rating)', as: 'ratingNum' },
              { filter: 'isValid(datum.ratingNum)' },
              { calculate: "datum.ratingNum === 0 ? 'Nicht erfüllt (0)' : datum.ratingNum <= 0.33 ? 'Gering (≤0.33)' : datum.ratingNum <= 0.66 ? 'Mittel (≤0.66)' : datum.ratingNum < 1 ? 'Gut (≤0.99)' : 'Vollständig (1)'", as: 'ratingLabel' },
              { calculate: 'datum.ratingNum === 0 ? 0 : datum.ratingNum <= 0.33 ? 1 : datum.ratingNum <= 0.66 ? 2 : datum.ratingNum < 1 ? 3 : 4', as: 'ratingOrder' },
            ],
            mark: { type: 'bar', cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
            encoding: {
              x: { field: 'measure_id.sector', type: 'nominal', title: 'Sektor', axis: { labelAngle: -30 } },
              y: { aggregate: 'count', type: 'quantitative', title: 'Anteil der Maßnahmen', stack: 'normalize' },
              color: {
                field: 'ratingLabel', type: 'nominal', title: 'Bewertung',
                sort: { field: 'ratingOrder', op: 'mean' },
                scale: {
                  domain: ['Nicht erfüllt (0)', 'Gering (≤0.33)', 'Mittel (≤0.66)', 'Gut (≤0.99)', 'Vollständig (1)'],
                  range: ['#d32f2f', '#f39200', '#fdd835', '#8bc34a', '#1da64a'],
                },
              },
              tooltip: [
                { field: 'measure_id.sector', type: 'nominal', title: 'Sektor' },
                { field: 'ratingLabel', type: 'nominal', title: 'Bewertung' },
                { aggregate: 'count', type: 'quantitative', title: 'Anzahl' },
              ],
            },
          },
          null,
          2,
        ),
        query: JSON.stringify(
          {
            collection: 'ratings_measures',
            query: {
              filter: { measure_id: { catalog_version: { name: { _eq: 'v1.0' } } }, status: { _eq: 'published' }, applicable: { _eq: true } },
              fields: ['id', 'rating', 'measure_id.sector', 'measure_id.name', 'measure_id.measure_id'],
              limit: -1,
            },
          },
          null,
          2,
        ),
      }
    },
  },
})

const props = defineProps<{
  spec?: string
  query?: string
}>()

const defaultSpec = JSON.stringify(
  {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title: 'Verteilung der Maßnahmenbewertungen nach Sektor',
    transform: [
      { calculate: 'toNumber(datum.rating)', as: 'ratingNum' },
      { filter: 'isValid(datum.ratingNum)' },
      { calculate: "datum.ratingNum === 0 ? 'Nicht erfüllt (0)' : datum.ratingNum <= 0.33 ? 'Gering (≤0.33)' : datum.ratingNum <= 0.66 ? 'Mittel (≤0.66)' : datum.ratingNum < 1 ? 'Gut (≤0.99)' : 'Vollständig (1)'", as: 'ratingLabel' },
      { calculate: 'datum.ratingNum === 0 ? 0 : datum.ratingNum <= 0.33 ? 1 : datum.ratingNum <= 0.66 ? 2 : datum.ratingNum < 1 ? 3 : 4', as: 'ratingOrder' },
    ],
    mark: { type: 'bar', cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3 },
    encoding: {
      x: { field: 'measure_id.sector', type: 'nominal', title: 'Sektor', axis: { labelAngle: -30 } },
      y: { aggregate: 'count', type: 'quantitative', title: 'Anteil der Maßnahmen', stack: 'normalize' },
      color: {
        field: 'ratingLabel', type: 'nominal', title: 'Bewertung',
        sort: { field: 'ratingOrder', op: 'mean' },
        scale: {
          domain: ['Nicht erfüllt (0)', 'Gering (≤0.33)', 'Mittel (≤0.66)', 'Gut (≤0.99)', 'Vollständig (1)'],
          range: ['#d32f2f', '#f39200', '#fdd835', '#8bc34a', '#1da64a'],
        },
      },
      tooltip: [
        { field: 'measure_id.sector', type: 'nominal', title: 'Sektor' },
        { field: 'ratingLabel', type: 'nominal', title: 'Bewertung' },
        { aggregate: 'count', type: 'quantitative', title: 'Anzahl' },
      ],
    },
  },
  null,
  2,
)

const defaultQuery = JSON.stringify(
  {
    collection: 'ratings_measures',
    query: {
      filter: { measure_id: { catalog_version: { name: { _eq: 'v1.0' } } }, status: { _eq: 'published' }, applicable: { _eq: true } },
      fields: ['id', 'rating', 'measure_id.sector', 'measure_id.name', 'measure_id.measure_id'],
      limit: -1,
    },
  },
  null,
  2,
)

const chartContainer = ref<HTMLElement | null>(null)
const editChartContainer = ref<HTMLElement | null>(null)
const errorMessage = ref('')
const loading = ref(false)
const debugData = ref<any[] | null>(null)

const { $stadtlandzahlAPI, $apollo, $directus, $readItems } = useNuxtApp()
const config = useRuntimeConfig()

function parseJsonSafe(text: string | undefined): any | null {
  if (!text || !text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const tableColumns = computed(() => {
  if (!flatData.value || !flatData.value.length) return []
  const keys = new Set<string>()
  for (const row of flatData.value.slice(0, 20)) {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach((k) => keys.add(k))
    }
  }
  return Array.from(keys)
})

function flattenRow(obj: any, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {}
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    const val = obj[key]
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenRow(val, path))
    } else {
      result[path] = val
    }
  }
  return result
}

const flatData = computed(() => {
  if (!debugData.value) return null
  return debugData.value.map((row) =>
    row && typeof row === 'object' ? flattenRow(row) : row,
  )
})

function formatCell(value: any): string {
  if (value === null || value === undefined) return '–'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

async function fetchQueryData(queryConfig: any, source: string): Promise<any[] | null> {
  if (!queryConfig) return null

  try {
    // ── Directus backend ──
    if (source === 'directus') {
      // Query format: { "collection": "my_collection", "query": { "limit": 100, "filter": {...}, "fields": [...], "sort": [...] }, "dataPath": "optional.nested.key" }
      if (!queryConfig.collection) {
        throw new Error('Directus query requires a "collection" field')
      }
      const cmd = ($readItems as Function)(queryConfig.collection, queryConfig.query || {})
      const result = await ($directus as any).request(cmd)
      const data = Array.isArray(result) ? result : [result]
      if (queryConfig.dataPath) {
        return queryConfig.dataPath.split('.').reduce((obj: any, key: string) => obj?.[key], data)
      }
      return data
    }

    // ── Stadt-Land-Zahl backend ──
    // 1. { "method": "fetchHistogramData", "args": [...] }
    if (queryConfig.method) {
      const api = $stadtlandzahlAPI as any
      if (typeof api[queryConfig.method] !== 'function') {
        throw new Error(`Unknown stadtlandzahl method: ${queryConfig.method}`)
      }
      const args = Array.isArray(queryConfig.args) ? queryConfig.args : []
      return await api[queryConfig.method](...args)
    }

    // 2. { "query": "query { ... }", "variables": {...}, "dataPath": "..." }
    if (queryConfig.query) {
      const { default: gql } = await import('graphql-tag')
      const result = await ($apollo as any).query({
        query: gql(queryConfig.query),
        variables: queryConfig.variables || {},
      })
      if (queryConfig.dataPath) {
        return queryConfig.dataPath.split('.').reduce((obj: any, key: string) => obj?.[key], result.data)
      }
      return result.data
    }

    // 3. { "url": "/api/areas/...", "dataPath": "..." }
    if (queryConfig.url) {
      const baseUrl = (config.public.stadtlandzahlUrl as string || '')
        .replace('/graphql/', '')
        .replace('/graphql', '')
      const url = queryConfig.url.startsWith('http')
        ? queryConfig.url
        : `${baseUrl}${queryConfig.url}`

      // Validate URL is from expected origin
      const allowedOrigin = new URL(baseUrl).origin
      const requestOrigin = new URL(url).origin
      if (requestOrigin !== allowedOrigin) {
        throw new Error('REST queries are restricted to the stadtlandzahl API')
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      if (queryConfig.dataPath) {
        return queryConfig.dataPath.split('.').reduce((obj: any, key: string) => obj?.[key], data)
      }
      return data
    }

    return null
  } catch (err: any) {
    throw new Error(`Query error: ${err.message}`)
  }
}

async function renderChart() {
  if (rendering) return

  // Fingerprint to avoid redundant re-renders
  const key = [props.spec, props.query, options.value.width, options.value.dataSource].join('\0')
  if (key === lastRenderKey) return
  lastRenderKey = key

  rendering = true

  try {
    const container = unref(isEditing) ? editChartContainer.value : chartContainer.value
    if (!container) return

    errorMessage.value = ''
    loading.value = false
    debugData.value = null

    const specObj = parseJsonSafe(props.spec || defaultSpec)
    if (!specObj) {
      errorMessage.value = 'Ungültige Vega-Lite Spezifikation (kein gültiges JSON).'
      return
    }

    // Fetch data from query if provided
    const queryConfig = parseJsonSafe(props.query || defaultQuery)
    if (queryConfig) {
      loading.value = true
      try {
        const data = await fetchQueryData(queryConfig, options.value.dataSource)
        if (data) {
          debugData.value = data
          if (specObj.data?.name) {
            specObj._fetchedDatasets = { [specObj.data.name]: data }
          } else {
            specObj.data = { values: data }
          }
        }
      } catch (err: any) {
        errorMessage.value = err.message
        loading.value = false
        return
      }
      loading.value = false
    }

    // Apply width from options
    const widthMap: Record<string, number | string> = {
      small: 300,
      medium: 500,
      full: 'container',
    }
    if (!specObj.width) {
      specObj.width = widthMap[options.value.width] || 'container'
    }
    if (!specObj.background) {
      specObj.background = '#fbfbfb'
    }

    const { default: vegaEmbed } = await import('vega-embed')

    const embedOpts: any = {
      actions: false,
      renderer: 'svg',
    }

    if (specObj._fetchedDatasets) {
      embedOpts.datasets = specObj._fetchedDatasets
      delete specObj._fetchedDatasets
    }

    await vegaEmbed(container, specObj, embedOpts)
  } catch (err: any) {
    errorMessage.value = `Render-Fehler: ${err.message}`
  } finally {
    rendering = false
  }
}

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    renderTimer = null
    renderChart()
  }, 300)
}

// Watch for prop changes and re-render
watch(
  () => [props.spec, props.query, options.value.width, options.value.dataSource, options.value.showTable],
  scheduleRender,
)

onMounted(() => {
  nextTick(renderChart)
})
</script>

<style scoped>
.vega-chart-container {
  width: 100%;
}
.vega-chart-container :deep(svg) {
  max-width: 100%;
  height: auto;
}
.vega-chart-container :deep(.vega-embed) {
  width: 100%;
}
</style>
