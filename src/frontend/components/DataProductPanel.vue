<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center gap-2 py-12">
      <SlkFlowerSpinner :size="28" />
      <span class="text-gray-500 text-sm">Daten werden geladen…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-gray-400 px-4 py-8 text-center text-sm">
      Für diese Kommune sind noch keine Daten vorhanden.
    </div>

    <template v-else>
      <!-- Row 1: KPI + Histogram -->
      <div v-if="kpiElement || histogramElements.length" class="mb-6 grid grid-cols-2 gap-4">
        <!-- KPI card -->
        <div v-if="kpiElement" class="bg-gray-50 flex flex-col justify-center rounded-xl p-4">
          <div class="text-4xl font-black tabular-nums leading-none" :style="{ color: kpiColor }">
            {{ kpiDisplayValue }}
          </div>
          <div v-if="kpiUnit" class="text-gray-500 mt-1 text-xs">
            {{ kpiUnit }}
            <template v-if="kpiElement.population_normalized"> / 1 000 Einw.</template>
          </div>
          <div v-if="kpiLabel" class="text-gray-400 mt-1 text-xs leading-snug">
            {{ kpiLabel }}
          </div>
        </div>

        <!-- Histograms (all of them) -->
        <template v-if="histogramElements.length">
          <div
            v-for="hist in histogramElements"
            :key="hist.field ?? hist.label ?? hist.vegalite_spec"
            class="min-h-[180px]"
          >
            <h4 class="text-gray-500 mb-2 text-xs font-semibold uppercase tracking-wide">Verteilung (alle Kommunen)</h4>
            <ClientOnly>
              <VegaChart
                :spec="hist.vegalite_spec"
                :height="180"
                :export-area-name="municipalityName"
                :export-ars="ars"
                :export-title="localizedStr(hist.title) || 'Verteilung'"
                :export-subtitle="localizedStr(hist.description) || collectionDescription"
                :export-collection-name="collectionTitle"
                :export-updated-at="exportUpdatedAt"
                :export-attribution="exportAttribution"
              />
            </ClientOnly>
          </div>
        </template>
      </div>

      <!-- Row 2: Maps -->
      <div v-if="primaryMapLibreElement || combinedMapSpec" class="mb-6 w-full" style="height: 420px">
        <ClientOnly>
          <MapLibreRenderElement v-if="primaryMapLibreElement" :element="primaryMapLibreElement" :ars="ars" />
          <VegaChart
            v-else-if="combinedMapSpec"
            :spec="combinedMapSpec"
            :export-area-name="municipalityName"
            :export-ars="ars"
            :export-title="localizedStr(vegaMapElements[0]?.title) || collectionTitle"
            :export-subtitle="localizedStr(vegaMapElements[0]?.description) || collectionDescription"
            :export-collection-name="collectionTitle"
            :export-updated-at="exportUpdatedAt"
            :export-attribution="exportAttribution"
          />
        </ClientOnly>
      </div>

      <!-- Row 3: Time series -->
      <template v-if="timeSeriesElements.length">
        <div v-for="ts in timeSeriesElements" :key="ts.field" class="mb-4 w-full" style="height: 250px">
          <ClientOnly>
            <VegaChart
              :spec="ts.vegalite_spec"
              :export-area-name="municipalityName"
              :export-ars="ars"
              :export-title="localizedStr(ts.title) || collectionTitle"
              :export-subtitle="localizedStr(ts.description) || collectionDescription"
              :export-collection-name="collectionTitle"
              :export-updated-at="exportUpdatedAt"
              :export-attribution="exportAttribution"
            />
          </ClientOnly>
        </div>
      </template>

      <!-- Pipeline -->
      <div v-if="pipeline?.pipeline_steps?.length" class="mt-6">
        <details class="border-gray-200 group rounded border">
          <summary
            class="bg-gray-50 hover:bg-gray-100 flex cursor-pointer select-none items-center justify-between rounded px-4 py-3 transition-colors"
          >
            <span class="text-gray-700 text-sm font-semibold">Datenpipeline</span>
            <svg
              class="text-gray-400 h-4 w-4 transition-transform group-open:rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div class="space-y-3 px-4 pb-4 pt-2">
            <div
              v-for="(step, idx) in pipeline.pipeline_steps"
              :key="step.asset_key || idx"
              class="flex items-start gap-3"
            >
              <div
                class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#006e94]/10 text-xs font-bold text-[#006e94]"
              >
                {{ idx + 1 }}
              </div>
              <div class="min-w-0">
                <p class="text-gray-800 break-all font-mono text-sm">{{ step.asset_key }}</p>
                <p v-if="step.last_materialized" class="text-gray-400 mt-0.5 text-xs">
                  Zuletzt aktualisiert: {{ formatDate(step.last_materialized) }}
                </p>
                <p v-if="step.description" class="text-gray-500 mt-0.5 text-xs">
                  {{ step.description }}
                </p>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- Description -->
      <div v-if="collectionDescription" class="text-gray-600 mt-4 text-sm leading-relaxed">
        {{ collectionDescription }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { hasMapVisual, mapLibreSpec } from "~/utils/dataProducts";

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
    default: "",
  },
  baseUrl: {
    type: String,
    required: true,
  },
  population: {
    type: Number,
    default: null,
  },
  exportUpdatedAt: {
    type: String,
    default: "",
  },
  exportAttribution: {
    type: String,
    default: "",
  },
  // Legacy props kept for compatibility with existing call sites
  areaBoundary: { type: Object, default: null },
  nearbyAreas: { type: Array, default: () => [] },
  hideMap: { type: Boolean, default: false },
});

// State
const loading = ref(false);
const error = ref(false);
const summary = ref(null);
const pipeline = ref(null);

// Render element grouping
const renderElements = computed(() => props.collection?.render_elements ?? []);

const kpiElement = computed(() => renderElements.value.find((e) => e.type === "kpi") ?? null);

function localizedStr(obj) {
  if (!obj) return "";
  return obj["de-DE"] || obj["en-US"] || "";
}

const kpiUnit = computed(() => localizedStr(kpiElement.value?.unit));
const kpiLabel = computed(() => localizedStr(kpiElement.value?.label));
const collectionTitle = computed(() => localizedStr(props.collection?.title) || props.collection?.id || "");
const collectionDescription = computed(() => localizedStr(props.collection?.description));

const histogramElements = computed(() => renderElements.value.filter((e) => e.type === "histogram" && e.vegalite_spec));

const mapElements = computed(() => renderElements.value.filter((e) => e.type === "map" && hasMapVisual(e)));
const primaryMapLibreElement = computed(() => mapElements.value.find((e) => mapLibreSpec(e)) ?? null);
const vegaMapElements = computed(() => mapElements.value.filter((e) => !mapLibreSpec(e) && e.vegalite_spec));

const timeSeriesElements = computed(() =>
  renderElements.value.filter((e) => e.type === "time_series" && e.vegalite_spec),
);

// Map spec composition
function injectAreaParam(url, ars) {
  try {
    const u = new URL(url);
    u.searchParams.set("area", ars);
    u.searchParams.set("limit", "2000");
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}area=${encodeURIComponent(ars)}&limit=2000`;
  }
}

function cloneWithArea(spec, ars) {
  const s = JSON.parse(JSON.stringify(spec));
  if (s.data?.url) s.data.url = injectAreaParam(s.data.url, ars);
  return s;
}

const combinedMapSpec = computed(() => {
  const els = vegaMapElements.value;
  if (!els.length || !props.ars) return null;

  // Suppress maps that would show a single uniform-color municipality boundary.
  // This happens when the collection aggregates to one value per area (e.g. transit
  // score, debt). The summary's aggregate.count field tells us how many items exist
  // for this area; ≤ 1 means the feature IS the boundary itself — not useful as a map.
  const aggCount = summary.value?.aggregate?.count ?? null;
  if (aggCount !== null && aggCount <= 1) return null;

  if (els.length === 1) {
    return cloneWithArea(els[0].vegalite_spec, props.ars);
  }

  const layers = els.map((el) => {
    const s = cloneWithArea(el.vegalite_spec, props.ars);
    return {
      data: s.data,
      mark: s.mark,
      ...(s.transform ? { transform: s.transform } : {}),
      ...(s.encoding ? { encoding: s.encoding } : {}),
    };
  });

  const base = els[0].vegalite_spec;
  return {
    $schema: base.$schema ?? "https://vega.github.io/schema/vega-lite/v5.json",
    width: "container",
    height: "container",
    projection: base.projection ?? { type: "mercator" },
    layer: layers,
  };
});

// KPI
const kpiRawValue = computed(() => {
  if (!kpiElement.value || !summary.value?.aggregate) return null;
  const field = kpiElement.value.field;
  const agg = summary.value.aggregate;
  return typeof agg[field] === "number" ? agg[field] : null;
});

const kpiValue = computed(() => {
  const raw = kpiRawValue.value;
  if (raw === null) return null;
  if (kpiElement.value.population_normalized && props.population) {
    return (raw / props.population) * 1000;
  }
  return raw;
});

const kpiDisplayValue = computed(() => {
  const v = kpiValue.value;
  if (v === null || v === undefined) return "\u2014";
  if (kpiElement.value?.is_percentage) {
    const t = kpiElement.value.thresholds ?? {};
    const vals = Object.values(t).filter((x) => typeof x === "number" && x > 0);
    const isRatioScale = vals.length > 0 && Math.max(...vals) <= 1;
    const pct = isRatioScale ? v * 100 : v;
    return `${pct.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
  }
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M`;
  if (v >= 10_000) return v.toLocaleString("de-DE");
  if (!Number.isInteger(v)) return v.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  return v.toLocaleString("de-DE");
});

const kpiColor = computed(() => {
  const v = kpiValue.value;
  const t = kpiElement.value?.thresholds ?? {};
  if (v === null || !Object.keys(t).length) return "#006e94";
  if (t.darkgreen != null && v >= t.darkgreen) return "#1EA64A";
  if (t.lightgreen != null && v >= t.lightgreen) return "#8DC63F";
  if (t.yellow != null && v >= t.yellow) return "#F7A600";
  if (t.orange != null && v >= t.orange) return "#F36633";
  return "#E30613";
});

// Fetch
async function loadData() {
  if (!props.collection?.id || !props.ars) return;
  loading.value = true;
  error.value = false;
  summary.value = null;
  pipeline.value = null;

  try {
    const collectionId = props.collection.id;
    const base = `${props.baseUrl}/api/collections/${collectionId}`;

    const [summaryResult, pipelineResult] = await Promise.allSettled([
      $fetch(`${base}/summary/`, { params: { area: props.ars } }),
      $fetch(`${base}/pipeline/`),
    ]);

    if (summaryResult.status === "fulfilled") {
      summary.value = summaryResult.value;
    }
    if (pipelineResult.status === "fulfilled") {
      pipeline.value = pipelineResult.value;
    }

    if (renderElements.value.length > 0 && !summary.value) {
      error.value = true;
    }
  } catch (_) {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.collection?.id,
  () => loadData(),
  { immediate: true },
);
watch(
  () => props.ars,
  () => loadData(),
);

// Formatting
function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (_) {
    return iso;
  }
}
</script>
