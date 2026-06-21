<template>
  <div class="bg-gray-50 relative h-full w-full overflow-hidden">
    <div ref="containerRef" class="h-full w-full" />
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/60">
      <SlkFlowerSpinner :size="24" />
    </div>
    <div v-if="error" class="text-gray-400 absolute inset-0 flex items-center justify-center text-sm">
      Karte konnte nicht geladen werden.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { MapLibreRenderSpec, RenderElement } from "~/types/slz-api";

const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };

const props = defineProps<{
  element: RenderElement;
  ars?: string | null;
}>();

const containerRef = ref<HTMLElement | null>(null);
const loading = ref(true);
const error = ref(false);

let map: any = null;
let popup: any = null;
let maplibregl: any = null;
let densityAbortController: AbortController | null = null;
let featureBoundsAbortController: AbortController | null = null;
let densityTimer: ReturnType<typeof setTimeout> | null = null;
let resizeObserver: ResizeObserver | null = null;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
let didFitInitialBounds = false;
let cleanupLayerListeners: Array<() => void> = [];

const spec = computed<MapLibreRenderSpec | null>(() => {
  const candidate = props.element.maplibre_spec ?? props.element.maplibreSpec ?? null;
  if (!candidate || candidate.renderer !== "maplibre" || candidate.version !== 1) return null;
  return withAreaInSourceUrls(candidate, props.ars);
});

watch(
  spec,
  () => {
    if (process.client) renderMap();
  },
  { deep: true },
);

onMounted(() => {
  renderMap();
});

onBeforeUnmount(() => {
  destroyMap();
});

async function renderMap() {
  if (!containerRef.value || !spec.value) return;
  loading.value = true;
  error.value = false;
  destroyMap();

  try {
    const module = await import("maplibre-gl");
    maplibregl = module.default ?? module;
    didFitInitialBounds = false;

    map = new maplibregl.Map({
      container: containerRef.value,
      style: buildStyle(spec.value),
      attributionControl: true,
      cooperativeGestures: false,
      center: [10.4, 51.2],
      zoom: 4.8,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "320px" });
    observeContainerSize();

    requestAnimationFrame(() => resizeMapAndRefreshHeatmaps());

    map.once("load", async () => {
      resizeMapAndRefreshHeatmaps();
      attachTooltipHandlers();
      await fitToFeatureData();
      await loadDensitySource();
      map.on("moveend", scheduleDensityLoad);
      resizeMapAndRefreshHeatmaps();
      loading.value = false;
    });

    map.on("error", (event: any) => {
      console.warn("[MapLibreRenderElement] map error:", event?.error ?? event);
    });
  } catch (err) {
    console.warn("[MapLibreRenderElement] render error:", err);
    error.value = true;
    loading.value = false;
  }
}

function destroyMap() {
  if (densityTimer) clearTimeout(densityTimer);
  densityTimer = null;
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  densityAbortController?.abort();
  densityAbortController = null;
  featureBoundsAbortController?.abort();
  featureBoundsAbortController = null;
  cleanupLayerListeners.forEach((cleanup) => cleanup());
  cleanupLayerListeners = [];
  popup?.remove?.();
  popup = null;
  map?.remove?.();
  map = null;
}

function buildStyle(mapSpec: MapLibreRenderSpec) {
  const baseStyle = mapSpec.style && typeof mapSpec.style === "object" ? structuredCloneSafe(mapSpec.style) : null;
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    ...(baseStyle ?? {}),
    sources: {
      ...(baseStyle?.sources ?? {}),
      ...buildSources(mapSpec),
    },
    layers: [...(baseStyle?.layers ?? []), ...buildLayers(mapSpec)],
  };
}

function buildSources(mapSpec: MapLibreRenderSpec) {
  const sourceEntries = Object.entries(mapSpec.sources ?? {});
  const sources: Record<string, any> = {};

  for (const [sourceId, source] of sourceEntries) {
    if (!source || typeof source !== "object") continue;
    const cleanSource = omitSourcePrivateFields(source);

    if (sourceId === "features") {
      sources[sourceId] = {
        type: "geojson",
        ...cleanSource,
        data: source.data ?? EMPTY_FEATURE_COLLECTION,
      };
      continue;
    }
    if (sourceId === "density") {
      sources[sourceId] = {
        type: "geojson",
        ...cleanSource,
        data: EMPTY_FEATURE_COLLECTION,
      };
      continue;
    }

    if (cleanSource.type && cleanSource.type !== "geojson") {
      sources[sourceId] = cleanSource;
      continue;
    }

    sources[sourceId] = {
      type: "geojson",
      ...cleanSource,
      data: source.data ?? EMPTY_FEATURE_COLLECTION,
    };
  }

  if (!sources.features) {
    sources.features = { type: "geojson", data: EMPTY_FEATURE_COLLECTION };
  }

  return sources;
}

function buildLayers(mapSpec: MapLibreRenderSpec) {
  return (mapSpec.layers ?? []).map((layer) => normalizeLayer(structuredCloneSafe(layer))).filter(Boolean);
}

function normalizeLayer(layer: Record<string, any> | null) {
  if (!layer || layer.type !== "heatmap") return layer;

  const paint = { ...(layer.paint ?? {}) };

  if (typeof paint["heatmap-radius"] === "number") {
    paint["heatmap-radius"] = Math.min(Math.max(paint["heatmap-radius"], 4), 40);
  }
  if (typeof paint["heatmap-intensity"] === "number") {
    paint["heatmap-intensity"] = Math.min(Math.max(paint["heatmap-intensity"], 0), 4);
  }
  if (typeof paint["heatmap-opacity"] === "number") {
    paint["heatmap-opacity"] = Math.min(Math.max(paint["heatmap-opacity"], 0), 0.9);
  }

  return {
    ...layer,
    filter: layer.filter ?? ["==", ["geometry-type"], "Point"],
    paint,
  };
}

function omitSourcePrivateFields(source: Record<string, any>) {
  const copy = { ...source };
  delete copy.id;
  delete copy.url_template;
  delete copy.urlTemplate;
  return copy;
}

function attachTooltipHandlers() {
  const fields = tooltipFields.value;
  if (!map || !fields.length) return;

  const layerIds = (spec.value?.layers ?? [])
    .map((layer) => layer.id)
    .filter((id): id is string => typeof id === "string" && !!id);

  for (const layerId of layerIds) {
    if (!map.getLayer(layerId)) continue;

    const mouseMove = (event: any) => {
      const feature = event.features?.[0];
      if (!feature) return;
      map.getCanvas().style.cursor = "pointer";
      popup
        .setLngLat(event.lngLat)
        .setHTML(renderTooltipHtml(feature.properties ?? {}, fields))
        .addTo(map);
    };
    const mouseLeave = () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    };
    const click = (event: any) => {
      const feature = event.features?.[0];
      if (!feature) return;
      new maplibregl.Popup({ maxWidth: "320px" })
        .setLngLat(event.lngLat)
        .setHTML(renderTooltipHtml(feature.properties ?? {}, fields))
        .addTo(map);
    };

    map.on("mousemove", layerId, mouseMove);
    map.on("mouseleave", layerId, mouseLeave);
    map.on("click", layerId, click);
    cleanupLayerListeners.push(() => {
      map?.off?.("mousemove", layerId, mouseMove);
      map?.off?.("mouseleave", layerId, mouseLeave);
      map?.off?.("click", layerId, click);
    });
  }
}

const tooltipFields = computed(() => {
  const rawFields = spec.value?.tooltip_fields ?? spec.value?.tooltipFields ?? [];
  return rawFields
    .map((field) => {
      if (typeof field === "string") return { field, label: field };
      if (field?.field) return { field: field.field, label: localizedLabel(field.label ?? field.title, field.field) };
      return null;
    })
    .filter(Boolean) as Array<{ field: string; label: string }>;
});

function renderTooltipHtml(properties: Record<string, unknown>, fields: Array<{ field: string; label: string }>) {
  return `<div class="space-y-1 text-xs">${fields
    .map(({ field, label }) => {
      const value = properties[field];
      if (value === undefined || value === null || value === "") return "";
      return `<div><span class="font-semibold">${escapeHtml(label)}:</span> ${escapeHtml(formatValue(value))}</div>`;
    })
    .filter(Boolean)
    .join("")}</div>`;
}

async function fitToFeatureData() {
  if (didFitInitialBounds || !map) return;
  const data = await featureDataForBounds();
  const bounds = geoJsonBounds(data);
  if (!bounds) return;
  didFitInitialBounds = true;
  map.fitBounds(bounds, { padding: 28, maxZoom: 14, duration: 0 });
}

async function featureDataForBounds() {
  const data = spec.value?.sources?.features?.data;
  if (typeof data !== "string") return data;

  featureBoundsAbortController?.abort();
  featureBoundsAbortController = new AbortController();

  try {
    const response = await fetch(data, { signal: featureBoundsAbortController.signal });
    return await response.json();
  } catch (err: any) {
    if (err?.name !== "AbortError") console.warn("[MapLibreRenderElement] feature bounds fetch error:", err);
    return null;
  }
}

function scheduleDensityLoad() {
  if (densityTimer) clearTimeout(densityTimer);
  densityTimer = setTimeout(() => {
    loadDensitySource();
  }, 250);
}

async function loadDensitySource() {
  const density = spec.value?.sources?.density;
  const template = density?.url_template ?? density?.urlTemplate;
  if (!map || !template || !map.getSource("density")) return;

  densityAbortController?.abort();
  densityAbortController = new AbortController();

  try {
    const response = await fetch(resolveDensityUrl(template), { signal: densityAbortController.signal });
    const data = await response.json();
    map.getSource("density")?.setData(data ?? EMPTY_FEATURE_COLLECTION);
  } catch (err: any) {
    if (err?.name !== "AbortError") console.warn("[MapLibreRenderElement] density fetch error:", err);
  }
}

function resolveDensityUrl(template: string) {
  const bounds = map.getBounds();
  const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
    .map((value) => value.toFixed(6))
    .join(",");
  return template.replace("{bbox}", bbox).replace("{zoom}", String(Math.round(map.getZoom())));
}

function observeContainerSize() {
  resizeObserver?.disconnect();
  if (!containerRef.value || typeof ResizeObserver === "undefined") return;

  resizeObserver = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (!box?.width || !box?.height) return;
    scheduleMapResize();
  });
  resizeObserver.observe(containerRef.value);
}

function scheduleMapResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => resizeMapAndRefreshHeatmaps(), 80);
}

function resizeMapAndRefreshHeatmaps() {
  if (!map) return;
  map.resize();
  if (!map.isStyleLoaded?.()) return;
  refreshHeatmapLayers();
  map.triggerRepaint?.();
}

function refreshHeatmapLayers() {
  for (const layer of spec.value?.layers ?? []) {
    if (layer.type !== "heatmap" || typeof layer.id !== "string" || !map.getLayer(layer.id)) continue;
    const opacity = map.getPaintProperty(layer.id, "heatmap-opacity");
    map.setPaintProperty(layer.id, "heatmap-opacity", opacity ?? 1);
  }
}

function geoJsonBounds(data: any): [[number, number], [number, number]] | null {
  const coordinates: Array<[number, number]> = [];
  collectCoordinates(data, coordinates);
  if (!coordinates.length) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of coordinates) {
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return [
    [west, south],
    [east, north],
  ];
}

function collectCoordinates(value: any, coordinates: Array<[number, number]>) {
  if (!value) return;
  if (value.type === "FeatureCollection") {
    value.features?.forEach((feature: any) => collectCoordinates(feature, coordinates));
    return;
  }
  if (value.type === "Feature") {
    collectCoordinates(value.geometry, coordinates);
    return;
  }
  if (Array.isArray(value.coordinates)) {
    collectCoordinateArray(value.coordinates, coordinates);
  }
}

function collectCoordinateArray(value: any, coordinates: Array<[number, number]>) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    coordinates.push([value[0], value[1]]);
    return;
  }
  value.forEach((child) => collectCoordinateArray(child, coordinates));
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function withAreaInSourceUrls(mapSpec: MapLibreRenderSpec, ars?: string | null): MapLibreRenderSpec {
  const cloned = structuredCloneSafe(mapSpec);
  if (!ars) return cloned;

  for (const source of Object.values(cloned.sources ?? {})) {
    if (!source || typeof source !== "object") continue;
    if (typeof source.data === "string") source.data = appendAreaParam(source.data, ars);
    if (typeof source.url_template === "string") source.url_template = appendAreaParam(source.url_template, ars);
    if (typeof source.urlTemplate === "string") source.urlTemplate = appendAreaParam(source.urlTemplate, ars);
  }

  return cloned;
}

function appendAreaParam(url: string, ars: string) {
  if (/[?&]area=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}area=${encodeURIComponent(ars)}`;
}

function formatValue(value: unknown) {
  if (typeof value === "number") return value.toLocaleString("de-DE");
  return String(value);
}

function localizedLabel(value: string | Record<string, string> | null | undefined, fallback: string) {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  return value["de-DE"] || value["en-US"] || fallback;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
</script>
