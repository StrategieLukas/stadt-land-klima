<template>
  <div class="group/maplibre bg-gray-50 relative h-full w-full overflow-hidden">
    <div ref="containerRef" class="h-full w-full" />
    <div
      v-if="canExport"
      class="border-gray-300 pointer-events-none absolute bottom-2 right-2 z-20 flex items-center gap-1 rounded-full border bg-white/95 p-1 opacity-0 shadow-md transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover/maplibre:pointer-events-auto group-hover/maplibre:opacity-100"
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
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/60">
      <SlkFlowerSpinner :size="24" />
    </div>
    <div v-if="error" class="text-gray-400 absolute inset-0 flex items-center justify-center text-sm">
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
      ? (structuredCloneSafe(mapSpec.style) as Record<string, any>)
      : null;
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
  if (map.loaded?.() && !map.isMoving?.()) return nextAnimationFrames(2);

  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => resolve(), 1500);
    map.once("idle", () => {
      window.clearTimeout(timeout);
      nextAnimationFrames(2).then(resolve);
    });
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
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create map export canvas");
  ctx.drawImage(sourceCanvas, 0, 0);
  return canvas;
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
