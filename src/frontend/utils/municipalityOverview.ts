import { asRecord, cloneVisualization, type EditableSpec } from "~/shared/visualization";
import type {
  HistogramResponse,
  OverviewMetric,
  OverviewMunicipality,
} from "../shared/contracts/municipalityOverview.js";

const proxy = "/api/stadtlandzahl";
export function histogramBinFromItem(item: unknown): number | null {
  const node = asRecord(item);
  const mark = asRecord(node?.mark);
  const datum = asRecord(node?.datum);
  if (
    mark?.name !== "municipality_histogram_bars_marks" &&
    mark?.name !== "municipality-histogram-bars_marks" &&
    mark?.name !== "municipality-histogram-bars"
  )
    return null;
  return typeof datum?.bin_index === "number" && Number.isInteger(datum.bin_index) && datum.bin_index >= 0
    ? datum.bin_index
    : null;
}
export function overviewEndpoint(collection: string, suffix = "") {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(collection)) throw new Error("Invalid collection");
  return `${proxy}/api/collections/${collection}/overview/${suffix}`;
}

/** Related URLs never escape the selected collection, same-origin proxy or snapshot. */
export function checkedOverviewUrl(
  input: string,
  collection: string,
  endpoint: "municipalities" | "regions" | "histogram" | "tiles",
  snapshot?: string,
): string {
  const origin = (globalThis as { location?: { origin: string } }).location?.origin ?? "https://overview.invalid";
  if (
    input.includes("\\") ||
    Array.from(input).some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127) ||
    input.startsWith("//")
  )
    throw new Error("Invalid overview URL");
  const url = new URL(input, origin);
  if (url.origin !== origin || url.username || url.password || url.hash) throw new Error("Invalid overview origin");
  const root = overviewEndpoint(collection);
  const expected = endpoint === "histogram" ? root.replace(/overview\/$/, "histogram/") : `${root}${endpoint}/`;
  const path = decodeURIComponent(url.pathname);
  if (endpoint === "tiles" ? !new RegExp(`^${expected}[{]z[}]/[{]x[}]/[{]y[}]\\.pbf$`).test(path) : path !== expected)
    throw new Error("Invalid overview endpoint");
  if (snapshot && (url.searchParams.getAll("snapshot").length !== 1 || url.searchParams.get("snapshot") !== snapshot))
    throw new Error("Mismatched overview snapshot");
  return `${path}${url.search}`;
}

export function municipalityProductRoute(collection: string, row: Pick<OverviewMunicipality, "slug">) {
  if (!/^[a-z0-9_-]{1,240}$/.test(row.slug) || !/^[a-zA-Z0-9_-]{1,160}$/.test(collection))
    throw new Error("Invalid municipality route");
  return `/data/${row.slug}#${collection}`;
}

export function formatOverviewValue(value: number | null, metric: OverviewMetric | null | undefined, locale: string) {
  if (value === null || !metric) return null;
  return (
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: metric.precision,
      maximumFractionDigits: metric.precision,
      ...(metric.percentage_representation === "fraction" ? { style: "percent" as const } : {}),
    }).format(value) + (metric.percentage_representation === "percent" ? " %" : "")
  );
}

/** Bind only the declared histogram feed; no second chart request or bin reconstruction. */
export function bindHistogramData(input: EditableSpec, sourceUrl: string, response: HistogramResponse): EditableSpec {
  const spec = cloneVisualization(input);
  let replacements = 0;
  const bind = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(bind);
      return;
    }
    const node = asRecord(value);
    if (!node) return;
    const data = asRecord(node.data);
    if (typeof data?.url === "string" && data.url !== sourceUrl) throw new Error("Unexpected histogram data feed");
    if (data?.url === sourceUrl) {
      const property = asRecord(data.format)?.property;
      if (property !== "bins" && property !== "segments" && property !== "score_segments")
        throw new Error("Invalid histogram data property");
      if (!response[property]) throw new Error("Missing histogram data property");
      node.data = { values: response[property] };
      replacements++;
    }
    for (const [key, child] of Object.entries(node)) if (key !== "data" && key !== "datasets") bind(child);
  };
  bind(spec);
  if (!replacements) throw new Error("Missing histogram data reference");
  return spec;
}
