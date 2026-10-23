<template>
  <div :id="'block-' + uuid" class="blokkli-block-vega-chart">
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
          {{ $t("generic.loading") }}
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
        {{ $t("generic.loading") }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { checkedVisualizationSpec, safeVisualizationLoader } from "~/shared/visualizationSafety";
import { z } from 'zod';
import type { EmbedOptions } from 'vega-embed';
import { asRecord, cloneVisualization, displayScalar, attachVisualizationData, type VisualizationData } from '~/shared/visualization';

import { ref, computed, watch, onMounted, nextTick, unref } from 'vue'

import { INJECT_PROVIDER_CONTEXT } from '#blokkli/helpers/injections'
import { defaultVegaQuery as defaultQuery } from '~/shared/vegaQuery'
const querySchema = z.object({collection: z.string().optional(), method: z.string().optional(), args: z.array(z.unknown()).optional(), query: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(), variables: z.record(z.string(), z.unknown()).optional(), url: z.string().optional(), dataPath: z.string().optional()});
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function selectData(input: unknown, path?: string): VisualizationData | null {
  const value = path ? path.split('.').reduce<unknown>((value, key) => Array.isArray(value) ? value[Number(key)] : asRecord(value)?.[key], input) : input;
  return Array.isArray(value) ? value as unknown[] : asRecord(value);
}

const { isDark } = useTheme()

const darkVegaConfig = {
  background: '#17212b',
  view: { fill: '#17212b', stroke: '#344454' },
  axis: {
    labelColor: '#8aa4b8',
    titleColor: '#8aa4b8',
    gridColor: '#243444',
    domainColor: '#344454',
    tickColor: '#344454',
  },
  title: { color: '#d0dce5', subtitleColor: '#8aa4b8' },
  legend: { labelColor: '#8aa4b8', titleColor: '#8aa4b8' },
  header: { labelColor: '#8aa4b8', titleColor: '#8aa4b8' },
}

let renderTimer: ReturnType<typeof setTimeout> | null = null
let rendering = false
let lastRenderKey = ''

const publicContext = inject(INJECT_PROVIDER_CONTEXT)
const isDraftPreview = Boolean(useRoute().query.blokkliPreview)
const isEditing = import.meta.blokkliEditing

const { options, uuid } = defineBlokkli({
  bundle: 'vega_chart',
  propsFieldMapping: {
    spec: { name: 'spec', type: 'editable' },
    query: { name: 'query', type: 'editable' },
  },
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
    editTitle: (_el) => 'Vega-Lite Chart',
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
  spec?: string | undefined
  query?: string | undefined
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


const chartContainer = ref<HTMLElement | null>(null)
const editChartContainer = ref<HTMLElement | null>(null)
const errorMessage = ref('')
const loading = ref(false)
const debugData = ref<VisualizationData | null>(null)

const { $stadtlandzahlAPI, $apollo } = useNuxtApp()
const { getAuthenticatedClient } = useAuth()
const config = useRuntimeConfig()

function parseJsonSafe(text: unknown): unknown {
  if (!text) return null
  if (typeof text !== 'string') return text
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

function flattenRow(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    const val = obj[key]
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenRow(asRecord(val) ?? {}, path))
    } else {
      result[path] = val
    }
  }
  return result
}

const flatData = computed(() => {
  if (!Array.isArray(debugData.value)) return null
  return debugData.value.flatMap((row: unknown) => {const record = asRecord(row); return record ? [flattenRow(record)] : []})
})

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '–'
  if (typeof value === 'object') return JSON.stringify(value)
  return displayScalar(value)
}

async function fetchQueryData(input: unknown, source: string): Promise<VisualizationData | null> {
  if (!input) return null
  const queryConfig = querySchema.parse(input)

  try {
    // ── Directus backend ──
    if (source === 'directus') {
      // Query format: { "collection": "my_collection", "query": { "limit": 100, "filter": {...}, "fields": [...], "sort": [...] }, "dataPath": "optional.nested.key" }
      if (!queryConfig.collection) {
        throw new Error('Directus query requires a "collection" field')
      }
      const result: unknown = isEditing || isDraftPreview
        ? await getAuthenticatedClient().request((await import('@directus/sdk')).readItems<Record<string, Record<string, unknown>[]>, string, import('@directus/sdk').Query<Record<string, Record<string, unknown>[]>, Record<string, unknown>>>(queryConfig.collection, (typeof queryConfig.query === 'object' ? queryConfig.query : {})))
        : await $fetch(`/api/public/chart-data/${encodeURIComponent(uuid)}`, { query: { entityType: publicContext?.value.type, entityUuid: publicContext?.value.uuid } })
      const data = Array.isArray(result) ? result : [result]
      return selectData(data, queryConfig.dataPath)
    }

    // ── Stadt-Land-Zahl backend ──
    // 1. { "method": "fetchHistogramData", "args": [...] }
    if (queryConfig.method) {
      const args = queryConfig.args ?? [];
      const stringAt = (i: number) => z.string().parse(args[i]);
      const numberAt = (i: number) => z.number().parse(args[i]);
      let result: unknown;
      switch (queryConfig.method) {
        case 'fetchHistogramData': result = await $stadtlandzahlAPI.fetchHistogramData(stringAt(0), stringAt(1)); break;
        case 'fetchStatsByARS': result = await $stadtlandzahlAPI.fetchStatsByARS(stringAt(0)); break;
        case 'fetchMunicipalitiesInRegion': result = await $stadtlandzahlAPI.fetchMunicipalitiesInRegion(stringAt(0), numberAt(1)); break;
        case 'getNearbyAdministrativeAreas': result = await $stadtlandzahlAPI.getNearbyAdministrativeAreas(numberAt(0), numberAt(1), numberAt(2), z.array(z.number()).optional().parse(args[3])); break;
        case 'searchAdministrativeAreas': result = await $stadtlandzahlAPI.searchAdministrativeAreas(stringAt(0), z.enum(['normal', 'reasonable', 'all']).default('reasonable').parse(args[1])); break;
        case 'searchThroughAdministrativeAreasByName': result = await $stadtlandzahlAPI.searchThroughAdministrativeAreasByName(stringAt(0), z.object({isReasonableForMunicipalRating: z.boolean().optional()}).default({}).parse(args[1])); break;
        case 'fetchCollectionRender': result = await $stadtlandzahlAPI.fetchCollectionRender(stringAt(0), stringAt(1), z.number().nullable().default(null).parse(args[2])); break;
        case 'fetchRenderElement': result = await $stadtlandzahlAPI.fetchRenderElement(stringAt(0), stringAt(1), stringAt(2)); break;
        default: throw new Error(`Unknown stadtlandzahl method: ${queryConfig.method}`);
      }
      return selectData(result, queryConfig.dataPath);
    }

    // 2. { "query": "query { ... }", "variables": {...}, "dataPath": "..." }
    if (typeof queryConfig.query === 'string') {
      const { default: gql } = await import('graphql-tag')
      const result = await $apollo.query({
        query: gql(queryConfig.query),
        variables: queryConfig.variables || {},
      })
      return selectData(result.data, queryConfig.dataPath)
    }

    // 3. { "url": "/api/areas/...", "dataPath": "..." }
    if (queryConfig.url) {
      const baseUrl = config.public.stadtlandzahlBaseUrl as string
      // Older CMS entries may contain an absolute Stadtlandzahl URL. Discard
      // its origin and send only its path/query through the fixed server proxy.
      const configuredUrl = new URL(queryConfig.url, window.location.origin)
      const proxyPath = `${configuredUrl.pathname}${configuredUrl.search}`
      const url = proxyPath.startsWith(`${baseUrl}/`) ? proxyPath : `${baseUrl}${proxyPath}`

      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: unknown = await response.json()
      return selectData(data, queryConfig.dataPath)
    }

    return null
  } catch (err: unknown) {
    throw new Error(`Query error: ${errorText(err)}`, {cause: err})
  }
}

async function renderChart() {
  if (rendering) return

  // Fingerprint to avoid redundant re-renders (spec may be a parsed object, not a string)
  const specKey = props.spec && typeof props.spec !== 'string' ? JSON.stringify(props.spec) : (props.spec ?? '')
  const key = [specKey, props.query, options.value.width, options.value.dataSource].join('\0')
  if (key === lastRenderKey) return
  lastRenderKey = key

  rendering = true

  try {
    const container = unref(isEditing) ? editChartContainer.value : chartContainer.value
    if (!container) return

    errorMessage.value = ''
    loading.value = false
    debugData.value = null

    const parsedSpec = parseJsonSafe(props.spec || defaultSpec)
    const specObj = parsedSpec ? cloneVisualization(parsedSpec) : null
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
          attachVisualizationData(specObj, data)
        }
      } catch (err: unknown) {
        errorMessage.value = errorText(err)
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
    // Always set background based on current theme
    specObj.background = isDark.value ? '#17212b' : '#fbfbfb'

    const { default: vegaEmbed, vega } = await import('vega-embed')

    const embedOpts: EmbedOptions = {
      ast: true,
      loader: safeVisualizationLoader(vega.loader({http: {credentials: 'omit', redirect: 'error'}}), window.location.origin),
      actions: false,
      renderer: 'svg',
      ...(isDark.value ? { config: darkVegaConfig } : {}),
    }

    await vegaEmbed(container, checkedVisualizationSpec(specObj), embedOpts)
  } catch (err: unknown) {
    errorMessage.value = `Render-Fehler: ${errorText(err)}`
  } finally {
    rendering = false
  }
}

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    renderTimer = null
    void renderChart()
  }, 300)
}

// Watch for prop changes and re-render
watch(
  () => [props.spec, props.query, options.value.width, options.value.dataSource, options.value.showTable, isDark.value],
  scheduleRender,
)

onMounted(() => {
  void nextTick(renderChart)
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
