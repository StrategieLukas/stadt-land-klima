import type { Spec as VegaSpec } from "vega";
import { asRecord } from "~/shared/visualization";
import { withCollectionBarAxes } from "~/shared/collectionChartAxes";

export const COLLECTION_CHART_FONT = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const palettes = {
  light: { background: "#ffffff", foreground: "#505050", label: "#505050", grid: "#e5e7eb", outline: "#d9dfd3" },
  dark: { background: "#17212b", foreground: "#d0dce5", label: "#8aa4b8", grid: "#243444", outline: "#344454" },
};
export function collectionChartPalette(dark: boolean) {
  return palettes[dark ? "dark" : "light"];
}

/** Color expressions keep the compiled chart and its loaded data alive across theme changes. */
export function withCollectionChartTheme(input: unknown, signalName: string) {
  const spec = withCollectionBarAxes(input);
  const native = Array.isArray(spec.marks);
  const color = (key: keyof typeof palettes.light) =>
    native ? { signal: `${signalName}.${key}` } : { expr: `${signalName}.${key}` };
  const config = asRecord(spec.config);
  spec.background = color("background");
  spec.config = {
    ...config,
    font: COLLECTION_CHART_FONT,
    view: { ...asRecord(config?.view), fill: color("background"), stroke: color("outline") },
    axis: {
      ...asRecord(config?.axis),
      labelColor: color("label"),
      titleColor: color("label"),
      gridColor: color("grid"),
      domainColor: color("outline"),
      tickColor: color("outline"),
    },
    title: { ...asRecord(config?.title), color: color("foreground"), subtitleColor: color("label") },
    legend: { ...asRecord(config?.legend), labelColor: color("label"), titleColor: color("label") },
    header: { ...asRecord(config?.header), labelColor: color("foreground"), titleColor: color("foreground") },
  };
  const visit = (value: unknown) => {
    const node = asRecord(value);
    if (!node) return;
    const mark = asRecord(node.mark);
    if (mark?.type === "rule" && asRecord(asRecord(node.encoding)?.x)?.field === "display_area_value")
      mark.color = color("foreground");
    for (const key of ["layer", "hconcat", "vconcat", "concat"]) {
      const children = node[key];
      if (Array.isArray(children)) children.forEach(visit);
    }
    visit(node.spec);
  };
  visit(spec);
  return spec;
}

export function withCollectionChartThemeSignal(spec: VegaSpec, name: string, dark: boolean): VegaSpec {
  if (spec.signals?.some((signal) => signal.name === name)) throw new Error("Reserved chart theme signal");
  return { ...spec, signals: [...(spec.signals ?? []), { name, value: collectionChartPalette(dark) }] };
}

export type CollectionChartPreview = { light: string; dark: string; data: Record<string, string> };
export function emptyCollectionChartPreview(): CollectionChartPreview {
  return { light: "", dark: "", data: {} };
}
