<template>
  <div
    ref="containerRef"
    class="group/vega-chart relative w-full"
    :style="height ? `height:${height}px` : 'height:100%'"
  >
    <div
      v-if="canExport"
      class="border-gray-300 pointer-events-none absolute bottom-2 right-2 z-20 flex items-center gap-1 rounded-full border bg-white/95 p-1 opacity-0 shadow-md transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover/vega-chart:pointer-events-auto group-hover/vega-chart:opacity-100"
    >
      <button
        type="button"
        class="btn btn-ghost btn-xs h-7 min-h-0 w-7 px-0"
        title="Daten herunterladen"
        aria-label="Daten herunterladen"
        @click.stop="downloadData"
      >
        <Icon icon="mdi:database-arrow-down-outline" class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs h-7 min-h-0 w-7 px-0"
        title="Diagramm als PNG herunterladen"
        aria-label="Diagramm als PNG herunterladen"
        @click.stop="downloadPng"
      >
        <Icon icon="mdi:file-image-outline" class="h-4 w-4" />
      </button>
      <button
        v-if="resolvedDataApiUrl"
        type="button"
        class="btn btn-ghost btn-xs h-7 min-h-0 w-7 px-0"
        title="API-Aufruf kopieren"
        aria-label="API-Aufruf kopieren"
        @click.stop="copyApiCall"
      >
        <Icon icon="mdi:content-copy" class="h-4 w-4" />
      </button>
    </div>
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <SlkFlowerSpinner :size="24" />
    </div>
    <div v-if="renderError" class="text-gray-400 absolute inset-0 flex items-center justify-center text-xs">
      Diagramm konnte nicht geladen werden.
    </div>
    <div ref="vegaRef" class="h-full w-full" />
  </div>
</template>

<script setup>
import { Icon } from "@iconify/vue";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import slkLogoUrl from "~/assets/images/Stadt-Land-Klima-Logo.svg";

const DATA_WEB_URL = "www.stadt-land-klima.de/data";
const EXPORT_FONT = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const props = defineProps({
  spec: {
    type: Object,
    required: true,
  },
  height: {
    type: Number,
    default: null,
  },
  exportAreaName: {
    type: String,
    default: "",
  },
  exportArs: {
    type: String,
    default: "",
  },
  exportTitle: {
    type: String,
    default: "",
  },
  exportSubtitle: {
    type: String,
    default: "",
  },
  exportCollectionName: {
    type: String,
    default: "",
  },
  exportUpdatedAt: {
    type: String,
    default: "",
  },
  exportAttribution: {
    type: String,
    default: "",
  },
});

const containerRef = ref(null);
const vegaRef = ref(null);
const loading = ref(false);
const renderError = ref(false);
const exportReady = ref(false);
const canExport = computed(() => exportReady.value && !loading.value && !renderError.value);
const resolvedDataApiUrl = computed(() => {
  const url = findDataUrl(props.spec);
  return url ? resolveUrl(url) : "";
});
let vegaView = null;

async function render() {
  if (!vegaRef.value || !props.spec) return;
  loading.value = true;
  renderError.value = false;
  exportReady.value = false;

  try {
    const { default: vegaEmbed } = await import("vega-embed");

    if (vegaView) {
      vegaView.finalize();
      vegaView = null;
    }
    vegaRef.value.innerHTML = "";

    const result = await vegaEmbed(vegaRef.value, props.spec, {
      renderer: "canvas",
      actions: false,
      config: {
        background: "transparent",
        font: EXPORT_FONT,
      },
    });
    vegaView = result.view;
    exportReady.value = true;
  } catch (e) {
    console.warn("[VegaChart] render error:", e);
    renderError.value = true;
    exportReady.value = false;
  } finally {
    loading.value = false;
  }
}

async function downloadPng() {
  if (!vegaView) return;

  try {
    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready;
    }
    const canvas = await vegaView.toCanvas(2);
    const exportCanvas = await drawExportCanvas(canvas);
    const blob = await canvasToBlob(exportCanvas);
    downloadBlob(blob, "image/png", `${baseFilename.value}.png`);
  } catch (e) {
    console.warn("[VegaChart] PNG export error:", e);
  }
}

async function downloadData() {
  try {
    const rows = findViewRows();
    if (rows.length) {
      downloadBlob(exportCsv(rows), "text/csv;charset=utf-8", `${baseFilename.value}-data.csv`);
      return;
    }

    const inlineRows = findInlineRows(props.spec);
    if (inlineRows.length) {
      downloadBlob(exportCsv(inlineRows), "text/csv;charset=utf-8", `${baseFilename.value}-data.csv`);
      return;
    }

    const dataUrl = findDataUrl(props.spec);
    if (dataUrl) {
      const response = await fetch(resolveUrl(dataUrl));
      const text = await response.text();
      const contentType = response.headers.get("content-type") || "text/plain;charset=utf-8";
      const extension = inferExtension(contentType, dataUrl);
      const apiRows = rowsFromApiText(text, contentType);
      if (apiRows.length) {
        downloadBlob(exportCsv(apiRows), "text/csv;charset=utf-8", `${baseFilename.value}-data.csv`);
        return;
      }
      downloadBlob(`${csvCommentBlock.value}${text}`, contentType, `${baseFilename.value}-data.${extension}`);
      return;
    }

    downloadBlob(
      JSON.stringify(props.spec, null, 2),
      "application/json;charset=utf-8",
      `${baseFilename.value}-spec.json`,
    );
  } catch (e) {
    console.warn("[VegaChart] data export error:", e);
  }
}

async function copyApiCall() {
  if (!resolvedDataApiUrl.value) return;
  try {
    await navigator.clipboard.writeText(resolvedDataApiUrl.value);
  } catch {
    copyTextFallback(resolvedDataApiUrl.value);
  }
}

const baseFilename = computed(() => {
  const title = exportTitle.value;
  return (
    [props.exportAreaName, props.exportCollectionName, title, normalizedExportDate.value]
      .filter(Boolean)
      .map(slugify)
      .filter(Boolean)
      .join("_") || "vega-chart"
  );
});

const normalizedExportDate = computed(() => normalizeDate(props.exportUpdatedAt));
const exportTitle = computed(() => {
  const specTitle = typeof props.spec?.title === "string" ? props.spec.title : props.spec?.title?.text;
  return props.exportTitle || specTitle || props.exportCollectionName || "Vega-Diagramm";
});
const exportSubtitle = computed(() => props.exportSubtitle || props.exportCollectionName || "");
const exportHeadline = computed(() =>
  props.exportAreaName ? `${exportTitle.value} in ${props.exportAreaName}` : exportTitle.value,
);

const csvCommentBlock = computed(() => {
  const rows = [
    ["Titel", exportTitle.value],
    ["Untertitel", exportSubtitle.value],
    ["Kommune", props.exportAreaName],
    ["ARS", props.exportArs],
    ["Datensatz", props.exportCollectionName],
    ["Stand", normalizedExportDate.value],
    ["Attribution", props.exportAttribution],
    ["Quelle", "Stadt.Land.Klima! e.V."],
    ["Web", DATA_WEB_URL],
    ["API", resolvedDataApiUrl.value],
  ].filter(([, value]) => value);

  return rows.map(([key, value]) => `# ${key}: ${String(value).replace(/\r?\n/g, " ")}`).join("\n") + "\n";
});

const exportAreaLabel = computed(() => {
  const name = props.exportAreaName;
  const ars = props.exportArs;
  if (name && ars) return `${name} (ARS: ${ars})`;
  if (ars) return `ARS: ${ars}`;
  return name;
});

const pngFooterLines = computed(() => {
  const meta = [];
  if (exportAreaLabel.value) meta.push(`Kommune: ${exportAreaLabel.value}`);
  if (props.exportAttribution) meta.push(`Datenquelle: ${props.exportAttribution}`);
  if (normalizedExportDate.value) meta.push(`Stand: ${normalizedExportDate.value}`);
  return [meta.join("  ·  "), `Quelle: Stadt.Land.Klima! e.V.  ·  ${DATA_WEB_URL}`].filter(Boolean);
});

function exportCsv(rows) {
  return `${csvCommentBlock.value}${rowsToCsv(rows)}`;
}

async function drawExportCanvas(chartCanvas) {
  const scale = 2;
  const footerFontPx = 9 * scale;
  const footerLineHeight = 14 * scale;
  const maxFooterChars = Math.max(40, Math.floor((chartCanvas.width - 24 * scale) / (4.8 * scale)));
  const lines = pngFooterLines.value.flatMap((line) => wrapText(line, maxFooterChars));
  const titleLines = wrapText(
    exportHeadline.value,
    Math.max(28, Math.floor((chartCanvas.width - 140 * scale) / (8 * scale))),
  );
  const subtitleLines = exportSubtitle.value
    ? wrapText(exportSubtitle.value, Math.max(34, Math.floor((chartCanvas.width - 24 * scale) / (6 * scale))))
    : [];
  const headerHeight = 28 * scale + titleLines.length * 24 * scale + subtitleLines.length * 17 * scale;
  const footerHeight = lines.length ? 18 * scale + lines.length * footerLineHeight : 0;
  const canvas = document.createElement("canvas");
  canvas.width = chartCanvas.width;
  canvas.height = headerHeight + chartCanvas.height + footerHeight;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await drawHeader(ctx, canvas.width, headerHeight, scale, titleLines, subtitleLines);
  ctx.drawImage(chartCanvas, 0, headerHeight);

  if (lines.length) {
    const footerTop = headerHeight + chartCanvas.height;
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

async function drawHeader(ctx, width, headerHeight, scale, titleLines, subtitleLines) {
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function wrapText(text, maxChars) {
  if (!text || text.length <= maxChars) return [text];
  const words = String(text).split(/\s+/);
  const lines = [];
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

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG export failed"));
    }, "image/png");
  });
}

function findViewRows() {
  if (!vegaView?.getState) return [];

  try {
    const state = vegaView.getState({ data: () => true, recurse: true });
    const data = state?.data ?? {};
    const candidates = Object.entries(data)
      .map(([name, rows]) => ({ name, rows: Array.isArray(rows) ? sanitizeRows(rows) : [] }))
      .filter((entry) => entry.rows.length)
      .sort((a, b) => datasetScore(b) - datasetScore(a));

    return candidates[0]?.rows ?? [];
  } catch {
    return [];
  }
}

function datasetScore(entry) {
  let score = Math.min(entry.rows.length, 1000) / 1000;
  const name = String(entry.name);
  if (name === "source_0" || name === "source") score += 100;
  if (name.startsWith("source_")) score += 90;
  if (name.startsWith("data_")) score += 40;
  if (name.includes("legend") || name.includes("marks")) score -= 100;
  return score;
}

function sanitizeRows(rows) {
  return rows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
      const sanitized = {};
      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith("_")) continue;
        if (typeof value === "function") continue;
        sanitized[key] = value;
      }
      return sanitized;
    })
    .filter((row) => Object.keys(row).length);
}

function rowsToCsv(rows) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [headers.map(csvCell).join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(normalizeCell(row[header]))).join(","));
  }

  return lines.join("\n");
}

function normalizeCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function findInlineRows(spec) {
  let rows = [];
  walkSpec(spec, (node) => {
    if (rows.length) return;
    if (Array.isArray(node?.values)) rows = node.values;
  });
  return sanitizeRows(rows);
}

function rowsFromApiText(text, contentType) {
  if (!contentType?.includes("json")) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return sanitizeRows(parsed);
    const firstArray = Object.values(parsed ?? {}).find((value) => Array.isArray(value));
    return sanitizeRows(firstArray ?? []);
  } catch {
    return [];
  }
}

function findDataUrl(spec) {
  let url = "";
  walkSpec(spec, (node) => {
    if (!url && typeof node?.url === "string") url = node.url;
  });
  return url;
}

function walkSpec(value, visitor) {
  if (!value || typeof value !== "object") return;
  visitor(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") walkSpec(child, visitor);
  }
}

function resolveUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}

function inferExtension(contentType, url) {
  if (contentType?.includes("csv")) return "csv";
  if (contentType?.includes("json")) return "json";
  const extension = String(url)
    .split("?")[0]
    .match(/\.([a-z0-9]+)$/i)?.[1];
  return extension || "dat";
}

function downloadBlob(content, type, filename) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerDownload(url, filename) {
  if (typeof document === "undefined") return;
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function copyTextFallback(text) {
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

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

watch(
  () => props.spec,
  () => render(),
  { deep: true },
);

onMounted(() => render());

onUnmounted(() => {
  exportReady.value = false;
  if (vegaView) {
    vegaView.finalize();
    vegaView = null;
  }
});
</script>
