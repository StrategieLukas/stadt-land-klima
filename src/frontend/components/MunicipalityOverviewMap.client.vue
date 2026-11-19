<template>
  <div
    class="municipality-overview-map relative overflow-hidden rounded-lg border border-(--slk-border) bg-(--slk-surface-subdued)"
    :class="compact ? 'h-80 sm:h-96' : 'data-overview-map-size'"
  >
    <div ref="container" class="h-full w-full" :aria-label="$t('data.dashboard.map')" role="region" />
    <div
      v-if="loading && !failed"
      class="absolute inset-0 animate-pulse bg-gray-200 motion-reduce:animate-none"
      role="status"
      :aria-label="$t('generic.loading')"
      aria-busy="true"
    />
    <p
      v-if="failed"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-(--slk-surface) p-6 text-center"
      role="status"
    >
      <span>{{ $t("data.dashboard.map_unavailable") }}</span>
      <small class="text-xs">{{ t(context.attribution) }}</small>
    </p>
    <div v-if="!failed && !loading" class="absolute top-3 left-3 flex flex-col gap-1">
      <button
        type="button"
        class="btn btn-square btn-sm"
        :aria-label="$t('data.dashboard.zoom_in')"
        @click="map?.zoomIn()"
      >
        <Icon icon="mdi:plus" class="h-5 w-5" />
      </button>
      <button
        type="button"
        class="btn btn-square btn-sm"
        :aria-label="$t('data.dashboard.zoom_out')"
        @click="map?.zoomOut()"
      >
        <Icon icon="mdi:minus" class="h-5 w-5" />
      </button>
      <button type="button" class="btn btn-square btn-sm" :aria-label="$t('data.dashboard.reset_map')" @click="fit()">
        <Icon icon="mdi:fit-to-page-outline" class="h-5 w-5" />
      </button>
    </div>
    <div
      v-if="hovered && !preview"
      class="pointer-events-none absolute top-3 right-3 max-w-[70%] rounded-md bg-(--slk-surface) p-3 text-sm shadow-md"
      role="tooltip"
    >
      <strong>{{ hovered.name }}</strong>
      <p v-if="!boundariesOnly">
        {{ formatOverviewValue(hovered.value, metric, $locale) ?? $t("generic.no_data") }}
        <span v-if="hovered.value !== null && metric.percentage_representation === 'none'">{{ t(metric.unit) }}</span>
      </p>
    </div>
    <div
      v-if="preview"
      class="absolute inset-x-3 bottom-8 rounded-lg border border-(--slk-border) bg-(--slk-surface) p-4 text-sm shadow-lg"
    >
      <button
        type="button"
        class="btn float-right btn-circle btn-ghost btn-xs"
        :aria-label="$t('generic.close')"
        @click="preview = null"
      >
        <Icon icon="mdi:close" class="h-4 w-4" />
      </button>
      <p class="font-bold">{{ preview.name }}</p>
      <p v-if="!boundariesOnly" class="mt-1">
        {{ formatOverviewValue(preview.value, metric, $locale) ?? $t("generic.no_data") }}
        <span v-if="preview.value !== null && metric.percentage_representation === 'none'">{{ t(metric.unit) }}</span>
      </p>
      <p v-if="!boundariesOnly && preview.data_status === 'excluded'" class="mt-1 text-xs">
        {{ $t("data.dashboard.excluded_count") }}
      </p>
      <NuxtLink
        class="mt-2 inline-block font-semibold underline"
        :to="municipalityProductRoute(context.collection, preview)"
        >{{ $t("data.dashboard.product_detail") }}</NuxtLink
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import type { Map as LibreMap, ExpressionSpecification } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  OverviewMunicipalitySchema,
  type MunicipalityOverview,
  type OverviewMetric,
  type OverviewColorMode,
  type OverviewMunicipality,
} from "~/shared/contracts/municipalityOverview";
import { asRecord } from "~/shared/visualization";
import { checkedMapStyle } from "~/shared/visualizationSafety";
import { checkedOverviewUrl, municipalityProductRoute, formatOverviewValue } from "~/utils/municipalityOverview";
const props = defineProps<{
  context: MunicipalityOverview;
  metric: OverviewMetric;
  colorMode: OverviewColorMode;
  selectedBin: number | null;
  arsPrefix?: string;
  bounds?: MunicipalityOverview["map"]["bounds"];
  boundariesOnly?: boolean;
  compact?: boolean;
}>();
const emit = defineEmits<{ stale: [] }>();
const { $t, $locale } = useNuxtApp();
const { t } = useSlzLocale();
const { isDark } = useTheme();
const outlineColor = computed(() => (isDark.value ? "#344454" : "#505050"));
const container = ref<HTMLElement | null>(null);
const failed = ref(false);
const loading = ref(true);
const preview = ref<OverviewMunicipality | null>(null);
const hovered = ref<OverviewMunicipality | null>(null);
let map: LibreMap | null = null;
let generation = 0;
let observer: ResizeObserver | undefined;
let resizeFrame: number | undefined;
let staleEmitted = false;
function colors(): ExpressionSpecification {
  if (props.boundariesOnly) return ["literal", "#AFCA0B"];
  const missing = props.context.map.no_data_color;
  if (props.colorMode === "score") {
    const classes = props.metric.score_scale?.classes ?? [];
    return [
      "case",
      ["==", ["get", "data_status"], "available"],
      ["match", ["get", "score_class"], ...classes.flatMap((item) => [item.id, item.color]), missing],
      missing,
    ] as unknown as ExpressionSpecification;
  }
  const stops = props.metric.continuous_scale?.stops ?? [];
  return [
    "case",
    ["all", ["==", ["get", "data_status"], "available"], ["==", ["typeof", ["get", "value"]], "number"]],
    ["interpolate", ["linear"], ["number", ["get", "value"], 0], ...stops.flatMap((stop) => [stop.value, stop.color])],
    missing,
  ] as ExpressionSpecification;
}
function updatePaint() {
  if (!map?.getLayer("municipality-fill")) return;
  map.setPaintProperty("municipality-fill", "fill-color", colors());
  map.setPaintProperty(
    "municipality-fill",
    "fill-opacity",
    props.boundariesOnly
      ? 0.3
      : props.selectedBin === null
        ? 0.9
        : ["case", ["==", ["get", "bin_index"], props.selectedBin], 1, 0.18],
  );
  map.setPaintProperty(
    "municipality-outline",
    "line-width",
    props.selectedBin === null ? 0.4 : ["case", ["==", ["get", "bin_index"], props.selectedBin], 1.5, 0.2],
  );
  map.setPaintProperty("background", "background-color", isDark.value ? "#17212b" : "#f2f8fa");
  map.setPaintProperty("municipality-outline", "line-color", outlineColor.value);
}
function fit(duration = 300) {
  const [west, south, east, north] = props.bounds ?? props.context.map.bounds;
  map?.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    { padding: 16, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration },
  );
}
async function initialize() {
  const current = ++generation;
  map?.remove();
  map = null;
  failed.value = false;
  loading.value = true;
  preview.value = null;
  hovered.value = null;
  staleEmitted = false;
  try {
    const lib = await import("maplibre-gl");
    if (current !== generation || !container.value) return;
    lib.setWorkerUrl(mapLibreWorkerUrl);
    const tiles = checkedOverviewUrl(
      props.context.map.tile_url,
      props.context.collection,
      "tiles",
      props.context.snapshot_id,
    );
    if (props.arsPrefix && !/^\d{2,5}$/.test(props.arsPrefix)) throw new Error("Invalid region filter");
    const filter: ExpressionSpecification = props.arsPrefix
      ? ["==", ["slice", ["get", "ars"], 0, props.arsPrefix.length], props.arsPrefix]
      : ["literal", true];
    const style = checkedMapStyle({
      version: 8,
      sources: {
        municipalities: {
          type: "vector",
          tiles: [tiles],
          minzoom: props.context.map.minzoom,
          maxzoom: props.context.map.maxzoom,
          promoteId: "ars",
        },
      },
      layers: [
        { id: "background", type: "background", paint: { "background-color": isDark.value ? "#17212b" : "#f2f8fa" } },
        {
          id: "municipality-fill",
          type: "fill",
          source: "municipalities",
          "source-layer": "municipalities",
          filter,
          paint: { "fill-color": colors(), "fill-opacity": 0.9 },
        },
        {
          id: "municipality-outline",
          type: "line",
          source: "municipalities",
          "source-layer": "municipalities",
          filter,
          paint: { "line-color": outlineColor.value, "line-width": 0.4 },
        },
      ],
    });
    const bounds = props.bounds ?? props.context.map.bounds;
    const instance = new lib.Map({
      container: container.value,
      style,
      bounds: [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      fitBoundsOptions: { padding: 16 },
      cooperativeGestures: true,
      locale: {
        "Map.Title": $t("data.dashboard.map"),
        "AttributionControl.ToggleAttribution": $t("data.dashboard.map_attribution"),
        "CooperativeGesturesHandler.WindowsHelpText": $t("data.dashboard.map_gesture_windows"),
        "CooperativeGesturesHandler.MacHelpText": $t("data.dashboard.map_gesture_mac"),
        "CooperativeGesturesHandler.MobileHelpText": $t("data.dashboard.map_gesture_mobile"),
      },
      maxZoom: 16,
      attributionControl: false,
    });
    map = instance;
    const attribution = t(props.context.attribution)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
    instance.addControl(new lib.AttributionControl({ compact: true, customAttribution: attribution }));
    instance.on("load", () => {
      if (current !== generation) return;
      updatePaint();
      loading.value = false;
    });
    instance.on("click", "municipality-fill", (event) => {
      const properties = asRecord(event.features?.[0]?.properties);
      const parsed = OverviewMunicipalitySchema.safeParse({
        ...properties,
        district_name: properties?.district_name ?? null,
        value: properties?.value ?? null,
      });
      if (!parsed.success) return;
      if (window.matchMedia("(hover: none), (pointer: coarse)").matches) preview.value = parsed.data;
      else void navigateTo(municipalityProductRoute(props.context.collection, parsed.data));
    });
    instance.on("mousemove", "municipality-fill", (event) => {
      const properties = asRecord(event.features?.[0]?.properties);
      const parsed = OverviewMunicipalitySchema.safeParse({
        ...properties,
        district_name: properties?.district_name ?? null,
        value: properties?.value ?? null,
      });
      if (parsed.success && hovered.value?.ars !== parsed.data.ars) hovered.value = parsed.data;
    });
    instance.on("mouseenter", "municipality-fill", () => {
      if (map) map.getCanvas().style.cursor = "pointer";
    });
    instance.on("mouseleave", "municipality-fill", () => {
      hovered.value = null;
      if (map) map.getCanvas().style.cursor = "";
    });
    instance.on("error", (event) => {
      if ((event.error as Error & { status?: number }).status === 409 && !staleEmitted) {
        staleEmitted = true;
        emit("stale");
      } else failed.value = true;
    });
  } catch {
    if (current === generation) failed.value = true;
  }
}
watch(
  () => props.context.snapshot_id,
  () => void initialize(),
);
watch(() => [props.colorMode, props.selectedBin, props.boundariesOnly, isDark.value], updatePaint);
onMounted(() => {
  void initialize();
  observer = new ResizeObserver(() => {
    if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = undefined;
      map?.resize();
      fit(0);
    });
  });
  if (container.value) observer.observe(container.value);
});
onBeforeUnmount(() => {
  ++generation;
  observer?.disconnect();
  if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
  map?.remove();
  map = null;
});
</script>

<style scoped>
:deep(.maplibregl-ctrl.maplibregl-ctrl-attrib) {
  background-color: var(--slk-surface);
  color: var(--slk-text);
  box-shadow: 0 0 0 1px var(--slk-border);
}

:deep(.maplibregl-ctrl-attrib a) {
  color: var(--slk-text);
}

:deep(.maplibregl-ctrl-attrib .maplibregl-ctrl-attrib-button) {
  background-color: transparent;
}

:global(html[data-theme="staedteChallengeDark"] .municipality-overview-map .maplibregl-ctrl-attrib-button) {
  filter: invert(1);
}

:deep(.maplibregl-ctrl-attrib-button:focus-visible) {
  outline: 2px solid var(--slk-text-strong);
  outline-offset: 2px;
  box-shadow: none;
}
</style>
