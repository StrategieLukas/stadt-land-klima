import type embed from "vega-embed";
import type { EmbedOptions, Result, VisualizationSpec } from "vega-embed";
import type { Spec as VegaSpec } from "vega";

interface BarLabel {
  barName: string;
  textName: string;
  orientation: string;
  labelField: string;
  valueField: string;
  font: string;
  fontSize: number;
  padding: number;
}
interface BarItem {
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  fill?: string;
  datum: Record<string, unknown>;
  mark: { name: string; marktype?: string; items: BarItem[] };
}
interface CompiledMark {
  name?: string;
  marks?: CompiledMark[];
  from?: object;
  encode?: object;
  interactive?: boolean;
}
interface MutableCompiled {
  autosize?: object;
  signals?: { name: string; on?: unknown }[];
  marks?: CompiledMark[];
}
function canvasContext(): CanvasRenderingContext2D {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) throw new Error("Canvas text measurement is unavailable");
  return context;
}
function isBarLabel(value: unknown): value is BarLabel {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    ["barName", "textName", "orientation", "labelField", "valueField", "font"].every(
      (key) => typeof record[key] === "string",
    ) &&
    typeof record.fontSize === "number" &&
    record.fontSize > 0 &&
    record.fontSize <= 72 &&
    typeof record.padding === "number" &&
    record.padding >= 0 &&
    record.padding <= 24
  );
}

/** Shared adapter for collections clients using Vega Embed. No app framework required. */

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function barBounds(item: BarItem) {
  const x2 = finite(item.x2) ? item.x2 : item.x + (item.width || 0);
  const y2 = finite(item.y2) ? item.y2 : item.y + (item.height || 0);
  return {
    left: Math.min(item.x, x2),
    right: Math.max(item.x, x2),
    top: Math.min(item.y, y2),
    bottom: Math.max(item.y, y2),
  };
}

function insideColor(fill: string | undefined) {
  // Browser Canvas normalizes named colors and rgb/hex strings for us.
  const context = canvasContext();
  context.fillStyle = fill || "#777777";
  context.fillRect(0, 0, 1, 1);
  const rgb = context.getImageData(0, 0, 1, 1).data;
  const channels = [...rgb]
    .slice(0, 3)
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#111111" : "#ffffff";
}

export function createLabelFunctions() {
  const context = canvasContext();
  const widths = new Map<string, number>();
  const measure = (text: unknown, font: string, fontSize: number): number => {
    const key = JSON.stringify([text, font, fontSize]);
    if (!widths.has(key)) {
      context.font = `${fontSize}px ${font}`;
      widths.set(key, context.measureText(String(text)).width);
    }
    return widths.get(key) ?? 0;
  };
  const fits = (item: BarItem, label: BarLabel) => {
    const b = barBounds(item);
    const text = item.datum[label.labelField];
    return (
      b.right - b.left >= measure(text, label.font, label.fontSize) + label.padding * 2 &&
      b.bottom - b.top >= label.fontSize + label.padding * 2
    );
  };
  const position = (item: BarItem, label: BarLabel) => {
    const b = barBounds(item);
    const inside = fits(item, label);
    const horizontal = label.orientation === "horizontal";
    const positive = Number(item.datum[label.valueField]) >= 0;
    const cx = (b.left + b.right) / 2,
      cy = (b.top + b.bottom) / 2;
    let x = cx,
      y = cy;
    if (!inside) {
      // Short segments of the same stack get distinct outside lines.
      const peers = item.mark.items.filter((peer) => {
        const other = barBounds(peer);
        const sameBand = horizontal
          ? Math.abs((other.top + other.bottom) / 2 - cy) < 0.5
          : Math.abs((other.left + other.right) / 2 - cx) < 0.5;
        return sameBand && Number(peer.datum[label.valueField]) >= 0 === positive && !fits(peer, label);
      });
      const index = Math.max(0, peers.indexOf(item));
      const bounds = peers.map(barBounds);
      if (horizontal) {
        x = positive
          ? Math.max(b.right, ...bounds.map((p) => p.right)) + label.padding
          : Math.min(b.left, ...bounds.map((p) => p.left)) - label.padding;
        y += (index - (peers.length - 1) / 2) * (label.fontSize + 3);
      } else {
        y = positive
          ? Math.min(b.top, ...bounds.map((p) => p.top)) - label.padding - index * (label.fontSize + 3)
          : Math.max(b.bottom, ...bounds.map((p) => p.bottom)) + label.padding + index * (label.fontSize + 3);
      }
    }
    return {
      x,
      y,
      inside,
      align: inside || !horizontal ? "center" : positive ? "left" : "right",
      baseline: inside || horizontal ? "middle" : positive ? "bottom" : "top",
      fill: inside ? insideColor(item.fill) : "#222222",
    };
  };
  return {
    slzLabelPosition: position,
    measure,
    clear: () => widths.clear(),
  };
}

export function patchBarLabels(input: VegaSpec, labels: BarLabel[]): VegaSpec {
  const compiled = input as unknown as MutableCompiled;
  // This adapter sizes the plotting area and reserves outside text gutters.
  // Vega-Lite's fit-x mode would subtract those gutters a second time and can
  // collapse the plotting width to zero in a narrow container.
  if (labels.length) {
    compiled.autosize = { type: "pad", contains: "content" };
    const width = compiled.signals?.find((signal) => signal.name === "width");
    if (width) delete width.on; // ResizeObserver owns container sizing below.
  }
  const visit = (marks: CompiledMark[]): void => {
    for (const label of labels) {
      const bars = marks.find((mark) => mark.name === label.barName);
      const text = marks.find((mark) => mark.name === label.textName);
      if (!bars || !text) continue;
      const expr = `slzLabelPosition(datum, ${JSON.stringify(label)})`;
      text.from = { data: bars.name }; // Vega reactive geometry tracks scale/zoom changes.
      text.encode = {
        update: {
          text: { signal: `datum.datum[${JSON.stringify(label.labelField)}]` },
          font: { value: label.font },
          fontSize: { value: label.fontSize },
          x: { signal: `${expr}.x` },
          y: { signal: `${expr}.y` },
          align: { signal: `${expr}.align` },
          baseline: { signal: `${expr}.baseline` },
          fill: { signal: `${expr}.fill` },
        },
      };
      text.interactive = false;
    }
    for (const mark of marks) if (mark.marks) visit(mark.marks);
  };
  visit(compiled.marks || []);
  return input;
}

function allItems(scene: unknown): BarItem[] {
  const result: BarItem[] = [];
  const walk = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    const node = value as { mark?: { marktype?: string }; items?: unknown[] };
    if (node.mark?.marktype === "rect") result.push(node as BarItem);
    for (const child of node.items || []) walk(child);
  };
  walk(scene);
  return result;
}

export async function embedCollectionChart(
  target: HTMLElement,
  spec: VisualizationSpec,
  vegaEmbed: typeof embed,
  options: EmbedOptions = {},
): Promise<Result> {
  const raw = (spec as { usermeta?: { barLabels?: unknown } }).usermeta?.barLabels;
  const labels = Array.isArray(raw) ? raw.filter(isBarLabel).slice(0, 64) : [];
  if (!labels.length) return vegaEmbed(target, spec, options);
  const functions = createLabelFunctions();
  const patch = options.patch;
  if (patch !== undefined && typeof patch !== "function")
    throw new Error("Use a function patch with the collection adapter.");
  const patchFunction = typeof patch === "function" ? patch : undefined;
  const result = await vegaEmbed(target, spec, {
    ...options,
    expressionFunctions: { ...options.expressionFunctions, slzLabelPosition: functions.slzLabelPosition },
    patch: (compiled) => patchBarLabels(patchFunction ? patchFunction(compiled) : compiled, labels),
  });
  const view = result.view;
  let disposed = false,
    pending = false;
  const layout = async () => {
    if (pending || disposed) return;
    pending = true;
    try {
      const padding = { left: 12, right: 12, top: 12, bottom: 12 };
      let minimumWidth = 80;
      const items = allItems((view.scenegraph() as unknown as { root: unknown }).root);
      for (const label of labels) {
        const bars = items.filter((item) => item.mark.name === label.barName);
        for (const item of bars) {
          const width = Math.ceil(functions.measure(item.datum[label.labelField], label.font, label.fontSize));
          if (label.orientation === "horizontal") {
            const side = Number(item.datum[label.valueField]) >= 0 ? "right" : "left";
            padding[side] = Math.max(padding[side], width + label.padding + 12);
          } else {
            // A vertical category band must also accommodate a full outside
            // label. Scroll narrow screens instead of overlapping neighbors.
            minimumWidth = Math.max(minimumWidth, Math.ceil(((width + 2 * label.padding) * bars.length) / 0.7));
            padding.left = Math.max(padding.left, Math.ceil(width / 2) + 12);
            padding.right = Math.max(padding.right, Math.ceil(width / 2) + 12);
            const side = Number(item.datum[label.valueField]) >= 0 ? "top" : "bottom";
            padding[side] = Math.max(padding[side], bars.length * (label.fontSize + 3) + 12);
          }
        }
      }
      // Keep a useful plot width. Very narrow containers can scroll the chart
      // rather than truncate full category labels.
      const width = Math.max(minimumWidth, target.clientWidth - padding.left - padding.right);
      await view.padding(padding).width(width).runAsync();
    } finally {
      pending = false;
    }
  };
  await layout();
  const observer = new ResizeObserver(() => {
    void layout();
  });
  observer.observe(target);
  const fontChange = () => {
    functions.clear();
    void layout();
  };
  document.fonts?.addEventListener("loadingdone", fontChange);
  const finalize = result.finalize;
  result.finalize = () => {
    disposed = true;
    observer.disconnect();
    document.fonts?.removeEventListener("loadingdone", fontChange);
    finalize();
  };
  return result;
}
