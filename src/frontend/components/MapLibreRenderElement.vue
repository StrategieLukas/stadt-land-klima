<template>
  <div class="slk-maplibre-render group/maplibre bg-gray-50 relative h-full w-full overflow-hidden dark:bg-slate-900">
    <div ref="containerRef" class="h-full w-full" />
    <div
      v-if="canExport"
      class="border-gray-300 pointer-events-none absolute bottom-2 left-2 z-20 flex items-center gap-1 rounded-full border bg-white/95 p-1 opacity-0 shadow-md transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover/maplibre:pointer-events-auto group-hover/maplibre:opacity-100 dark:border-slate-600 dark:bg-slate-800/95"
    >
      <button
        v-if="resolvedFeatureApiUrl"
        type="button"
        class="btn btn-ghost btn-xs h-7 min-h-0 w-7 px-0"
        title="Kartendaten herunterladen"
        aria-label="Kartendaten herunterladen"
        @click.stop="downloadData"
      >
        <Icon icon="mdi:database-arrow-down-outline" class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs h-7 min-h-0 w-7 px-0"
        title="Karte als PNG herunterladen"
        aria-label="Karte als PNG herunterladen"
        @click.stop="downloadPng"
      >
        <Icon icon="mdi:file-image-outline" class="h-4 w-4" />
      </button>
      <button
        v-if="resolvedFeatureApiUrl"
        type="button"
        class="btn btn-ghost btn-xs h-7 min-h-0 w-7 px-0"
        title="API-Aufruf kopieren"
        aria-label="API-Aufruf kopieren"
        @click.stop="copyApiCall"
      >
        <Icon icon="mdi:content-copy" class="h-4 w-4" />
      </button>
    </div>
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-950/60">
      <SlkFlowerSpinner :size="24" />
    </div>
    <div
      v-if="error"
      class="text-gray-400 absolute inset-0 flex items-center justify-center text-sm dark:text-slate-400"
    >
      Karte konnte nicht geladen werden.
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import slkLogoUrl from "~/assets/images/Stadt-Land-Klima-Logo.svg";
import type { MapLibreRenderSpec, RenderElement } from "~/types/slz-api";

const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection", features: [] };
const DATA_WEB_URL = "www.stadt-land-klima.de/data";
const EXPORT_FONT = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const LIGHT_MAP_BACKGROUND = "#f9fafb";
const DARK_MAP_BACKGROUND = "#17212b";
const CARTO_BASEMAP_SOURCE_ID = "slk-carto-basemap";
const CARTO_BASEMAP_LAYER_ID = "slk-carto-basemap";
const CARTO_BASEMAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const props = defineProps<{
  element: RenderElement;
  ars?: string | null;
  exportAreaName?: string;
  exportArs?: string;
  exportTitle?: string;
  exportSubtitle?: string;
  exportCollectionName?: string;
  exportUpdatedAt?: string;
  exportAttribution?: string;
}>();

const containerRef = ref<HTMLElement | null>(null);
const loading = ref(true);
const error = ref(false);
const mapReady = ref(false);
const { isDark } = useTheme();

let map: any = null;
let popup: any = null;
let maplibregl: any = null;
let densityAbortController: AbortController | null = null;
let featureBoundsAbortController: AbortController | null = null;
let densityTimer: ReturnType<typeof setTimeout> | null = null;
let resizeObserver: ResizeObserver | null = null;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
let themeObserver: MutationObserver | null = null;
let didFitInitialBounds = false;
let cleanupLayerListeners: Array<() => void> = [];

const spec = computed<MapLibreRenderSpec | null>(() => {
  const candidate = props.element.maplibre_spec ?? props.element.maplibreSpec ?? null;
  if (!candidate || candidate.renderer !== "maplibre" || candidate.version !== 1) return null;
  return withAreaInSourceUrls(candidate, props.ars);
});

watch(
  [spec, isDark],
  () => {
    if (process.client) renderMap();
  },
  { deep: true },
);

onMounted(() => {
  observeTheme();
  renderMap();
});

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  themeObserver = null;
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
      preserveDrawingBuffer: true,
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
      mapReady.value = true;
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
  mapReady.value = false;
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

function observeTheme() {
  if (typeof MutationObserver === "undefined") return;

  themeObserver?.disconnect();
  themeObserver = new MutationObserver(() => {
    renderMap();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

async function downloadPng() {
  if (!map) return;
  try {
    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready;
    }
    resizeMapAndRefreshHeatmaps();
    await waitForMapIdle();
    const canvas = await captureMapCanvas();
    const exportCanvas = await drawExportCanvas(canvas);
    const blob = await canvasToBlob(exportCanvas);
    downloadBlob(blob, "image/png", `${baseFilename.value}.png`);
  } catch (err) {
    console.warn("[MapLibreRenderElement] PNG export error:", err);
  }
}

async function downloadData() {
  const url = resolvedFeatureApiUrl.value;
  if (!url) return;
  try {
    const response = await fetch(url);
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/geo+json;charset=utf-8";
    downloadBlob(text, contentType, `${baseFilename.value}-data.geojson`);
  } catch (err) {
    console.warn("[MapLibreRenderElement] data export error:", err);
  }
}

async function copyApiCall() {
  if (!resolvedFeatureApiUrl.value) return;
  try {
    await navigator.clipboard.writeText(resolvedFeatureApiUrl.value);
  } catch {
    copyTextFallback(resolvedFeatureApiUrl.value);
  }
}

function buildStyle(mapSpec: MapLibreRenderSpec) {
  const baseStyle =
    mapSpec.style && typeof mapSpec.style === "object"
      ? (themeStyleUrls(structuredCloneSafe(mapSpec.style)) as Record<string, any>)
      : null;
  const baseLayers = Array.isArray(baseStyle?.layers) ? baseStyle.layers : [];
  const externalBasemapSourceIds = basemapSourceIds(mapSpec.sources ?? {});
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    ...(baseStyle ?? {}),
    sources: {
      [CARTO_BASEMAP_SOURCE_ID]: cartoRasterSource(),
      ...buildSources(mapSpec, externalBasemapSourceIds),
    },
    layers: [
      ensureThemedBackgroundLayer(baseLayers),
      cartoRasterLayer(),
      ...buildLayers(mapSpec, externalBasemapSourceIds),
    ].filter(Boolean),
  };
}

function cartoRasterSource() {
  const tileTemplate = isDarkThemeActive()
    ? "https://{subdomain}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
    : "https://{subdomain}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";
  return {
    type: "raster",
    tiles: ["a", "b", "c", "d"].map((subdomain) => tileTemplate.replace("{subdomain}", subdomain)),
    tileSize: 256,
    attribution: CARTO_BASEMAP_ATTRIBUTION,
  };
}

function cartoRasterLayer() {
  return {
    id: CARTO_BASEMAP_LAYER_ID,
    type: "raster",
    source: CARTO_BASEMAP_SOURCE_ID,
    paint: {
      "raster-opacity": 1,
    },
  };
}

function themeStyleUrls(value: unknown): unknown {
  if (typeof value === "string") {
    return isDarkThemeActive()
      ? value
          .replace(/\/light_all\//g, "/dark_all/")
          .replace(/\/positron\//g, "/dark-matter/")
          .replace(/\/positron-gl-style\//g, "/dark-matter-gl-style/")
      : value
          .replace(/\/dark_all\//g, "/light_all/")
          .replace(/\/dark-matter\//g, "/positron/")
          .replace(/\/dark-matter-gl-style\//g, "/positron-gl-style/");
  }
  if (Array.isArray(value)) return value.map(themeStyleUrls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, themeStyleUrls(item)]));
}

function buildSources(mapSpec: MapLibreRenderSpec, externalBasemapSourceIds: Set<string>) {
  const sourceEntries = Object.entries(mapSpec.sources ?? {});
  const sources: Record<string, any> = {};

  for (const [sourceId, source] of sourceEntries) {
    if (!source || typeof source !== "object") continue;
    if (externalBasemapSourceIds.has(sourceId)) continue;

    const cleanSource = themeStyleUrls(omitSourcePrivateFields(source)) as Record<string, any>;

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

function buildLayers(mapSpec: MapLibreRenderSpec, externalBasemapSourceIds: Set<string>) {
  return (mapSpec.layers ?? [])
    .filter((layer) => !isExternalBasemapLayer(layer, externalBasemapSourceIds))
    .map((layer) => normalizeLayer(themeLayer(layer)))
    .filter(Boolean);
}

function basemapSourceIds(sources: Record<string, any>) {
  const ids = new Set<string>();

  for (const [sourceId, source] of Object.entries(sources)) {
    if (isExternalBasemapSource(sourceId, source)) {
      ids.add(sourceId);
    }
  }

  return ids;
}

function isExternalBasemapLayer(layer: Record<string, any> | null, externalBasemapSourceIds: Set<string>) {
  if (!layer || !layer.source || typeof layer.source !== "string") return false;
  if (layer.id === CARTO_BASEMAP_LAYER_ID || layer.source === CARTO_BASEMAP_SOURCE_ID) return true;
  return externalBasemapSourceIds.has(layer.source);
}

function isExternalBasemapSource(sourceId: string, source: unknown) {
  if (!source || typeof source !== "object") return false;

  const haystack = `${sourceId} ${JSON.stringify(source)}`.toLowerCase();
  return (
    haystack.includes("basemaps.cartocdn.com") ||
    haystack.includes("tile.openstreetmap.org") ||
    haystack.includes("carto.com/basemaps") ||
    haystack.includes("carto-basemap") ||
    haystack.includes("positron") ||
    haystack.includes("dark-matter")
  );
}

function ensureThemedBackgroundLayer(layers: Array<Record<string, any>>) {
  const backgroundLayer = layers.find((layer) => layer?.type === "background");
  const fallback = {
    id: "slk-background",
    type: "background",
    paint: { "background-color": isDarkThemeActive() ? DARK_MAP_BACKGROUND : LIGHT_MAP_BACKGROUND },
  };
  return themeLayer(backgroundLayer ?? fallback);
}

function themeLayer(layer: Record<string, any> | null) {
  if (!layer) return layer;
  const cloned = structuredCloneSafe(layer);
  cloned.paint = themePaint(
    cloned.type === "background" ? themeBackgroundPaint(cloned.paint ?? {}) : (cloned.paint ?? {}),
  );
  return cloned;
}

function themeBackgroundPaint(paint: Record<string, any>) {
  return {
    ...paint,
    "background-color": paint["background-color"] ?? (isDarkThemeActive() ? DARK_MAP_BACKGROUND : LIGHT_MAP_BACKGROUND),
  };
}

function themePaint(paint: Record<string, any>) {
  if (!isDarkThemeActive()) return paint;

  const next = { ...paint };
  const neutralColors: Record<string, string> = {
    "#ffffff": DARK_MAP_BACKGROUND,
    "#fff": DARK_MAP_BACKGROUND,
    white: DARK_MAP_BACKGROUND,
    "#f9fafb": DARK_MAP_BACKGROUND,
    "#f8fafc": DARK_MAP_BACKGROUND,
    "#f3f4f6": "#1f2d3a",
    "#f1f5f9": "#1f2d3a",
    "#e5e7eb": "#344454",
    "#e2e8f0": "#344454",
    "#d1d5db": "#42566a",
    "#cbd5e1": "#42566a",
    "#6b7280": "#8aa4b8",
    "#64748b": "#8aa4b8",
    "#4b5563": "#adc3d4",
    "#334155": "#d0dce5",
    "#1f2937": "#d0dce5",
    "#111827": "#d0dce5",
    black: "#d0dce5",
    "#000000": "#d0dce5",
    "#000": "#d0dce5",
  };

  for (const key of [
    "background-color",
    "fill-color",
    "fill-outline-color",
    "line-color",
    "circle-stroke-color",
    "text-color",
    "text-halo-color",
  ]) {
    if (next[key] !== undefined) {
      next[key] = themePaintValue(next[key], neutralColors);
    }
  }

  return next;
}

function themePaintValue(value: unknown, colorMap: Record<string, string>): unknown {
  if (typeof value === "string") return colorMap[value.toLowerCase()] ?? value;
  if (Array.isArray(value)) return value.map((item) => themePaintValue(item, colorMap));
  return value;
}

function isDarkThemeActive() {
  if (typeof document !== "undefined") {
    return document.documentElement.dataset.theme === "staedteChallengeDark";
  }
  return isDark.value;
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

const canExport = computed(() => mapReady.value && !loading.value && !error.value);
const resolvedFeatureApiUrl = computed(() => {
  const url = spec.value?.sources?.features?.data;
  return typeof url === "string" ? resolveUrl(url) : "";
});
const exportTitle = computed(() => props.exportTitle || localizedLabel(props.element.title, "Karte"));
const exportSubtitle = computed(() => props.exportSubtitle || props.exportCollectionName || "");
const exportHeadline = computed(() =>
  props.exportAreaName ? `${exportTitle.value} in ${props.exportAreaName}` : exportTitle.value,
);
const normalizedExportDate = computed(() => normalizeDate(props.exportUpdatedAt));
const baseFilename = computed(() => {
  return (
    [props.exportAreaName, props.exportCollectionName, exportTitle.value, normalizedExportDate.value]
      .filter(Boolean)
      .map(slugify)
      .filter(Boolean)
      .join("_") || "maplibre-map"
  );
});
const exportAreaLabel = computed(() => {
  const name = props.exportAreaName;
  const ars = props.exportArs;
  if (name && ars) return `${name} (ARS: ${ars})`;
  if (ars) return `ARS: ${ars}`;
  return name;
});
const pngFooterLines = computed(() => {
  const meta: string[] = [];
  if (exportAreaLabel.value) meta.push(`Kommune: ${exportAreaLabel.value}`);
  if (props.exportAttribution) meta.push(`Datenquelle: ${props.exportAttribution}`);
  if (normalizedExportDate.value) meta.push(`Stand: ${normalizedExportDate.value}`);
  return [meta.join("  ·  "), `Quelle: Stadt.Land.Klima! e.V.  ·  ${DATA_WEB_URL}`].filter(Boolean);
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

function waitForMapIdle() {
  if (!map) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      nextAnimationFrames(2).then(resolve);
    };
    const timeout = window.setTimeout(finish, 5000);

    // Calling resize() immediately before an export clears the WebGL drawing
    // buffer. Do not rely on map.loaded() here: it may already be true while
    // the repaint triggered by resize is still pending, resulting in a blank
    // PNG. A repaint followed by idle guarantees a rendered frame is available
    // to copy from the canvas.
    map.once("idle", finish);
    map.triggerRepaint?.();
  });
}

function nextAnimationFrames(count: number) {
  return new Promise<void>((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(remaining - 1));
    };
    step(count);
  });
}

async function captureMapCanvas() {
  const sourceCanvas = map.getCanvas() as HTMLCanvasElement;
  const featureCanvas = await renderFeatureScatterCanvas(sourceCanvas.width, sourceCanvas.height);
  if (featureCanvas) return featureCanvas;

  // Maps without GeoJSON features still use the rendered MapLibre canvas.
  // The data-product maps use the branch above, which deliberately avoids
  // WebGL capture and therefore always exports the actual scatter points.
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create map export canvas");

  // Serializing the WebGL canvas first is more reliable than drawing it
  // directly into a 2D canvas. Direct draws can copy an empty framebuffer in
  // Chromium even though MapLibre is visibly rendered on screen.
  const image = await loadImage(sourceCanvas.toDataURL("image/png"));
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function renderFeatureScatterCanvas(width: number, height: number) {
  const data = await featureDataForExport();
  const bounds = geoJsonBounds(data);
  if (!bounds || !width || !height) return null;

  const coordinates: Array<[number, number]> = [];
  collectCoordinates(data, coordinates);
  if (!coordinates.length) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const padding = Math.max(24, Math.round(Math.min(width, height) * 0.06));
  const [[west, south], [east, north]] = bounds;
  const westMercator = mercatorX(west);
  const eastMercator = mercatorX(east);
  const northMercator = mercatorY(north);
  const southMercator = mercatorY(south);
  const mapWidth = Math.max(eastMercator - westMercator, 0.00005);
  const mapHeight = Math.max(southMercator - northMercator, 0.00005);
  const drawWidth = Math.max(1, width - padding * 2);
  const drawHeight = Math.max(1, height - padding * 2);
  const scale = Math.min(drawWidth / mapWidth, drawHeight / mapHeight);
  const offsetX = (width - mapWidth * scale) / 2 - westMercator * scale;
  const offsetY = (height - mapHeight * scale) / 2 - northMercator * scale;
  const project = ([lng, lat]: [number, number]) => [
    offsetX + mercatorX(lng) * scale,
    offsetY + mercatorY(lat) * scale,
  ];

  ctx.fillStyle = "#edf3f7";
  ctx.fillRect(0, 0, width, height);
  await drawCartoBasemap(ctx, width, height, offsetX, offsetY, scale);
  drawBasemapAttribution(ctx, width, height);

  const radius = Math.max(4, Math.min(8, Math.round(Math.min(width, height) / 80)));
  ctx.fillStyle = "#2563eb";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1.5, radius / 3);
  for (const coordinate of coordinates) {
    const [x, y] = project(coordinate);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = Math.max(1, width / 1000);
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  return canvas;
}

async function featureDataForExport() {
  const sourceData = spec.value?.sources?.features?.data;
  if (typeof sourceData !== "string") return sourceData ?? null;

  try {
    const response = await fetch(resolvedFeatureApiUrl.value);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.warn("[MapLibreRenderElement] feature export fetch error:", err);
    return null;
  }
}

async function drawCartoBasemap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  scale: number,
) {
  const zoom = Math.max(0, Math.min(18, Math.floor(Math.log2(scale / 256))));
  const tileCount = 2 ** zoom;
  const tileSize = scale / tileCount;
  const minX = Math.max(0, Math.floor(-offsetX / tileSize));
  const maxX = Math.min(tileCount - 1, Math.ceil((width - offsetX) / tileSize));
  const minY = Math.max(0, Math.floor(-offsetY / tileSize));
  const maxY = Math.min(tileCount - 1, Math.ceil((height - offsetY) / tileSize));
  const tiles: Promise<void>[] = [];

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const url = `https://a.basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`;
      tiles.push(
        loadImage(url)
          .then((image) => ctx.drawImage(image, offsetX + x * tileSize, offsetY + y * tileSize, tileSize, tileSize))
          .catch(() => undefined),
      );
    }
  }
  await Promise.all(tiles);
}

function drawBasemapAttribution(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const text = "© OpenStreetMap contributors  © CARTO";
  const padding = Math.max(5, Math.round(width / 180));
  const fontSize = Math.max(10, Math.round(width / 90));
  ctx.font = `${fontSize}px ${EXPORT_FONT}`;
  const textWidth = ctx.measureText(text).width;
  const boxHeight = fontSize + padding * 2;
  const x = width - textWidth - padding * 3;
  const y = height - boxHeight - padding;

  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(x, y, textWidth + padding * 2, boxHeight);
  ctx.fillStyle = "#475569";
  ctx.fillText(text, x + padding, y + padding + fontSize);
}

function mercatorX(longitude: number) {
  return (longitude + 180) / 360;
}

function mercatorY(latitude: number) {
  const limitedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  return (1 - Math.log(Math.tan(Math.PI / 4 + (limitedLatitude * Math.PI) / 360)) / Math.PI) / 2;
}

async function drawExportCanvas(mapCanvas: HTMLCanvasElement) {
  const scale = 2;
  const footerFontPx = 9 * scale;
  const footerLineHeight = 14 * scale;
  const maxFooterChars = Math.max(40, Math.floor((mapCanvas.width - 24 * scale) / (4.8 * scale)));
  const lines = pngFooterLines.value.flatMap((line) => wrapText(line, maxFooterChars));
  const titleLines = wrapText(
    exportHeadline.value,
    Math.max(28, Math.floor((mapCanvas.width - 140 * scale) / (8 * scale))),
  );
  const subtitleLines = exportSubtitle.value
    ? wrapText(exportSubtitle.value, Math.max(34, Math.floor((mapCanvas.width - 24 * scale) / (6 * scale))))
    : [];
  const headerHeight = 28 * scale + titleLines.length * 24 * scale + subtitleLines.length * 17 * scale;
  const footerHeight = lines.length ? 18 * scale + lines.length * footerLineHeight : 0;
  const canvas = document.createElement("canvas");
  canvas.width = mapCanvas.width;
  canvas.height = headerHeight + mapCanvas.height + footerHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create map export metadata canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await drawHeader(ctx, canvas.width, headerHeight, scale, titleLines, subtitleLines);
  ctx.drawImage(mapCanvas, 0, headerHeight);

  if (lines.length) {
    const footerTop = headerHeight + mapCanvas.height;
    const top = footerTop + 14 * scale;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = scale;
    ctx.beginPath();
    ctx.moveTo(12 * scale, footerTop + 0.5 * scale);
    ctx.lineTo(canvas.width - 12 * scale, footerTop + 0.5 * scale);
    ctx.stroke();

    ctx.fillStyle = "#6b7280";
    ctx.font = `${footerFontPx}px ${EXPORT_FONT}`;
    lines.forEach((line, index) => {
      ctx.fillText(line, 12 * scale, top + index * footerLineHeight);
    });
  }

  return canvas;
}

async function drawHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  headerHeight: number,
  scale: number,
  titleLines: string[],
  subtitleLines: string[],
) {
  const logo = await loadImage(slkLogoUrl).catch(() => null);
  if (logo) {
    const logoWidth = 112 * scale;
    const logoHeight = Math.min(34 * scale, (logo.height / logo.width) * logoWidth);
    ctx.drawImage(logo, width - logoWidth - 12 * scale, 12 * scale, logoWidth, logoHeight);
  } else {
    ctx.fillStyle = "#006e94";
    ctx.font = `700 ${14 * scale}px ${EXPORT_FONT}`;
    ctx.fillText("Stadt.Land.Klima", width - 128 * scale, 28 * scale);
  }

  ctx.fillStyle = "#111827";
  ctx.font = `700 ${18 * scale}px ${EXPORT_FONT}`;
  titleLines.forEach((line, index) => {
    ctx.fillText(line, 12 * scale, 24 * scale + index * 24 * scale);
  });

  if (subtitleLines.length) {
    ctx.fillStyle = "#4b5563";
    ctx.font = `${11 * scale}px ${EXPORT_FONT}`;
    const subtitleTop = 32 * scale + titleLines.length * 24 * scale;
    subtitleLines.forEach((line, index) => {
      ctx.fillText(line, 12 * scale, subtitleTop + index * 17 * scale);
    });
  }

  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = scale;
  ctx.beginPath();
  ctx.moveTo(12 * scale, headerHeight - 0.5 * scale);
  ctx.lineTo(width - 12 * scale, headerHeight - 0.5 * scale);
  ctx.stroke();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function wrapText(text: string, maxChars: number) {
  if (!text || text.length <= maxChars) return [text];
  const words = String(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
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

function resolveUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG export failed"));
    }, "image/png");
  });
}

function downloadBlob(content: Blob | string, type: string, filename: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerDownload(url: string, filename: string) {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function copyTextFallback(text: string) {
  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function slugify(value: unknown) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
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

<style scoped>
.slk-maplibre-render :deep(.maplibregl-popup-content) {
  border: 1px solid rgb(209 213 219);
  background: rgb(255 255 255);
  color: rgb(31 41 55);
  box-shadow: 0 16px 36px rgb(15 23 42 / 0.18);
}

.slk-maplibre-render :deep(.maplibregl-popup-tip) {
  border-top-color: rgb(255 255 255);
  border-bottom-color: rgb(255 255 255);
}

.slk-maplibre-render :deep(.maplibregl-ctrl-group) {
  border-color: rgb(209 213 219);
  background: rgb(255 255 255 / 0.95);
}

.slk-maplibre-render :deep(.maplibregl-ctrl-attrib) {
  border: 1px solid rgb(209 213 219);
  background: rgb(255 255 255 / 0.9);
  color: rgb(75 85 99);
}

.slk-maplibre-render :deep(.maplibregl-ctrl button) {
  color: rgb(31 41 55);
}

.slk-maplibre-render :deep(.maplibregl-ctrl-attrib a) {
  color: rgb(37 99 235);
}

:global(html[data-theme="staedteChallengeDark"] .slk-maplibre-render .maplibregl-popup-content) {
  border-color: rgb(71 85 105);
  background: rgb(30 41 59);
  color: rgb(208 220 229);
}

:global(html[data-theme="staedteChallengeDark"] .slk-maplibre-render .maplibregl-popup-tip) {
  border-top-color: rgb(30 41 59);
  border-bottom-color: rgb(30 41 59);
}

:global(html[data-theme="staedteChallengeDark"] .slk-maplibre-render .maplibregl-ctrl-group) {
  border-color: rgb(71 85 105);
  background: rgb(30 41 59 / 0.95);
}

:global(html[data-theme="staedteChallengeDark"] .slk-maplibre-render .maplibregl-ctrl-attrib) {
  border-color: rgb(71 85 105);
  background: rgb(30 41 59 / 0.9);
  color: rgb(138 164 184);
}

:global(html[data-theme="staedteChallengeDark"] .slk-maplibre-render .maplibregl-ctrl button) {
  color: rgb(208 220 229);
}

:global(html[data-theme="staedteChallengeDark"] .slk-maplibre-render .maplibregl-ctrl button .maplibregl-ctrl-icon) {
  filter: invert(1) hue-rotate(180deg);
}

:global(html[data-theme="staedteChallengeDark"] .slk-maplibre-render .maplibregl-ctrl button:hover) {
  background-color: rgb(51 65 85);
}

:global(html[data-theme="staedteChallengeDark"] .slk-maplibre-render .maplibregl-ctrl-attrib a) {
  color: rgb(173 195 212);
}
</style>
